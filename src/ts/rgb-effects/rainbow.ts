/**
 * Generate a rainbow effect with RGB values based on time.
 * @param {number} [brightness=255] - The brightness of the rainbow effect (0-255).
 * @param {number} [speed=0.1] - The speed of the rainbow effect.
 * @returns {{r: number, g: number, b: number}} - An object containing the clamped RGB values.
 */
export function rainbow(brightness = 255, speed = 0.1) {
    if (brightness < 0 || brightness > 255 || speed <= 0) {
        throw new Error('Invalid parameters: brightness must be in the range [0, 255] and speed must be greater than 0.');
    }

    const r = Math.sin(speed * Date.now() + 0) * brightness;
    const g = Math.sin(speed * Date.now() + 2) * brightness;
    const b = Math.sin(speed * Date.now() + 4) * brightness;

    const clampedR = Math.min(255, Math.max(0, r));
    const clampedG = Math.min(255, Math.max(0, g));
    const clampedB = Math.min(255, Math.max(0, b));

    return { r: clampedR, g: clampedG, b: clampedB };
    
}


