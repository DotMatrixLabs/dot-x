use log::{error, info, warn};
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

// Upper bound for buffered bytes that never form a message (no terminator seen).
const MAX_PENDING_BYTES: usize = 4096;

// The firmware writes msgpack maps terminated by "\r\n", back to back. A single
// read can hold several messages or end mid-message, so decode from a buffer
// that carries the unfinished tail over to the next read.
fn drain_messages(buf: &mut Vec<u8>, inverted: bool) -> Vec<DataType> {
    let mut messages = Vec::new();
    loop {
        let start = buf
            .iter()
            .position(|b| *b != b'\r' && *b != b'\n')
            .unwrap_or(buf.len());
        buf.drain(..start);
        if buf.is_empty() {
            break;
        }

        let (result, consumed) = {
            let mut cursor = Cursor::new(buf.as_slice());
            let result = MessageData::deserialize(&mut Deserializer::new(&mut cursor));
            (result, cursor.position() as usize)
        };
        match result {
            Ok(message) => {
                buf.drain(..consumed);
                messages.push(to_data_type(message, inverted));
            }
            Err(
                rmp_serde::decode::Error::InvalidMarkerRead(ref e)
                | rmp_serde::decode::Error::InvalidDataRead(ref e),
            ) if e.kind() == io::ErrorKind::UnexpectedEof => break,
            Err(_) => match buf.iter().position(|b| *b == b'\n') {
                Some(end) => {
                    buf.drain(..=end);
                }
                None => {
                    if buf.len() > MAX_PENDING_BYTES {
                        buf.clear();
                    }
                    break;
                }
            },
        }
    }
    messages
}

fn to_data_type(message_data: MessageData, inverted: bool) -> DataType {
    match message_data {
        MessageData::Slider(mut slider_data) => {
            if inverted {
                slider_data.slider1 = 1023 - slider_data.slider1;
                slider_data.slider2 = 1023 - slider_data.slider2;
                slider_data.slider3 = 1023 - slider_data.slider3;
                slider_data.slider4 = 1023 - slider_data.slider4;
                slider_data.slider5 = 1023 - slider_data.slider5;
            }
            DataType::Slider(slider_data)
        }
        MessageData::Device(device_data) => DataType::Device(device_data),
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
            eprintln!("{:?}", e);
            eprintln!("Error listing serial ports");
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

fn emit_message(window: &WebviewWindow, data: DataType) {
    match data {
        DataType::Slider(slider_data) => {
            let json_data = match serde_json::to_string(&slider_data) {
                Ok(json) => json,
                Err(e) => {
                    error!("Failed to serialize slider data: {}", e);
                    return;
                }
            };
            unsafe { decker::slider_values = slider_data }
            if let Err(e) = window.emit("slider-change", Payload { message: json_data }) {
                error!("Failed to emit slider-change event: {}", e);
            }
        }
        DataType::Device(device_data) => {
            let json_data = match serde_json::to_string(&device_data) {
                Ok(json) => json,
                Err(e) => {
                    error!("Failed to serialize device data: {}", e);
                    return;
                }
            };
            if let Err(e) = window.emit("device-info", Payload { message: json_data }) {
                error!("Failed to emit device-info event: {}", e);
            }
        }
    }
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
        eprintln!("Port \"{}\" is already open. Closing it...", port_name);
        warn!("Port \"{}\" is already open. Closing it...", port_name);
        kill_decker_thread();
    }

    let port = serialport::new(port_name, baud_rate)
        .timeout(Duration::from_millis(20))
        .open();

    match port {
        Ok(mut port) => {
            println!("Connected to \"{}\"", port_name);
            info!("Connected to \"{}\"", port_name);
            if let Err(e) = port.write_data_terminal_ready(true) {
                // Not all serial endpoints support modem control lines (e.g. PTYs
                // used for virtual firmware testing), so don't abort the connection.
                warn!("Failed to set DTR to true: {}", e);
            }

            let (tx, rx): (mpsc::Sender<String>, mpsc::Receiver<String>) = mpsc::channel(); // Spawn a thread to handle incoming data
            thread::spawn(move || {
                let mut serial_buf: Vec<u8> = vec![0; 100];
                let mut pending: Vec<u8> = Vec::new();
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
                            println!("Received: {:?}", command);
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
                                            println!("Sent {} bytes", t);
                                        }
                                        Err(e) => {
                                            error!("Failed to write to serial port: {}", e);
                                            eprintln!("Failed to write to serial port: {}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("Failed to serialize data: {}", e);
                                    eprintln!("Failed to serialize data: {}", e);
                                }
                            }
                        }
                        Err(_) => {}
                    }

                    match port.read(serial_buf.as_mut_slice()) {
                        Ok(t) => {
                            pending.extend_from_slice(&serial_buf[..t]);
                            for data in drain_messages(&mut pending, inverted) {
                                emit_message(&window, data);
                            }
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

            Ok(())
        }
        Err(e) => {
            eprintln!("Failed to open \"{}\". Error: {}", port_name, e);
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
        eprintln!(
            "Sender not initialized. Make sure to initialize it before calling send_decker_command."
        );
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
    println!("Sending: {}", payload);
    // Send the payload through the global sender
    if let Some(sender) = sender.as_ref() {
        if let Err(e) = sender.send(payload) {
            error!("Failed to send payload: {}", e);
        }
    } else {
        eprintln!(
            "Sender not initialized. Make sure to initialize it before calling send_decker_command."
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Byte layout captured from a real Decker (firmware 0.0.3).
    const SLIDER_FRAME: &[u8] = b"\x85\xa7slider1\xcd\x02\x96\xa7slider2\x00\xa7slider3\x00\xa7slider4\x01\xa7slider5\x31\r\n";
    const DEVICE_FRAME: &[u8] = b"\x83\xacserialNumber\xa4test\xabdeviceModel\xa8VM-5SW-L\xaffirmwareVersion\xa50.0.3\r\n";

    fn kinds(messages: &[DataType]) -> Vec<&'static str> {
        messages
            .iter()
            .map(|m| match m {
                DataType::Slider(_) => "slider",
                DataType::Device(_) => "device",
            })
            .collect()
    }

    #[test]
    fn decodes_every_message_in_one_read() {
        let mut buf = [SLIDER_FRAME, DEVICE_FRAME, SLIDER_FRAME].concat();
        let messages = drain_messages(&mut buf, false);
        assert_eq!(kinds(&messages), ["slider", "device", "slider"]);
        assert!(buf.is_empty());
        match &messages[1] {
            DataType::Device(d) => {
                assert_eq!(d.device_model, "VM-5SW-L");
                assert_eq!(d.firmware_version, "0.0.3");
            }
            _ => unreachable!(),
        }
    }

    #[test]
    fn keeps_a_split_message_until_the_rest_arrives() {
        let stream = [SLIDER_FRAME, DEVICE_FRAME].concat();
        let split = SLIDER_FRAME.len() + 20;
        let mut buf = stream[..split].to_vec();
        assert_eq!(kinds(&drain_messages(&mut buf, false)), ["slider"]);
        assert!(!buf.is_empty());
        buf.extend_from_slice(&stream[split..]);
        assert_eq!(kinds(&drain_messages(&mut buf, false)), ["device"]);
        assert!(buf.is_empty());
    }

    #[test]
    fn resyncs_after_garbage() {
        let mut buf = [b"\xc1garbage\r\n".as_slice(), SLIDER_FRAME].concat();
        assert_eq!(kinds(&drain_messages(&mut buf, false)), ["slider"]);
        assert!(buf.is_empty());
    }

    #[test]
    fn applies_inversion() {
        let mut buf = SLIDER_FRAME.to_vec();
        match drain_messages(&mut buf, true).pop() {
            Some(DataType::Slider(s)) => assert_eq!(s.slider1, 1023 - 0x0296),
            _ => panic!("expected a slider message"),
        }
    }
}
