//! Intel HEX parsing for Decker firmware images.

/// Flash page size of the ATmega32U4.
pub const PAGE_SIZE: usize = 128;
/// Flash available to the app: 32 KiB minus the 4 KiB bootloader.
pub const APP_SIZE: usize = 28_672;

/// Parses an Intel HEX file into a flash image starting at address 0.
/// Gaps are filled with 0xFF and the image is padded to a whole number of pages.
pub fn parse_ihex(text: &str) -> Result<Vec<u8>, String> {
    let mut image = vec![0xFFu8; APP_SIZE];
    let mut highest: Option<usize> = None;
    let mut base: usize = 0;
    let mut saw_eof = false;

    for (idx, line) in text.lines().enumerate() {
        let n = idx + 1;
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if saw_eof {
            return Err(format!("Line {n}: data after the end-of-file record."));
        }
        let hex = line
            .strip_prefix(':')
            .ok_or_else(|| format!("Line {n}: record does not start with ':'."))?;
        if hex.len() % 2 != 0 || !hex.is_ascii() {
            return Err(format!("Line {n}: record is not made of hex byte pairs."));
        }
        let bytes = (0..hex.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i + 2], 16))
            .collect::<Result<Vec<u8>, _>>()
            .map_err(|_| format!("Line {n}: record contains a bad hex digit."))?;
        if bytes.len() < 5 || bytes.len() != bytes[0] as usize + 5 {
            return Err(format!("Line {n}: record length does not match its length field."));
        }
        if bytes.iter().fold(0u8, |sum, b| sum.wrapping_add(*b)) != 0 {
            return Err(format!("Line {n}: checksum is wrong."));
        }
        let addr = u16::from_be_bytes([bytes[1], bytes[2]]) as usize;
        let data = &bytes[4..bytes.len() - 1];
        match bytes[3] {
            0x00 => {
                if data.is_empty() {
                    continue;
                }
                let start = base + addr;
                let end = start + data.len();
                if end > APP_SIZE {
                    return Err(format!(
                        "Line {n}: data at 0x{start:04X} runs past the app area (0x{APP_SIZE:04X})."
                    ));
                }
                image[start..end].copy_from_slice(data);
                highest = Some(highest.map_or(end, |h| h.max(end)));
            }
            0x01 => saw_eof = true,
            kind @ (0x02 | 0x04) => {
                if data.len() != 2 {
                    return Err(format!("Line {n}: address record must carry 2 bytes."));
                }
                let value = u16::from_be_bytes([data[0], data[1]]) as usize;
                let new_base = if kind == 0x02 { value << 4 } else { value << 16 };
                if new_base >= APP_SIZE {
                    return Err(format!(
                        "Line {n}: address 0x{new_base:X} is outside the app area."
                    ));
                }
                base = new_base;
            }
            kind => return Err(format!("Line {n}: unsupported record type 0x{kind:02X}.")),
        }
    }

    if !saw_eof {
        return Err("The file has no end-of-file record.".to_string());
    }
    let len = highest.ok_or("The file contains no data.")?;
    image.truncate(len.div_ceil(PAGE_SIZE) * PAGE_SIZE);
    Ok(image)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test] fn parses_and_pads_to_page() {
        // 4 data bytes at 0x0000, then EOF
        let img = parse_ihex(":0400000001020304F2\n:00000001FF\n").unwrap();
        assert_eq!(img.len(), PAGE_SIZE);
        assert_eq!(&img[..4], &[1, 2, 3, 4]);
        assert!(img[4..].iter().all(|b| *b == 0xFF));
    }
    #[test] fn fills_gaps_with_ff() {
        let img = parse_ihex(":01008000552A\n:00000001FF\n").unwrap();
        assert_eq!(img.len(), 2 * PAGE_SIZE);
        assert_eq!(img[0x80], 0x55);
        assert!(img[..0x80].iter().all(|b| *b == 0xFF));
    }
    #[test] fn rejects_bad_checksum() { assert!(parse_ihex(":0400000001020304F3\n:00000001FF\n").is_err()); }
    #[test] fn rejects_data_in_bootloader_area() { assert!(parse_ihex(":01700000AAE5\n:00000001FF\n").is_err()); }
    #[test] fn rejects_empty_and_missing_eof() {
        assert!(parse_ihex(":00000001FF\n").is_err());
        assert!(parse_ihex(":0400000001020304F2\n").is_err());
    }
    #[test] fn accepts_crlf_line_endings() { assert!(parse_ihex(":0400000001020304F2\r\n:00000001FF\r\n").is_ok()); }
}
