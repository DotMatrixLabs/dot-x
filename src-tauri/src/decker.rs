use std::{thread::{self}, time::Duration, sync::{Arc, mpsc, Mutex}};
use std::sync::atomic::{AtomicBool, Ordering};
use std::io::{self, Cursor, Read};
use log::{error, warn, info};
use serde::{Serialize, Deserialize};
use serde_json;
use rmp_serde::{Deserializer, Serializer};
use std::collections::BTreeMap;
use serde::ser::SerializeMap;
use tauri::Window;
use serialport::{available_ports, SerialPortType};
use serde_json::Value;
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

#[derive(Debug)]
#[derive(Serialize)]
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
            let device_data = serde_json::from_value::<DeviceData>(value).map_err(serde::de::Error::custom)?;
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


fn deserialize_slider_data(data: &[u8], inverted: bool) -> std::result::Result<DataType, Box<dyn std::error::Error>> {
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
        MessageData::Device(device_data) => {
            Ok(DataType::Device(device_data))
        }
    }
}


fn serialize_decker_data(json_string: &str) -> std::result::Result<Vec<u8>, Box<dyn std::error::Error>> {
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

#[tauri::command]
pub fn get_devices() -> Vec<USBDevice> {
    let mut usb_devices = Vec::new();  // Create an empty vector to store USB devices

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
                            manufacturer: info.manufacturer.as_ref().map_or("", String::as_str).to_string(),
                            product: info.product.as_ref().map_or("", String::as_str).to_string(),
                        };
                        usb_devices.push(device);  // Add the USB device to the vector
                    }
                    _ => {}  // Ignore non-USB ports
                }
            }
        }
        Err(e) => {
            error!("Error listing serial ports - {:?}", e);
            eprintln!("{:?}", e);
            eprintln!("Error listing serial ports");
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

pub fn initialize_decker(window: Window, port_name: &str, inverted: bool) -> std::result::Result<(), std::io::Error> {
    let baud_rate: u32 = 115_200;

    // Check if the connection is already open and close it if it is.
    if let Ok(ports) = available_ports() {
        for port_info in ports {
            if port_info.port_name == port_name {
                eprintln!("Port \"{}\" is already open. Closing it...", port_name);
                warn!("Port \"{}\" is already open. Closing it...", port_name);
                kill_decker_thread();
            }
        }
    }

    let port = serialport::new(port_name, baud_rate)
        .timeout(Duration::from_millis(20))
        .open();

    match port {
        Ok(mut port) => {
            println!("Connected to \"{}\"", port_name);
            info!("Connected to \"{}\"", port_name);
            if let Err(e) = port.write_data_terminal_ready(true) {
                error!("Failed to set DTR to true: {}", e);
                return Err(e.into());
            }

            let (tx, rx): (mpsc::Sender<String>, mpsc::Receiver<String>) = mpsc::channel();            // Spawn a thread to handle incoming data
            thread::spawn(move || {
                let mut serial_buf: Vec<u8> = vec![0; 100];
                window.emit("connection-change", Payload { message: "connected".to_string() }).unwrap();
                loop {
                    if(!SHOULD_RUN.load(Ordering::Relaxed)) {
                        break;
                    }
                    match rx.try_recv() {
                        Ok(command) => {
                            println!("Received: {:?}", command);
                            if command == "disconnect" {
                                if let Err(e) = port.write_data_terminal_ready(false) {
                                    error!("Failed to set DTR to false: {}", e);
                                }
                                window.emit("connection-change", Payload { message: "disconnected".to_string() }).unwrap();
                                std::mem::drop(port); // Drop the port to close it
                                info!("Disconnected");
                                panic!("Disconnected");
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
                            let received: Vec<u8> = serial_buf[..t].to_vec();
                            let messagepack_data = received;

                            match deserialize_slider_data(&messagepack_data, inverted) {
                                Ok(data) => {
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
                                            // Perform tasks specific to DeviceData
                                            if let Err(e) = window.emit("device-info", Payload { message: json_data }) {
                                                error!("Failed to emit device-info event: {}", e);
                                            }
                                        }
                                    }
                                }
                                Err(_error) => {
                                    // Handle the error case
                                    // eprintln!("Deserialization failed: {}", error);
                                }
                            };
                        }
                        Err(ref e) if e.kind() == io::ErrorKind::TimedOut => (),
                        Err(e) => {
                            if let Err(e) = port.write_data_terminal_ready(false) {
                                error!("Failed to set DTR to false: {}", e);
                            }
                            window.emit("connection-change", Payload { message: "disconnected".to_string() }).unwrap();
                            std::mem::drop(port); // Drop the port to close it
                            error!("An error occurred while reading serial data: {:?}", e);
                            panic!("An error occurred while reading serial data: {:?}", e);
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
        sender.send("disconnect".to_owned()).unwrap();
    } else {
        eprintln!("Sender not initialized. Make sure to initialize it before calling send_decker_command.");
    }
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
    let payload = format!(r#"{{ "command": "{}", "options": {} }}"#, command, options_str);
    println!("Sending: {}", payload);
    // Send the payload through the global sender
    if let Some(sender) = sender.as_ref() {
        if let Err(e) = sender.send(payload) {
            error!("Failed to send payload: {}", e);
        }
    } else {
        eprintln!("Sender not initialized. Make sure to initialize it before calling send_decker_command.");
    }
}