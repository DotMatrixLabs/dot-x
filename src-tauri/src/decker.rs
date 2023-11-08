use std::{thread::{self, sleep}, time::Duration};
use std::io::{self, Cursor, Read};
use serde::{Serialize, Deserialize};
use serde_json;
use rmp_serde::{Deserializer};
use std::collections::BTreeMap;
use serde::ser::SerializeMap;
use tauri::Window;
use serialport::{available_ports, SerialPortType};

#[derive(Clone, serde::Serialize)]
struct Payload {
  message: String,
}

// Define a struct to match the JSON structure
#[derive(Debug)]
struct SliderData {
    slider1: u32,
    slider2: u32,
    slider3: u32,
    slider4: u32,
    slider5: u32,
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

fn deserialize_slider_data(data: &[u8]) -> std::result::Result<SliderData, Box<dyn std::error::Error>> {
    // Create a cursor for the data source
    let cursor = Cursor::new(data);

    // Deserialize MessagePack data to the SliderData struct
    let mut deserializer = Deserializer::new(cursor);
    let slider_data: SliderData = Deserialize::deserialize(&mut deserializer)?;

    Ok(slider_data)
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
            eprintln!("{:?}", e);
            eprintln!("Error listing serial ports");
        }
    }

    usb_devices // Return the vector of USB devices
}





pub fn initialize_decker(window: Window) -> std::result::Result<(), std::io::Error> {
    let port_name: &str = "COM6";
    let baud_rate: u32 = 115_200;

    let port = serialport::new(port_name, baud_rate)
        .timeout(Duration::from_millis(10))
        .open();

    match port {
        Ok(mut port) => {
            // Spawn a thread to handle incoming data
            thread::spawn(move || {
                let mut serial_buf: Vec<u8> = vec![0; 100];
                loop {
                    match port.read(serial_buf.as_mut_slice()) {
                        Ok(t) => {
                            let received: Vec<u8> = serial_buf[..t].to_vec();
                            let messagepack_data = received;

                            match deserialize_slider_data(&messagepack_data) {
                                Ok(slider_data) => {
                                    let json_data = serde_json::to_string(&slider_data).unwrap();
                                    window.emit("slider-change", Payload { message: json_data }).unwrap();
                                }
                                Err(error) => {
                                    // eprintln!("Deserialization failed: {}", error);
                                }
                            };
                        }
                        Err(ref e) if e.kind() == io::ErrorKind::TimedOut => (),
                        Err(e) => {
                            eprintln!("{:?}", e);
                            break;
                        }
                    }
                    thread::sleep(Duration::from_millis(5));
                }
            });

            Ok(())

        }
        Err(e) => {
            eprintln!("Failed to open \"{}\". Error: {}", port_name, e);
            Err(e.into())
        }
    }
}
