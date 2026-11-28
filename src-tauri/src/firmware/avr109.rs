//! Minimal AVR109 client for the Decker's Caterina-based bootloader.
//!
//! Page 0 holds the reset vector, so it is written last: an interrupted flash
//! leaves it erased and the device stays in the bootloader for a retry.

use super::hex::{APP_SIZE, PAGE_SIZE};
use std::io::{self, Read, Write};

#[derive(Clone, Copy, Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Stage {
    Rebooting,
    Writing,
    Verifying,
    Done,
}

const ACK: u8 = b'\r';

/// Asks the bootloader for its software identifier; true if it is Caterina.
pub fn identify<P: Read + Write>(port: &mut P) -> io::Result<bool> {
    port.write_all(b"S")?;
    port.flush()?;
    let mut id = [0u8; 7];
    port.read_exact(&mut id)?;
    Ok(&id == b"CATERIN")
}

fn expect_ack<P: Read>(port: &mut P, what: &str) -> Result<(), String> {
    let mut b = [0u8; 1];
    port.read_exact(&mut b)
        .map_err(|e| format!("{what}: no reply ({e})"))?;
    if b[0] == ACK {
        Ok(())
    } else {
        Err(format!("{what}: unexpected reply 0x{:02X}", b[0]))
    }
}

fn command<P: Read + Write>(port: &mut P, bytes: &[u8], what: &str) -> Result<(), String> {
    port.write_all(bytes)
        .and_then(|_| port.flush())
        .map_err(|e| format!("{what}: {e}"))?;
    expect_ack(port, what)
}

fn set_address<P: Read + Write>(port: &mut P, byte_addr: usize) -> Result<(), String> {
    let word =
        u16::try_from(byte_addr / 2).map_err(|_| format!("address {byte_addr} out of range"))?;
    command(
        port,
        &[b'A', (word >> 8) as u8, word as u8],
        &format!("set address {byte_addr}"),
    )
}

fn write_page<P: Read + Write>(port: &mut P, byte_addr: usize, page: &[u8]) -> Result<(), String> {
    set_address(port, byte_addr)?;
    let size = page.len() as u16;
    let mut msg = vec![b'B', (size >> 8) as u8, size as u8, b'F'];
    msg.extend_from_slice(page);
    command(
        port,
        &msg,
        &format!("write page at byte address {byte_addr}"),
    )
}

/// Reads back `expected` page by page and compares. The bootloader's address
/// must already point at `byte_addr`; it advances as pages are read.
fn verify_pages<P: Read + Write>(
    port: &mut P,
    byte_addr: usize,
    expected: &[u8],
) -> Result<(), String> {
    for (i, want) in expected.chunks(PAGE_SIZE).enumerate() {
        let at = byte_addr + i * PAGE_SIZE;
        let size = want.len() as u16;
        port.write_all(&[b'g', (size >> 8) as u8, size as u8, b'F'])
            .and_then(|_| port.flush())
            .map_err(|e| format!("read page at byte address {at}: {e}"))?;
        let mut got = vec![0u8; want.len()];
        port.read_exact(&mut got)
            .map_err(|e| format!("read page at byte address {at}: {e}"))?;
        if got != want {
            return Err(format!("verify mismatch in page at byte address {at}"));
        }
    }
    Ok(())
}

/// Erases the application area, writes `image`, verifies it, then exits the bootloader.
pub fn program<P: Read + Write>(
    port: &mut P,
    image: &[u8],
    progress: &mut dyn FnMut(Stage, u8),
) -> Result<(), String> {
    if image.is_empty() || image.len() % PAGE_SIZE != 0 {
        return Err(format!(
            "image length {} is not a non-zero multiple of {PAGE_SIZE}",
            image.len()
        ));
    }
    if image.len() > APP_SIZE {
        return Err(format!(
            "image length {} exceeds the {APP_SIZE}-byte application area",
            image.len()
        ));
    }
    let pages = image.len() / PAGE_SIZE;

    command(port, b"e", "erase")?;

    for p in 1..pages {
        write_page(
            port,
            p * PAGE_SIZE,
            &image[p * PAGE_SIZE..(p + 1) * PAGE_SIZE],
        )?;
        progress(Stage::Writing, (p * 100 / pages) as u8);
    }

    progress(Stage::Verifying, 0);
    if pages > 1 {
        set_address(port, PAGE_SIZE)?;
        verify_pages(port, PAGE_SIZE, &image[PAGE_SIZE..])?;
    }

    write_page(port, 0, &image[..PAGE_SIZE])?;
    set_address(port, 0)?;
    verify_pages(port, 0, &image[..PAGE_SIZE])?;
    progress(Stage::Verifying, 100);

    command(port, b"E", "exit bootloader")?;
    progress(Stage::Done, 100);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;

    struct FakeCaterina {
        flash: Vec<u8>,
        addr: usize,
        input: VecDeque<u8>,
        output: VecDeque<u8>,
        writes: Vec<usize>,
        fail_after_writes: Option<usize>,
        corrupt_reads: bool,
    }

    impl FakeCaterina {
        fn new() -> Self {
            Self {
                flash: vec![0xA5; APP_SIZE],
                addr: 0,
                input: VecDeque::new(),
                output: VecDeque::new(),
                writes: vec![],
                fail_after_writes: None,
                corrupt_reads: false,
            }
        }

        /// Handles every complete command in `input`; an incomplete one waits for more bytes.
        fn pump(&mut self) -> io::Result<()> {
            loop {
                let Some(&cmd) = self.input.front() else {
                    return Ok(());
                };
                match cmd {
                    b'S' => {
                        self.input.pop_front();
                        self.output.extend(b"CATERIN");
                    }
                    b'e' => {
                        self.input.pop_front();
                        self.flash.fill(0xFF);
                        self.output.push_back(ACK);
                    }
                    b'E' => {
                        self.input.pop_front();
                        self.output.push_back(ACK);
                    }
                    b'A' => {
                        if self.input.len() < 3 {
                            return Ok(());
                        }
                        let hi = self.input[1] as usize;
                        let lo = self.input[2] as usize;
                        self.input.drain(..3);
                        self.addr = (hi << 9) | (lo << 1);
                        self.output.push_back(ACK);
                    }
                    b'B' => {
                        if self.input.len() < 4 {
                            return Ok(());
                        }
                        let size = ((self.input[1] as usize) << 8) | self.input[2] as usize;
                        let memtype = self.input[3];
                        if memtype != b'F' && memtype != b'E' {
                            self.input.drain(..4);
                            self.output.push_back(b'?');
                            continue;
                        }
                        if self.input.len() < 4 + size {
                            return Ok(());
                        }
                        if self
                            .fail_after_writes
                            .is_some_and(|n| self.writes.len() >= n)
                        {
                            return Err(io::ErrorKind::BrokenPipe.into());
                        }
                        let data: Vec<u8> = self.input.drain(..4 + size).skip(4).collect();
                        self.flash[self.addr..self.addr + size].copy_from_slice(&data);
                        self.writes.push(self.addr);
                        self.addr += size;
                        self.output.push_back(ACK);
                    }
                    b'g' => {
                        if self.input.len() < 4 {
                            return Ok(());
                        }
                        let size = ((self.input[1] as usize) << 8) | self.input[2] as usize;
                        self.input.drain(..4);
                        let mut data = self.flash[self.addr..self.addr + size].to_vec();
                        if self.corrupt_reads {
                            data[0] ^= 1;
                        }
                        self.output.extend(data);
                        self.addr += size;
                    }
                    _ => {
                        self.input.pop_front();
                        self.output.push_back(b'?');
                    }
                }
            }
        }
    }

    impl Write for FakeCaterina {
        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
            self.input.extend(buf);
            self.pump()?;
            Ok(buf.len())
        }
        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    impl Read for FakeCaterina {
        fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            let n = buf.len().min(self.output.len());
            for slot in buf.iter_mut().take(n) {
                *slot = self.output.pop_front().unwrap();
            }
            Ok(n)
        }
    }

    fn test_image(pages: usize) -> Vec<u8> {
        (0..pages * PAGE_SIZE).map(|i| (i % 251) as u8).collect()
    }

    #[test]
    fn identify_recognises_caterina() {
        let mut f = FakeCaterina::new();
        assert!(identify(&mut f).unwrap());
    }

    #[test]
    fn programs_and_verifies_image() {
        let image = test_image(3);
        let mut f = FakeCaterina::new();
        program(&mut f, &image, &mut |_, _| {}).unwrap();
        assert_eq!(&f.flash[..image.len()], &image[..]);
        assert!(f.flash[image.len()..].iter().all(|b| *b == 0xFF));
    }

    #[test]
    fn writes_page_zero_last() {
        let mut f = FakeCaterina::new();
        program(&mut f, &test_image(3), &mut |_, _| {}).unwrap();
        assert_eq!(f.writes, vec![128, 256, 0]);
    }

    #[test]
    fn interrupted_write_leaves_page_zero_erased() {
        let mut f = FakeCaterina::new();
        f.fail_after_writes = Some(1);
        assert!(program(&mut f, &test_image(3), &mut |_, _| {}).is_err());
        assert_eq!(f.writes, vec![128]);
        assert_eq!(&f.flash[..2], &[0xFF, 0xFF]);
    }

    #[test]
    fn verify_mismatch_fails_before_page_zero() {
        let mut f = FakeCaterina::new();
        f.corrupt_reads = true;
        assert!(program(&mut f, &test_image(3), &mut |_, _| {}).is_err());
        assert!(!f.writes.contains(&0));
    }

    #[test]
    fn reports_progress_ending_in_done() {
        let mut seen = vec![];
        let mut f = FakeCaterina::new();
        program(&mut f, &test_image(3), &mut |s, p| seen.push((s, p))).unwrap();
        assert_eq!(seen.last(), Some(&(Stage::Done, 100)));
        assert!(seen.iter().any(|(s, _)| *s == Stage::Verifying));
    }

    #[test]
    fn rejects_image_larger_than_app_area() {
        let mut f = FakeCaterina::new();
        let image = test_image(APP_SIZE / PAGE_SIZE + 1);
        assert!(program(&mut f, &image, &mut |_, _| {}).is_err());
        assert!(f.writes.is_empty());
        assert!(f.flash.iter().all(|b| *b == 0xA5));
    }
}
