use firmata_rs::*;
use serialport::*;
use std::{thread::{self, sleep}, time::Duration};
use std::io::{self, Write};

use clap::{Arg, Command};
use tauri::Manager;

#[derive(Clone, serde::Serialize)]
struct Payload {
  message: String,
}

pub static mut values: String = String::new();

//TODO: https://tauri.app/v1/guides/features/events/
// To subscribe to slider changes in frontend and emit changes from backend when values from sliders update.

pub fn list_ports() {
    let ports = serialport::available_ports().expect("No ports found!");
    for p in ports {
        println!("{}", p.port_name);
    }
}
pub fn initialize_decker() {

    let port_name = "COM4";
    let baud_rate = 9600;

    let port = serialport::new(port_name, baud_rate)
        .timeout(Duration::from_millis(10))
        .open();

    match port {
        Ok(mut port) => {
        
            let mut serial_buf: Vec<u8> = vec![0; 50];
            println!("Receiving data on {} at {} baud", &port_name, &baud_rate);
            loop {
                match port.read(serial_buf.as_mut_slice()) {
                    // Ok(t) => io::stdout().write_all(&serial_buf[..t]).unwrap(),
                    Ok(t) => {
                        let received = String::from_utf8_lossy(&serial_buf[..t]).to_string();
                        if((received.ends_with("\r\n") && received.matches(",").count() == 4)) {
                            unsafe {
                                values = received;
                            }
                        }
                    },
                    Err(ref e) if e.kind() == io::ErrorKind::TimedOut => (),
                    Err(e) => eprintln!("{:?}", e),
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to open \"{}\". Error: {}", port_name, e);
        }   
    }
}
pub fn update_sliders() -> String {
    unsafe {
        sleep(Duration::from_millis(10));
        return values.to_string();
    }
}


