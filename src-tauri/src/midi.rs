pub mod midi {
    use crate::decker;
    use midir::{MidiOutput, MidiOutputConnection, MidiOutputPort};
    use std::error::Error;
    use std::thread;
    pub static mut ENABLED: bool = false;
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

    pub fn new(_name: &str, midi_output_port: u32) -> Result<(), Box<dyn Error>> {
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
        let mut conn_out: MidiOutputConnection = midi_out.connect(selected_output_port, "Decker SW Output")?;
    
        let thread_handle = thread::spawn(move || {
            loop {
                unsafe { 
                    if(!ENABLED) {
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
                    
                        if current_slider.checked_sub(2).map_or(false, |result| result > *previous_slider) ||
                        current_slider.checked_add(2).map_or(false, |result| result < *previous_slider) {
                            // println!("Slider {}: {}", i, current_slider);
                            // map current_slider to 0-127
                            let _ = conn_out.send(&[0xB0, i as u8, map_to_range(current_slider)]);
                            *previous_slider = current_slider;
                        }
                    }
                    
                }
                
            }
        });
    
        Ok(())
    }
}