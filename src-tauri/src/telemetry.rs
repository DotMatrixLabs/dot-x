use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Clone)]
pub struct TelemetrySettings {
    crash_reporting_enabled: Arc<AtomicBool>,
    analytics_enabled: Arc<AtomicBool>,
}

impl Default for TelemetrySettings {
    fn default() -> Self {
        Self::new(true, true)
    }
}

impl TelemetrySettings {
    pub fn new(crash_reporting_enabled: bool, analytics_enabled: bool) -> Self {
        Self {
            crash_reporting_enabled: Arc::new(AtomicBool::new(crash_reporting_enabled)),
            analytics_enabled: Arc::new(AtomicBool::new(analytics_enabled)),
        }
    }

    pub fn crash_reporting_enabled(&self) -> bool {
        self.crash_reporting_enabled.load(Ordering::Relaxed)
    }

    pub fn set_crash_reporting_enabled(&self, enabled: bool) {
        self.crash_reporting_enabled
            .store(enabled, Ordering::Relaxed);
    }

    pub fn analytics_enabled(&self) -> bool {
        self.analytics_enabled.load(Ordering::Relaxed)
    }

    pub fn set_analytics_enabled(&self, enabled: bool) {
        self.analytics_enabled.store(enabled, Ordering::Relaxed);
    }
}

#[cfg(test)]
mod tests {
    use super::TelemetrySettings;

    #[test]
    fn telemetry_is_enabled_by_default_to_preserve_existing_behavior() {
        let settings = TelemetrySettings::default();

        assert!(settings.analytics_enabled());
        assert!(settings.crash_reporting_enabled());
    }

    #[test]
    fn preferences_can_be_disabled_independently() {
        let settings = TelemetrySettings::default();

        settings.set_analytics_enabled(false);

        assert!(!settings.analytics_enabled());
        assert!(settings.crash_reporting_enabled());
    }

    #[test]
    fn crash_reporting_can_be_disabled_without_disabling_analytics() {
        let settings = TelemetrySettings::default();

        settings.set_crash_reporting_enabled(false);

        assert!(!settings.crash_reporting_enabled());
        assert!(settings.analytics_enabled());
    }
}
