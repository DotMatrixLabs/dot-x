# Plugin System TODO

- Rework plugin permission approval storage so approval is tied to plugin ID plus version and/or a normalized permission hash, instead of only plugin ID.
- Clear stored approval state on uninstall, not just the enabled state.
- Clarify baseline runtime capabilities such as `--allow-env`, and separate them from user-approvable plugin permissions.
- Limit environment exposure if possible, or document that full env access is currently required by the SDK/runtime contract.
- Revisit baseline `--allow-sys` access and require explicit manifest permission where possible.
- Make the permission dialog match the real runtime permissions exactly.
- Add child-process exit monitoring so crashed or exited plugins are removed from the process table.
- Ensure plugins can be restarted after a crash without requiring a full app restart.
- Replace stubbed settings manager behavior with real persistence and real UI state updates.
- Align the SDK, host implementation, generated types, and README so they expose the same plugin API surface.
- Either implement or remove/document unsupported SDK APIs such as `this.settings.createSettings`, `ui.showModal`, and `ui.showConfirmation`.
- Add tests for permission approval, uninstall cleanup, plugin crash/restart flow, and SDK-to-host API compatibility.
