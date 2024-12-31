pub mod midi {
    use crate::{decker, get_app_handle};
    use log::{debug, error, info, trace};
    use midir::{MidiOutput, MidiOutputConnection, MidiOutputPort};
    use tauri::Manager;
    use std::error::Error;
    use std::thread;
    use std::time::Duration;
    use std::sync::atomic::{AtomicBool, Ordering};
    pub static ENABLED: AtomicBool = AtomicBool::new(false);
    pub struct Midi {
        pub name: String,
        previous_slider1: u32,
        previous_slider2: u32,
        previous_slider3: u32,
        previous_slider4: u32,
        previous_slider5: u32,
    }

    // Implement the Midi struct here.
    impl Midi {
        pub fn new(name: &str) -> Midi {
            Midi {
                name: name.to_string(),
                previous_slider1: 0,
                previous_slider2: 0,
                previous_slider3: 0,
                previous_slider4: 0,
                previous_slider5: 0,
            }
        }
    }   

    fn map_to_range(input: u32) -> u8 {
        // Ensure that the input is within the 0-1023 range
        let clamped_input = input.min(1023);
    
        // Map the clamped input to the 0-127 range
        let mapped_value = (clamped_input as f64 / 1023.0 * 127.0).round() as u8;
    
        mapped_value
    }

    pub fn get_available_output_ports() -> Result<Vec<MidiOutputPort>, Box<dyn Error>> {
        let mut available_ports: Vec<MidiOutputPort> = Vec::new();
        let ports = midir::MidiOutput::new("midir reading input")?.ports();
        for port in ports {
            available_ports.push(port);
        }
        Ok(available_ports)
    }

    pub fn new(_name: &str, midi_output_port: u32, midi_sliders: Vec<i32>, midi_configuration: Vec<(String, String)>) -> Result<(), Box<dyn Error>> {
        let mut Midi = Midi::new("Decker");
        let midi_out = MidiOutput::new("Decker Output")?;
        let output_ports = get_available_output_ports()?;
        if output_ports.is_empty() {
            error!("No available MIDI output ports.");
        }
        if output_ports.len() -1 < midi_output_port as usize {
            eprintln!("The selected MIDI port doesn't exist.");
            Err("The selected MIDI port doesn't exist.")?;
        }
        let selected_output_port: &MidiOutputPort = &output_ports[midi_output_port as usize]; // Should be selectable by user
        let mut conn_out_result = midi_out.connect(selected_output_port, "Decker SW Output");
        let mut conn_out: MidiOutputConnection;
        match conn_out_result {
            Ok(conn) => {
                debug!("Connection to {} successful", Midi.name);
                conn_out = conn;
                let _thread_handle = thread::spawn(move || {
                    debug!("starting midi thread");
                    loop {
                        if !ENABLED.load(Ordering::SeqCst) {
                            debug!("detaching midi thread");
                            let app_handle = get_app_handle();
                            app_handle.emit_all("midi_detached", {});
                            conn_out.close();
                            break;
                        }
                        // println!("Current slider values: {:?}", decker::decker::slider_values); 
                        for i in 1..=5 {
                            let current_slider = match i {
                                1 => unsafe { decker::decker::slider_values.slider1 },
                                2 => unsafe { decker::decker::slider_values.slider2 },
                                3 => unsafe { decker::decker::slider_values.slider3 },
                                4 => unsafe { decker::decker::slider_values.slider4 },
                                5 => unsafe { decker::decker::slider_values.slider5 },
                                _ => unreachable!(), // Should never happen
                            };
                        
                            let previous_slider = match i {
                                1 => &mut Midi.previous_slider1,
                                2 => &mut Midi.previous_slider2,
                                3 => &mut Midi.previous_slider3,
                                4 => &mut Midi.previous_slider4,
                                5 => &mut Midi.previous_slider5,
                                _ => unreachable!(), // Should never happen
                            };
                            
                            // Check if the slider has moved more than 2 units, prevents jitter
                            if current_slider.checked_sub(2).map_or(false, |result| result > *previous_slider) ||
                            current_slider.checked_add(2).map_or(false, |result| result < *previous_slider) {
                                // Check if the slider is MIDI enabled, -1 because the sliders are 1 indexed here, but 0 indexed in the midi_sliders array coming from the frontend
                                if midi_sliders.contains(&(i - 1)) { 
                                    // Filter the midi_configuration array to only include the current slider
                                    let CCValueParsed: u8;
                                    let channel: u8;
                                    if let Some(_element) = midi_configuration.get(i as usize - 1) {
                                        let filtered_vec: Vec<_> = midi_configuration
                                        .iter()
                                        .enumerate()
                                        .filter(|(index, _)| *index == i as usize - 1) // -1 because the sliders are 1 indexed here, but 0 indexed in the midi_configuration array coming from the frontend
                                        .map(|(_, tuple)| tuple.clone())
                                        .collect();
                                        let (channelFromTuple, CCValueFromTuple) = filtered_vec[0].clone(); // The filtered_vec should only contain one element, so we can safely unwrap it I think
                                        if channelFromTuple == "" {
                                            trace!("channelFromTuple is empty, setting to default {}", i);
                                            channel = i as u8;
                                        } else {
                                            trace!("channelFromTuple is not empty, parsing to u8");
                                            channel = channelFromTuple.parse::<u8>().unwrap();
                                        }

                                        if CCValueFromTuple == "" {
                                            trace!("CCValueFromTuple is empty, setting to default CC value 07");
                                            CCValueParsed = 7;
                                        } else {
                                            trace!("CCValueFromTuple is not empty, parsing to u8/hex");
                                            CCValueParsed = u8::from_str_radix(&CCValueFromTuple, 10).unwrap();
                                        }
                                    } else {
                                        trace!("MIDI Configuration doesn't exist for slider {}, setting to default CC value 07 and channel {}", i, i);
                                        CCValueParsed = 7;
                                        channel = i as u8;
                                    }
                                    println!("Sending MIDI message: {:?} {:?} {:?}", CCValueParsed, channel, map_to_range(current_slider));
                                    let _ = conn_out.send(&[0xB0 | (channel - 1 & 0x0F), CCValueParsed, map_to_range(current_slider)]);
                                }
                                *previous_slider = current_slider;
                            }
                        }
                        
                    }
                    // Add a small sleep duration to reduce CPU usage
                    thread::sleep(Duration::from_millis(50));
                });

            }
            Err(e) => {
                println!("Connection to {} failed: {:?}", Midi.name, e);
                conn_out_result = Err(e);
            }
        }

        info!("Midi initialized");
        Ok(())
    }
}