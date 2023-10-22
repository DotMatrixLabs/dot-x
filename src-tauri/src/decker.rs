use firmata_rs::*;
use serialport::*;
use std::{thread::{self, sleep}, time::Duration};


pub fn list_ports() {
    let ports = serialport::available_ports().expect("No ports found!");
    for p in ports {
        println!("{}", p.port_name);
    }
}

pub fn initialize_decker() {
    let mut arduino = serialport::new("COM3", 9600).open().expect("Failed to open port");

    // Create a buffer to store the received data
    let mut buffer: Vec<u8> = vec![0; 16];  // Adjust the buffer size as needed

    loop {
        match arduino.read(buffer.as_mut_slice()) {
            Ok(t) => {
                // Print the received data as a UTF-8 string
                if t > 0 {
                    let received_data = &buffer[..t];
                    if let Ok(text) = std::str::from_utf8(received_data) {
                        println!("From Arduino: {}", text);
                    }
                }
            },
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => (),
            Err(e) => eprintln!("{:?}", e),
        }
    }
}

