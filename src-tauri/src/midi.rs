pub mod midi {
    use crate::{decker, APP, get_app_handle};
    use midir::{MidiOutput, MidiOutputConnection, MidiOutputPort};
    use tauri::Manager;
    use std::error::Error;
    use std::thread;
    pub static mut ENABLED: bool = true;
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
        println!("midi_sliders: {:?}", midi_sliders);
        println!("midi_configuration: {:?}", midi_configuration);
        let mut Midi = Midi::new("Decker");
        let midi_out = MidiOutput::new("Decker Output")?;
        let output_ports = get_available_output_ports()?;
        if output_ports.is_empty() {
            eprintln!("No available MIDI output ports.");
        }
        if(output_ports.len() -1 < midi_output_port as usize) {
            eprintln!("The selected MIDI port doesn't exist.");
            Err("The selected MIDI port doesn't exist.")?;
        }
        let selected_output_port: &MidiOutputPort = &output_ports[midi_output_port as usize]; // Should be selectable by user
        let mut conn_out_result = midi_out.connect(selected_output_port, "Decker SW Output");
        let mut conn_out: MidiOutputConnection;
        match conn_out_result {
            Ok(conn) => {
                println!("Connection to {} successful", Midi.name);
                conn_out = conn;
                let thread_handle = thread::spawn(move || {
                    println!("starting midi thread");
                    loop {
                        unsafe { 
                            if !ENABLED {
                                println!("detaching midi thread");
                                let app_handle = get_app_handle();
                                app_handle.emit_all("midi_detached", {});
                                conn_out.close();
                                break;
                            }
                            // println!("Current slider values: {:?}", decker::decker::slider_values); 
                            for i in 1..=5 {
                                let current_slider = match i {
                                    1 => decker::decker::slider_values.slider1,
                                    2 => decker::decker::slider_values.slider2,
                                    3 => decker::decker::slider_values.slider3,
                                    4 => decker::decker::slider_values.slider4,
                                    5 => decker::decker::slider_values.slider5,
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
                                    if(midi_sliders.contains(&(i - 1))){ 
                                        // Filter the midi_configuration array to only include the current slider
                                        let filtered_vec: Vec<_> = midi_configuration
                                        .iter()
                                        .enumerate()
                                        .filter(|(index, _)| *index == i as usize - 1) // -1 because the sliders are 1 indexed here, but 0 indexed in the midi_configuration array coming from the frontend
                                        .map(|(_, tuple)| tuple.clone())
                                        .collect();
                                        let (channel, CCValue) = filtered_vec[0].clone(); // The filtered_vec should only contain one element, so we can safely unwrap it I think
                                        println!("channel: {:?}", channel);
                                        println!("CCValue: {:?}", CCValue);
                                        println!("filtered_vec: {:?}", filtered_vec);
                                        let CCValueParsed = u8::from_str_radix(&CCValue, 16).unwrap();
                                        if let Ok(parsed_value) = u8::from_str_radix(&CCValue, 16) {
                                            println!("Parsed value as u8: {}", parsed_value);
                                        } else {
                                            println!("Failed to parse the hexadecimal string");
                                        }
                                        let _ = conn_out.send(&[CCValueParsed, channel.parse::<u8>().unwrap(), map_to_range(current_slider)]);
                                    }
                                    *previous_slider = current_slider;
                                }
                            }
                            
                        }
                        
                    }
                });

            }
            Err(e) => {
                println!("Connection to {} failed: {:?}", Midi.name, e);
                conn_out_result = Err(e);
            }
        }

        println!("Midi initialized");
        Ok(())
    }
}