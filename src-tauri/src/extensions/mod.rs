pub mod mqtt;

use std::error::Error;
use std::fmt;

#[derive(Debug)]
pub enum ExtensionError {
    InitializationError(String),
    NotFound(String),
}

impl fmt::Display for ExtensionError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ExtensionError::InitializationError(msg) => write!(f, "Extension initialization error: {}", msg),
            ExtensionError::NotFound(msg) => write!(f, "Extension not found: {}", msg),
        }
    }
}

impl Error for ExtensionError {}
