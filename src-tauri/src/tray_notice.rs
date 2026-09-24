use std::sync::atomic::{AtomicBool, Ordering};

pub struct TrayNoticeState(AtomicBool);

impl TrayNoticeState {
    pub fn new(already_shown: bool) -> Self {
        Self(AtomicBool::new(already_shown))
    }

    pub fn claim_first_notice(&self) -> bool {
        !self.0.swap(true, Ordering::Relaxed)
    }
}

#[cfg(test)]
mod tests {
    use super::TrayNoticeState;

    #[test]
    fn only_the_first_close_claims_the_notice() {
        let state = TrayNoticeState::new(false);

        assert!(state.claim_first_notice());
        assert!(!state.claim_first_notice());
    }

    #[test]
    fn persisted_notice_state_suppresses_the_notice_after_restart() {
        let state = TrayNoticeState::new(true);

        assert!(!state.claim_first_notice());
    }
}
