use log::{debug, error, info, warn};
use rmp_serde::{Deserializer, Serializer};
use serde::ser::SerializeMap;
use serde::{Deserialize, Serialize};
use serde_json;
use serde_json::Value;
use serialport::{SerialPortType, available_ports};
use std::collections::BTreeMap;
use std::io::{self, Cursor, Read};
use std::sync::atomic::{AtomicBool, Ordering};
use std::{
    sync::{Mutex, mpsc},
    thread::{self},
    time::Duration,
};
use tauri::Emitter;
use tauri::WebviewWindow;

pub static mut COMPUTER_SLEEPING: bool = false;

pub mod decker {
    use super::SliderData;

    pub static mut slider_values: SliderData = SliderData {
        slider1: 0,
        slider2: 0,
        slider3: 0,
        slider4: 0,
        slider5: 0,
    };
}
#[derive(Clone, serde::Serialize)]
struct Payload {
    message: String,
}

// Define a struct to match the JSON structure
#[derive(Debug)]
pub struct SliderData {
    pub slider1: u32,
    pub slider2: u32,
    pub slider3: u32,
    pub slider4: u32,
    pub slider5: u32,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
enum MessageData {
    Slider(SliderData),
    Device(DeviceData),
}

#[derive(Debug, Serialize, Deserialize)]
struct DeviceData {
    #[serde(rename = "firmwareVersion")]
    firmware_version: String,
    #[serde(rename = "deviceModel")]
    device_model: String,
    #[serde(rename = "serialNumber")]
    serial_number: String,
}

#[derive(Debug)]
enum DataType {
    Slider(SliderData),
    Device(DeviceData),
}

impl<'de> Deserialize<'de> for MessageData {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        // Deserialize into a serde_json::Value first
        let value: serde_json::Value = serde_json::Value::deserialize(deserializer)?;

        // Try to deserialize as SliderData first
        if let Ok(map) = serde_json::from_value::<BTreeMap<String, u32>>(value.clone()) {
            return Ok(MessageData::Slider(SliderData {
                slider1: *map.get("slider1").unwrap_or(&0),
                slider2: *map.get("slider2").unwrap_or(&0),
                slider3: *map.get("slider3").unwrap_or(&0),
                slider4: *map.get("slider4").unwrap_or(&0),
                slider5: *map.get("slider5").unwrap_or(&0),
            }));
        }

        // If deserialization as SliderData fails, try to deserialize as DeviceData
        let device_data =
            serde_json::from_value::<DeviceData>(value).map_err(serde::de::Error::custom)?;
        Ok(MessageData::Device(device_data))
    }
}

impl Serialize for SliderData {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut map = serializer.serialize_map(Some(5))?;
        map.serialize_entry("slider1", &self.slider1)?;
        map.serialize_entry("slider2", &self.slider2)?;
        map.serialize_entry("slider3", &self.slider3)?;
        map.serialize_entry("slider4", &self.slider4)?;
        map.serialize_entry("slider5", &self.slider5)?;
        map.end()
    }
}

fn deserialize_slider_data(
    data: &[u8],
    inverted: bool,
) -> std::result::Result<DataType, Box<dyn std::error::Error>> {
    // Create a cursor for the data source
    let cursor = Cursor::new(data);

    // Deserialize MessagePack data from the cursor
    let mut deserializer = Deserializer::new(cursor);

    let message_data: MessageData = Deserialize::deserialize(&mut deserializer)?;

    // Match the message data and return the appropriate DataType - Slider or Device
    match message_data {
        MessageData::Slider(mut slider_data) => {
            if inverted {
                slider_data.slider1 = 1023 - slider_data.slider1;
                slider_data.slider2 = 1023 - slider_data.slider2;
                slider_data.slider3 = 1023 - slider_data.slider3;
                slider_data.slider4 = 1023 - slider_data.slider4;
                slider_data.slider5 = 1023 - slider_data.slider5;
            }
            Ok(DataType::Slider(slider_data))
        }
        MessageData::Device(device_data) => Ok(DataType::Device(device_data)),
    }
}

fn serialize_decker_data(
    json_string: &str,
) -> std::result::Result<Vec<u8>, Box<dyn std::error::Error>> {
    // Parse the JSON string into a serde_json::Value
    let value: Value = serde_json::from_str(json_string)?;

    // Create a buffer to store the serialized data
    let mut buf = Vec::new();

    // Create a MessagePack serializer
    let mut serializer = Serializer::new(&mut buf);

    // Serialize the JSON value
    value.serialize(&mut serializer)?;

    Ok(buf)
}

//TODO: https://tauri.app/v1/guides/features/events/
// To subscribe to slider changes in frontend and emit changes from backend when values from sliders update.

#[derive(serde::Serialize)]
pub struct USBDevice {
    port_name: String,
    port_type: String,
    vid: u16,
    pid: u16,
    manufacturer: String,
    product: String,
}

#[cfg(target_os = "linux")]
fn serial_device(port_name: String, port_type: String) -> USBDevice {
    USBDevice {
        port_name,
        port_type,
        vid: 0,
        pid: 0,
        manufacturer: String::new(),
        product: String::new(),
    }
}

#[tauri::command]
pub fn get_devices() -> Vec<USBDevice> {
    let mut usb_devices = Vec::new(); // Create an empty vector to store USB devices

    match available_ports() {
        Ok(ports) => {
            for p in ports {
                match p.port_type {
                    SerialPortType::UsbPort(info) => {
                        let device = USBDevice {
                            port_name: p.port_name.clone(),
                            port_type: "USB".to_string(),
                            vid: info.vid,
                            pid: info.pid,
                            manufacturer: info
                                .manufacturer
                                .as_ref()
                                .map_or("", String::as_str)
                                .to_string(),
                            product: info.product.as_ref().map_or("", String::as_str).to_string(),
                        };
                        usb_devices.push(device); // Add the USB device to the vector
                    }
                    #[cfg(target_os = "linux")]
                    _ => {
                        if std::env::var_os("DOTX_SHOW_ALL_SERIAL_PORTS").is_some() {
                            usb_devices
                                .push(serial_device(p.port_name.clone(), "Serial".to_string()));
                        }
                    }
                    #[cfg(not(target_os = "linux"))]
                    _ => {} // Ignore non-USB ports
                }
            }
        }
        Err(e) => {
            error!("Error listing serial ports - {:?}", e);
        }
    }

    #[cfg(target_os = "linux")]
    if let Ok(extra_ports) = std::env::var("DOTX_EXTRA_SERIAL_PORTS") {
        for port_name in extra_ports
            .split(',')
            .map(str::trim)
            .filter(|port_name| !port_name.is_empty())
        {
            if !usb_devices
                .iter()
                .any(|device| device.port_name == port_name)
            {
                usb_devices.push(serial_device(port_name.to_string(), "Serial".to_string()));
            }
        }
    }

    usb_devices // Return the vector of USB devices
}

static SENDER: Mutex<Option<mpsc::Sender<String>>> = Mutex::new(None);
static SHOULD_RUN: AtomicBool = AtomicBool::new(true);

pub fn kill_decker_thread() {
    SHOULD_RUN.store(false, Ordering::Relaxed);
    thread::sleep(Duration::from_millis(250));
    start_background_thread();
}

pub fn start_background_thread() {
    SHOULD_RUN.store(true, Ordering::Relaxed);
}

pub fn initialize_decker(
    window: WebviewWindow,
    port_name: &str,
    inverted: bool,
) -> std::result::Result<(), std::io::Error> {
    if unsafe { COMPUTER_SLEEPING } {
        error!("Computer is sleeping, skipping connect");
        return Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            "Computer is sleeping",
        ));
    }
    let baud_rate: u32 = 115_200;

    // Close the existing connection if one is currently open. `port_name` is always
    // present in `available_ports()` here (it was just picked from that list), so
    // checking against it would kill the background thread on every attempt,
    // including the very first one. Check whether a connection is actually live instead.
    if SENDER.lock().unwrap().is_some() {
        warn!("Port \"{}\" is already open. Closing it...", port_name);
        kill_decker_thread();
    }

    let mut is_decker = false;
    if let Ok(ports) = available_ports() {
        for port_info in ports {
            if port_info.port_name == port_name {
                is_decker = matches!(
                    port_info.port_type,
                    SerialPortType::UsbPort(ref info) if info.vid == 1240 && info.pid == 58918
                );
            }
        }
    }

    let port = serialport::new(port_name, baud_rate)
        .timeout(Duration::from_millis(20))
        .open();

    match port {
        Ok(mut port) => {
            info!("Connected to \"{}\"", port_name);
            if let Err(e) = port.write_data_terminal_ready(true) {
                // Not all serial endpoints support modem control lines (e.g. PTYs
                // used for virtual firmware testing), so don't abort the connection.
                warn!("Failed to set DTR to true: {}", e);
            }

            let (tx, rx): (mpsc::Sender<String>, mpsc::Receiver<String>) = mpsc::channel(); // Spawn a thread to handle incoming data
            let connected_port_name = port_name.to_owned();
            thread::spawn(move || {
                let mut serial_buf: Vec<u8> = vec![0; 100];
                let mut logged_device_info = false;
                if let Err(err) = window.emit(
                    "connection-change",
                    Payload {
                        message: "connected".to_string(),
                    },
                ) {
                    error!("Failed to emit connection-change event: {}", err);
                }
                loop {
                    if !SHOULD_RUN.load(Ordering::Relaxed) {
                        *SENDER.lock().unwrap() = None;
                        break;
                    }
                    match rx.try_recv() {
                        Ok(command) => {
                            debug!("Received: {:?}", command);
                            if command == "disconnect" {
                                if let Err(e) = port.write_data_terminal_ready(false) {
                                    error!("Failed to set DTR to false: {}", e);
                                }
                                if let Err(err) = window.emit(
                                    "connection-change",
                                    Payload {
                                        message: "disconnected".to_string(),
                                    },
                                ) {
                                    error!("Failed to emit connection-change event: {}", err);
                                }
                                std::mem::drop(port); // Drop the port to close it
                                *SENDER.lock().unwrap() = None;
                                info!("Disconnected");
                                break;
                            }
                            match serialize_decker_data(&command) {
                                Ok(serialized_data) => {
                                    match port.write(serialized_data.as_slice()) {
                                        Ok(t) => {
                                            debug!("Sent {} bytes", t);
                                        }
                                        Err(e) => {
                                            error!("Failed to write to serial port: {}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("Failed to serialize data: {}", e);
                                }
                            }
                        }
                        Err(_) => {}
                    }

                    match port.read(serial_buf.as_mut_slice()) {
                        Ok(t) => {
                            let received: Vec<u8> = serial_buf[..t].to_vec();
                            let messagepack_data = received;

                            match deserialize_slider_data(&messagepack_data, inverted) {
                                Ok(data) => {
                                    match data {
                                        DataType::Slider(slider_data) => {
                                            let json_data =
                                                match serde_json::to_string(&slider_data) {
                                                    Ok(json) => json,
                                                    Err(e) => {
                                                        error!(
                                                            "Failed to serialize slider data: {}",
                                                            e
                                                        );
                                                        return;
                                                    }
                                                };
                                            unsafe { decker::slider_values = slider_data }
                                            if let Err(e) = window.emit(
                                                "slider-change",
                                                Payload { message: json_data },
                                            ) {
                                                error!("Failed to emit slider-change event: {}", e);
                                            }
                                        }
                                        DataType::Device(device_data) => {
                                            if is_decker && !logged_device_info {
                                                warn!(
                                                    "Device connected on {}: model {}, firmware {}, serial {}",
                                                    connected_port_name,
                                                    device_data.device_model,
                                                    device_data.firmware_version,
                                                    device_data.serial_number
                                                );
                                                logged_device_info = true;
                                            }
                                            let json_data =
                                                match serde_json::to_string(&device_data) {
                                                    Ok(json) => json,
                                                    Err(e) => {
                                                        error!(
                                                            "Failed to serialize device data: {}",
                                                            e
                                                        );
                                                        return;
                                                    }
                                                };
                                            // Perform tasks specific to DeviceData
                                            if let Err(e) = window
                                                .emit("device-info", Payload { message: json_data })
                                            {
                                                error!("Failed to emit device-info event: {}", e);
                                            }
                                        }
                                    }
                                }
                                Err(_error) => {
                                    // Malformed frames are expected on a noisy serial line; ignore them.
                                }
                            };
                        }
                        Err(ref e) if e.kind() == io::ErrorKind::TimedOut => (),
                        Err(e) => {
                            if let Err(e) = port.write_data_terminal_ready(false) {
                                error!("Failed to set DTR to false: {}", e);
                            }
                            if let Err(err) = window.emit(
                                "connection-change",
                                Payload {
                                    message: "disconnected".to_string(),
                                },
                            ) {
                                error!("Failed to emit connection-change event: {}", err);
                            }
                            std::mem::drop(port); // Drop the port to close it
                            *SENDER.lock().unwrap() = None;
                            error!("An error occurred while reading serial data: {:?}", e);
                            break;
                        }
                    }
                    thread::sleep(Duration::from_millis(5));
                }
            });

            *SENDER.lock().unwrap() = Some(tx);
            if is_decker {
                send_decker_command("get-device-info", None);
            }

            Ok(())
        }
        Err(e) => {
            error!("Failed to open \"{}\". Error: {}", port_name, e);
            Err(e.into())
        }
    }
}

pub fn disconnect_decker() {
    let sender = match SENDER.lock() {
        Ok(s) => s,
        Err(e) => {
            error!("Failed to acquire SENDER lock: {}", e);
            return;
        }
    };
    if let Some(sender) = sender.as_ref() {
        if let Err(e) = sender.send("disconnect".to_owned()) {
            error!("Failed to send disconnect command: {}", e);
        }
    } else {
        error!("Sender not initialized. Make sure to initialize it before calling send_decker_command.");
    }
}

pub fn set_device_brightness(brightness: i32) {
    let opts = Options {
        effect: None,
        color: None,
        speed: None,
        brightness: Some(brightness),
    };
    send_decker_command("rgb-control", Some(opts));
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Command {
    pub command: String,
}

#[derive(Serialize, Deserialize)]
pub struct Options {
    effect: Option<String>,
    color: Option<String>,
    speed: Option<i32>,
    brightness: Option<i32>,
}

#[tauri::command]
pub fn send_decker_command(command: &str, options: Option<Options>) {
    // Serialize the command and options, then send them through the channel
    let sender = match SENDER.lock() {
        Ok(s) => s,
        Err(e) => {
            error!("Failed to acquire SENDER lock: {}", e);
            return;
        }
    };

    // Serialize the options using serde
    let options_str = match serde_json::to_string(&options) {
        Ok(s) => s,
        Err(e) => {
            error!("Failed to serialize options: {}", e);
            return;
        }
    };

    // Concatenate the command and options into a single string
    let payload = format!(
        r#"{{ "command": "{}", "options": {} }}"#,
        command, options_str
    );
    debug!("Sending: {}", payload);
    // Send the payload through the global sender
    if let Some(sender) = sender.as_ref() {
        if let Err(e) = sender.send(payload) {
            error!("Failed to send payload: {}", e);
        }
    } else {
        error!("Sender not initialized. Make sure to initialize it before calling send_decker_command.");
    }
}
