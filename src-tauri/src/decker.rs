use firmata_rs::*;
use serialport::*;
use std::{thread::{self, sleep}, time::Duration, result};
use std::io::{self, Write};

use clap::{Arg, Command};
use tauri::{Manager, Window};

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



pub fn initialize_decker(window: Window) -> std::result::Result<(), std::io::Error> {
    let port_name = "COM6";
    let baud_rate = 9600;

    let port = serialport::new(port_name, baud_rate)
        .timeout(Duration::from_millis(10))
        .open();

    match port {
        Ok(mut port) => {
            // Spawn a thread to handle incoming data
            thread::spawn(move || {
                let mut serial_buf: Vec<u8> = vec![0; 50];
                loop {
                    match port.read(serial_buf.as_mut_slice()) {
                        Ok(t) => {
                            let received = String::from_utf8_lossy(&serial_buf[..t]).to_string();
                            println!("{}", received);
                            window.emit("slider-change", Payload { message: received }).unwrap();
                        }
                        Err(ref e) if e.kind() == io::ErrorKind::TimedOut => (),
                        Err(e) => {
                            eprintln!("{:?}", e);
                            break;
                        }
                    }
                    thread::sleep(Duration::from_millis(50));
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
