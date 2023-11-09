pub mod midi {
    use crate::decker;
    use midir::{MidiOutput, MidiOutputConnection, MidiOutputPort};
    use std::error::Error;
    // Define the Midi struct here and make sure it is public.
    pub struct Midi {
        name: String,
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


    // pub fn new(name: &str, midi_port: MidiOutputPort) -> Result<(), Box<dyn Error>> {
    pub fn new(_name: &str) -> Result<(), Box<dyn Error>> {
        let mut Midi = Midi::new("Decker");
        let midi_out  = MidiOutput::new("Decker Output")?;
        let output_ports = get_available_output_ports()?;

        if output_ports.is_empty() {
            eprintln!("No available MIDI output ports.");
        }
        let selected_output_port: &MidiOutputPort = &output_ports[1]; // Should be selectable by user
        // let mut conn_out: MidiOutputConnection = midi_out.connect(&midi_port, "Decker SW Output")?;
        let mut conn_out: MidiOutputConnection = midi_out.connect(&selected_output_port, "Decker SW Output")?;
        // Take slider_values, deserialize it, and put it into a struct
        // let slider_data = decker::deserialize_slider_data(slider_values.as_bytes())?;
        // println!("Slider data: {:?}", slider_data);
        // Print slider values from the SliderData struct
        //do this in new thread
        std::thread::spawn(move || {    
        
        loop {
            unsafe { 
                // println!("Current slider values: {:?}", decker::decker::slider_values); 
                if decker::decker::slider_values.slider1 > Midi.previous_slider1 + 2 || decker::decker::slider_values.slider1 < Midi.previous_slider1 - 2 {
                    // println!("Slider 1: {}", decker::decker::slider_values.slider1);
                    // map decker::decker::slider_values.slider1 to 0-127
                    let _ = conn_out.send(&[0xB0, 0x01, map_to_range(decker::decker::slider_values.slider1)]);
                    Midi.previous_slider1 = decker::decker::slider_values.slider1;
                }
                if decker::decker::slider_values.slider2 > Midi.previous_slider2 + 2 || decker::decker::slider_values.slider2 < Midi.previous_slider2 - 2 {
                    // println!("Slider 2: {}", decker::decker::slider_values.slider2);
                    // map decker::decker::slider_values.slider2 to 0-127
                    let _ = conn_out.send(&[0xB0, 0x02, map_to_range(decker::decker::slider_values.slider2)]);
                    Midi.previous_slider2 = decker::decker::slider_values.slider2;
                }
                if decker::decker::slider_values.slider3 > Midi.previous_slider3 + 2 || decker::decker::slider_values.slider3 < Midi.previous_slider3 - 2 {
                    // println!("Slider 3: {}", decker::decker::slider_values.slider3);
                    // map decker::decker::slider_values.slider3 to 0-127
                    let _ = conn_out.send(&[0xB0, 0x03, map_to_range(decker::decker::slider_values.slider3)]);
                    Midi.previous_slider3 = decker::decker::slider_values.slider3;
                }
                if decker::decker::slider_values.slider4 > Midi.previous_slider4 + 2 || decker::decker::slider_values.slider4 < Midi.previous_slider4 - 2 {
                    // println!("Slider 4: {}", decker::decker::slider_values.slider4);
                    // map decker::decker::slider_values.slider4 to 0-127
                    let _ = conn_out.send(&[0xB0, 0x04, map_to_range(decker::decker::slider_values.slider4)]);
                    Midi.previous_slider4 = decker::decker::slider_values.slider4;
                }
                if decker::decker::slider_values.slider5 > Midi.previous_slider5 + 2 || decker::decker::slider_values.slider5 < Midi.previous_slider5 - 2 {
                    // println!("Slider 5: {}", decker::decker::slider_values.slider5);
                    // map decker::decker::slider_values.slider5 to 0-127
                    let _ = conn_out.send(&[0xB0, 0x05, map_to_range(decker::decker::slider_values.slider5)]);
                    Midi.previous_slider5 = decker::decker::slider_values.slider5;
                }
                
            }
            
        }

        
        
        // Now you can send MIDI messages
        // For example, send a Note On message
        let channel = 1; // MIDI channel (0-15)
        let note = 60;  // Note number (C4)
        let velocity = 64; // Velocity (0-127)
        conn_out.send(&[0x90 | channel, note, velocity]);
        
        // Send a Note Off message after a delay (you can adjust the delay as needed)
        std::thread::sleep(std::time::Duration::from_millis(500));
        conn_out.send(&[0x80 | channel, note, 0]);
    });

            Ok(())
            // Ok(Midi { name: name.to_string() })
        }
}    