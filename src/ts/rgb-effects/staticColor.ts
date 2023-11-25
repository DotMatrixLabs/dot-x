/**
 * Set a static RGB color.
 * @param {number} r - The red component of the color (0-255).
 * @param {number} g - The green component of the color (0-255).
 * @param {number} b - The blue component of the color (0-255).
 * @param {number} [brightness=255] - The brightness of the color (0-255).
 * @returns {{r: number, g: number, b: number}} - An object containing the clamped RGB values.
 */
export function setColor(r: number, g: number, b: number, brightness: number = 255) {
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255 || brightness < 0 || brightness > 255) {
        throw new Error('Invalid parameters: RGB values and brightness must be in the range [0, 255].');
    }

    // Ensure the values are within the 0-255 range
    const clampedR = Math.min(255, Math.max(0, r));
    const clampedG = Math.min(255, Math.max(0, g));
    const clampedB = Math.min(255, Math.max(0, b));
    const clampedBrightness = Math.min(255, Math.max(0, brightness));

    return { r: clampedR, g: clampedG, b: clampedB, brightness: clampedBrightness };
}