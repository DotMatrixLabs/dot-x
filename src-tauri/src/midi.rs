pub mod midi {
    use midir::MidiOutput;
    
    // Define the Midi struct here and make sure it is public.
    pub struct Midi {
        name: String,
    }

    // Change the return type to a Result.
    pub fn new(name: &str) -> Result<Midi, midir::InitError> {
        let port = MidiOutput::new(name);
        
        match port {
            Ok(_) => {
                println!("Midi port");
                // Create and return an instance of Midi in the Ok branch.
                Ok(Midi { name: name.to_string() })
            }
            Err(error) => {
                // Handle the error here, or return it if you prefer.
                Err(error)
            }
        }
    }
}