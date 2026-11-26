// The DotMatrixLabs devices Dot X recognizes, keyed by USB VID/PID.
// Mirrors `DeviceKind` in src-tauri/src/decker.rs.

export type DeviceType = 'Decker' | 'Decker Lite' | 'Unknown';

const DMX_VID = 0x04d8;
const TYPE_BY_PID: Record<number, DeviceType> = {
    0xe626: 'Decker',
    0xe4b5: 'Decker Lite',
};

export function deviceTypeFor(device: { vid: number; pid: number } | null | undefined): DeviceType {
    if (!device || device.vid !== DMX_VID) return 'Unknown';
    return TYPE_BY_PID[device.pid] ?? 'Unknown';
}

// Only devices known to lack LEDs say no: other serial devices keep today's behavior.
export function hasLeds(type: DeviceType): boolean {
    return type !== 'Decker Lite';
}

// Product model per device type, as written to EEPROM at manufacturing.
export const MODEL_BY_TYPE: Record<Exclude<DeviceType, 'Unknown'>, string> = {
    'Decker': 'VM-5SW',
    'Decker Lite': 'VML-5SW',
};

export const NAME_BY_MODEL: Record<string, DeviceType> = {
    'VM-5SW': 'Decker',
    'VML-5SW': 'Decker Lite',
};
