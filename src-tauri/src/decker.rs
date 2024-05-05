use std::{thread::{self}, time::Duration, sync::{mpsc, Mutex}};
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

impl<'de> Deserialize<'de> for SliderData {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let map: BTreeMap<String, u32> = Deserialize::deserialize(deserializer)?;
        Ok(SliderData {
            slider1: *map.get("slider1").unwrap_or(&0),
            slider2: *map.get("slider2").unwrap_or(&0),
            slider3: *map.get("slider3").unwrap_or(&0),
            slider4: *map.get("slider4").unwrap_or(&0),
            slider5: *map.get("slider5").unwrap_or(&0),
        })
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

fn deserialize_slider_data(data: &[u8], inverted: bool) -> std::result::Result<SliderData, Box<dyn std::error::Error>> {
    // Create a cursor for the data source
    let cursor = Cursor::new(data);

    // Deserialize MessagePack data to the SliderData struct
    let mut deserializer = Deserializer::new(cursor);
    let slider_data: SliderData = Deserialize::deserialize(&mut deserializer)?;
    // println!("Inverted: {:?}", inverted);
    if inverted {
        Ok(SliderData {
            slider1: 1023 - slider_data.slider1,
            slider2: 1023 - slider_data.slider2,
            slider3: 1023 - slider_data.slider3,
            slider4: 1023 - slider_data.slider4,
            slider5: 1023 - slider_data.slider5,
        })
    } else {
        Ok(slider_data)
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

pub fn list_ports() {
    let ports = serialport::available_ports().expect("No ports found!");
    for p in ports {
        println!("{}", p.port_name);
    }
}

#[derive(serde::Serialize)]
pub struct Device {
    port_name: String,
    port_type: String,
    vid: u16,
    pid: u16,
    serial_number: String,
    manufacturer: String,
    product: String,
}

#[tauri::command]
pub fn get_devices() -> Vec<Device> {
    let mut usb_devices = Vec::new();  // Create an empty vector to store USB devices

    match available_ports() {
        Ok(ports) => {
            for p in ports {
                match p.port_type {
                    SerialPortType::UsbPort(info) => {
                        let device = Device {
                            port_name: p.port_name.clone(),
                            port_type: "USB".to_string(),
                            vid: info.vid,
                            pid: info.pid,
                            serial_number: info.serial_number.as_ref().map_or("", String::as_str).to_string(),
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

pub fn initialize_decker(window: Window, port_name: &str, inverted: bool) -> std::result::Result<(), std::io::Error> {
    let baud_rate: u32 = 115_200;

    // Check if the connection is already open and close it if it is.
    if let Ok(ports) = available_ports() {
        for port_info in ports {
            if port_info.port_name == port_name {
                eprintln!("Port \"{}\" is already open. Closing it...", port_name);
                warn!("Port \"{}\" is already open. Closing it...", port_name);
                if let Ok(port) = serialport::new(port_name, baud_rate).timeout(Duration::from_millis(20)).open() {
                    std::mem::drop(port);
                }
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
            let (tx, rx): (mpsc::Sender<String>, mpsc::Receiver<String>) = mpsc::channel();            // Spawn a thread to handle incoming data
            thread::spawn(move || {
                let mut serial_buf: Vec<u8> = vec![0; 100];
                window.emit("connection-change", Payload { message: "connected".to_string() }).unwrap();
                loop {
                    match rx.try_recv() {
                        Ok(command) => {
                            println!("Received: {:?}", command);
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
                                Ok(slider_data) => {
                                    let json_data = serde_json::to_string(&slider_data).unwrap();
                                    unsafe { decker::slider_values = slider_data }
                                    window.emit("slider-change", Payload { message: json_data }).unwrap();
                                }
                                Err(_error) => {
                                    // eprintln!("Deserialization failed: {}", error);
                                }
                            };
                        }
                        Err(ref e) if e.kind() == io::ErrorKind::TimedOut => (),
                        Err(e) => {
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

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Command {
    pub command: String,
}


#[derive(Serialize, Deserialize)]
pub struct Options {
    r: i32,
    g: i32,
    b: i32
}

#[tauri::command]
pub fn send_decker_command(command: &str, options: Options) {
    // Serialize the command and options, then send them through the channel
    let sender = SENDER.lock().unwrap();

    // Serialize the options using serde
    let options_str = serde_json::to_string(&options).unwrap();

    // Concatenate the command and options into a single string
    let payload = format!(r#"{{ "command": "{}", "options": {} }}"#, command, options_str);
    println!("Sending: {}", payload);
    // Send the payload through the global sender
    if let Some(sender) = sender.as_ref() {
        sender.send(payload).unwrap();
    } else {
        eprintln!("Sender not initialized. Make sure to initialize it before calling send_decker_command.");
    }
}