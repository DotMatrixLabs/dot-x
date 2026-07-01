pub mod midi {
    use crate::{decker, get_app_handle};
    use log::{debug, error, info, trace};
    use midir::{MidiOutput, MidiOutputConnection, MidiOutputPort};
    #[cfg(unix)]
    use midir::os::unix::VirtualOutput;
    use std::error::Error;
    use std::thread;
    use std::time::Duration;
    use tauri::Emitter;

    pub const VIRTUAL_OUTPUT_PORT_NAME: &str = "Dot X Virtual MIDI";
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

    fn parse_midi_configuration(
        slider_index: usize,
        midi_configuration: &[(String, String)],
    ) -> Result<(u8, u8), Box<dyn Error>> {
        if let Some((channel_from_tuple, cc_value_from_tuple)) =
            midi_configuration.get(slider_index)
        {
            let channel = if channel_from_tuple.is_empty() {
                trace!(
                    "channelFromTuple is empty, setting to default {}",
                    slider_index + 1
                );
                slider_index as u8 + 1
            } else {
                trace!("channelFromTuple is not empty, parsing to u8");
                channel_from_tuple.parse::<u8>()?
            };

            let cc_value = if cc_value_from_tuple.is_empty() {
                trace!("CCValueFromTuple is empty, setting to default CC value 07");
                7
            } else {
                trace!("CCValueFromTuple is not empty, parsing to u8/hex");
                u8::from_str_radix(cc_value_from_tuple, 10)?
            };

            Ok((channel, cc_value))
        } else {
            trace!(
                "MIDI Configuration doesn't exist for slider {}, setting to default CC value 07 and channel {}",
                slider_index + 1,
                slider_index + 1
            );
            Ok((slider_index as u8 + 1, 7))
        }
    }

    fn control_change_message(
        slider_index: usize,
        slider_value: u32,
        midi_configuration: &[(String, String)],
    ) -> Result<[u8; 3], Box<dyn Error>> {
        let (channel, cc_value) = parse_midi_configuration(slider_index, midi_configuration)?;
        if !(1..=16).contains(&channel) {
            Err("MIDI channel must be between 1 and 16")?;
        }

        Ok([
            0xB0 | ((channel - 1) & 0x0F),
            cc_value,
            map_to_range(slider_value),
        ])
    }

    #[cfg(unix)]
    fn is_virtual_output_port(port_count: usize, midi_output_port: u32) -> bool {
        midi_output_port as usize == port_count
    }

    #[cfg(not(unix))]
    fn is_virtual_output_port(_port_count: usize, _midi_output_port: u32) -> bool {
        false
    }

    pub fn get_available_output_ports() -> Result<Vec<MidiOutputPort>, Box<dyn Error>> {
        let mut available_ports: Vec<MidiOutputPort> = Vec::new();
        let ports = midir::MidiOutput::new("midir reading input")?.ports();
        for port in ports {
            available_ports.push(port);
        }
        Ok(available_ports)
    }

    fn connect_output(
        midi_out: MidiOutput,
        output_ports: &[MidiOutputPort],
        midi_output_port: u32,
    ) -> Result<MidiOutputConnection, Box<dyn Error>> {
        if is_virtual_output_port(output_ports.len(), midi_output_port) {
            #[cfg(unix)]
            {
                return midi_out
                    .create_virtual(VIRTUAL_OUTPUT_PORT_NAME)
                    .map_err(|error| Box::new(error) as Box<dyn Error>);
            }

            #[cfg(not(unix))]
            {
                Err("Virtual MIDI output is only supported on Unix platforms")?;
            }
        }

        if output_ports.len() <= midi_output_port as usize {
            Err("The selected MIDI port doesn't exist.")?;
        }

        let selected_output_port: &MidiOutputPort = &output_ports[midi_output_port as usize];
        midi_out
            .connect(selected_output_port, "Decker SW Output")
            .map_err(|error| Box::new(error) as Box<dyn Error>)
    }

    pub fn new(
        _name: &str,
        midi_output_port: u32,
        midi_sliders: Vec<i32>,
        midi_configuration: Vec<(String, String)>,
    ) -> Result<(), Box<dyn Error>> {
        let mut midi = Midi::new("Decker");
        let midi_out = MidiOutput::new("Decker Output")?;
        let output_ports = get_available_output_ports()?;
        if output_ports.is_empty()
            && !is_virtual_output_port(output_ports.len(), midi_output_port)
        {
            error!("No available MIDI output ports.");
        }
        match connect_output(midi_out, &output_ports, midi_output_port) {
            Ok(conn) => {
                debug!("Connection to {} successful", midi.name);
                let mut conn_out: MidiOutputConnection = conn;
                let _thread_handle = thread::spawn(move || {
                    debug!("starting midi thread");
                    loop {
                        unsafe {
                            if !ENABLED {
                                debug!("detaching midi thread");
                                let app_handle = get_app_handle();
                                if let Err(err) = app_handle.emit("midi_detached", {}) {
                                    log::error!(
                                        "Failed to emit midi_detached event from MidiController: {}",
                                        err
                                    );
                                }
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
                                    1 => &mut midi.previous_slider1,
                                    2 => &mut midi.previous_slider2,
                                    3 => &mut midi.previous_slider3,
                                    4 => &mut midi.previous_slider4,
                                    5 => &mut midi.previous_slider5,
                                    _ => unreachable!(), // Should never happen
                                };

                                // Check if the slider has moved more than 2 units, prevents jitter
                                if current_slider
                                    .checked_sub(2)
                                    .map_or(false, |result| result > *previous_slider)
                                    || current_slider
                                        .checked_add(2)
                                        .map_or(false, |result| result < *previous_slider)
                                {
                                    // Check if the slider is MIDI enabled, -1 because the sliders are 1 indexed here, but 0 indexed in the midi_sliders array coming from the frontend
                                    if midi_sliders.contains(&(i - 1)) {
                                        let message = match control_change_message(
                                            i as usize - 1,
                                            current_slider,
                                            &midi_configuration,
                                        ) {
                                            Ok(message) => message,
                                            Err(error) => {
                                                error!(
                                                    "Failed to build MIDI CC message for slider {}: {}",
                                                    i, error
                                                );
                                                continue;
                                            }
                                        };
                                        println!("Sending MIDI message: {:?}", message);
                                        let _ = conn_out.send(&message);
                                    }
                                    *previous_slider = current_slider;
                                }
                            }
                        }
                        // Add a small sleep duration to reduce CPU usage
                        thread::sleep(Duration::from_millis(50));
                    }
                });
            }
            Err(e) => {
                println!("Connection to {} failed: {:?}", midi.name, e);
                return Err(e);
            }
        }

        info!("Midi initialized");
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::{control_change_message, is_virtual_output_port, map_to_range};
        #[cfg(unix)]
        use super::connect_output;
        #[cfg(unix)]
        use midir::{MidiInput, MidiOutput};

        #[test]
        fn maps_decker_slider_range_to_midi_value_range() {
            assert_eq!(map_to_range(0), 0);
            assert_eq!(map_to_range(512), 64);
            assert_eq!(map_to_range(1023), 127);
            assert_eq!(map_to_range(2048), 127);
        }

        #[test]
        fn builds_default_control_change_for_slider() {
            let message = control_change_message(0, 512, &[]).unwrap();

            assert_eq!(message, [0xB0, 7, 64]);
        }

        #[test]
        fn builds_configured_control_change_for_slider() {
            let configuration = vec![
                ("".to_string(), "".to_string()),
                ("3".to_string(), "74".to_string()),
            ];
            let message = control_change_message(1, 1023, &configuration).unwrap();

            assert_eq!(message, [0xB2, 74, 127]);
        }

        #[test]
        fn rejects_invalid_midi_channel() {
            let configuration = vec![("17".to_string(), "7".to_string())];

            assert!(control_change_message(0, 512, &configuration).is_err());
        }

        #[test]
        fn treats_first_port_after_physical_outputs_as_virtual_output() {
            assert!(!is_virtual_output_port(2, 0));
            assert!(!is_virtual_output_port(2, 1));
            assert!(is_virtual_output_port(2, 2));
            assert!(!is_virtual_output_port(2, 3));
        }

        #[cfg(unix)]
        #[test]
        fn creates_virtual_output_when_alsa_midi_test_is_enabled() {
            if std::env::var_os("DOTX_TEST_ALSA_MIDI").is_none() {
                return;
            }

            let midi_out = MidiOutput::new("Dot X Test Output").unwrap();
            let conn = connect_output(midi_out, &[], 0).unwrap();
            let midi_in = MidiInput::new("Dot X Test Input").unwrap();
            let port_names: Vec<String> = midi_in
                .ports()
                .iter()
                .map(|port| midi_in.port_name(port).unwrap())
                .collect();

            assert!(
                port_names
                    .iter()
                    .any(|port_name| port_name.contains(super::VIRTUAL_OUTPUT_PORT_NAME)),
                "virtual MIDI output was not visible in input ports: {:?}",
                port_names
            );

            drop(conn);
        }
    }
}
