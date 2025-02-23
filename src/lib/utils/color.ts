import chroma from 'chroma-js';
import type { Color } from '$lib/types';

// Comprehensive array of colors for luminance exploration
let colorSpace: Color[] = [];

export function initializeColorSpace() {
    if (colorSpace.length > 0) return;  // Only initialize once
    
    for (let h = 0; h < 360; h += 5) {  // Step by 5 degrees
        for (let s = 0; s <= 100; s += 5) {  // Step by 5% saturation
            for (let l = 1; l < 100; l++) {  // Keep 1% steps for lightness
                colorSpace.push(createColor(h, s, l));
            }
        }
    }
}

export function findColorsWithLuminance(targetLuminance: number, tolerance: number = 0.005): Color[] {
    return colorSpace.filter(color => 
        Math.abs(color.luminance - targetLuminance) <= tolerance
    );
}

export function findClosestColorByLuminance(colors: Color[], targetLuminance: number): Color {
    return colors.reduce((closest, current) => {
        const currentDiff = Math.abs(current.luminance - targetLuminance);
        const closestDiff = Math.abs(closest.luminance - targetLuminance);
        return currentDiff < closestDiff ? current : closest;
    });
}

export function calculateLuminance(r: number, g: number, b: number): number {
    return chroma.rgb(r, g, b).luminance();
}

export function createColor(h: number, s: number, l: number): Color {
    const chromaColor = chroma.hsl(h, s / 100, l / 100);
    const [r, g, b] = chromaColor.rgb();
    return {
        h,
        s,
        l,
        rgb: { r, g, b },
        luminance: chromaColor.luminance()
    };
}

function findSaturationAndLightnessForLuminance(h: number, targetLuminance: number): { s: number, l: number } | null {
    // For each color position in the palette, try saturation from 0 to 100
    for (let s = 100; s >= 0; s--) {
        // For each saturation, try all lightness values to find one that matches target luminance
        for (let l = 0; l <= 100; l++) {
            const color = createColor(h, s, l);
            if (Math.abs(color.luminance - targetLuminance) < 0.005) {
                return { s, l };
            }
        }
    }
    return null;
}

export function getDefaultColors(generatorHues?: number[], midLightness?: number, highLuminance?: number, midLuminance?: number, lowLuminance?: number): Color[] {
    const colors: Color[] = [];
    const defaultHues = [0, 60, 120, 180, 240, 300, 30, 90, 150, 210, 270, 330];
    const hues = generatorHues || defaultHues;

    // For each group (increasing and decreasing luminance)
    for (let groupIndex = 0; groupIndex < 2; groupIndex++) {
        // For each palette in the group
        for (let paletteIndex = 0; paletteIndex < 6; paletteIndex++) {
            // Get the target hue for this palette
            const hueIndex = groupIndex * 6 + paletteIndex;
            const hue = hues[hueIndex];

            // Find the gray color that matches mid luminance
            let midLight = 50;
            let closestDiff = Infinity;
            for (let l = 0; l <= 100; l++) {
                const testColor = createColor(hue, 0, l);
                const luminanceDiff = Math.abs(testColor.luminance - midLuminance!);
                if (luminanceDiff < closestDiff) {
                    closestDiff = luminanceDiff;
                    midLight = l;
                }
                if (luminanceDiff < 0.001) break;
            }

            // Create 5 colors for this palette
            for (let colorIndex = 0; colorIndex < 5; colorIndex++) {
                let color: Color;

                if (midLightness !== undefined && highLuminance !== undefined && midLuminance !== undefined && lowLuminance !== undefined) {
                    if (colorIndex === 0) {
                        // First color is always gray at mid luminance
                        color = createColor(hue, 0, midLight);
                    } else {
                        // Calculate target luminance for this position
                        const t = colorIndex / 4; // 0 to 1 interpolation factor
                        const targetLuminance = groupIndex === 0
                            ? midLuminance + t * (highLuminance - midLuminance)  // Interpolate from mid to high
                            : midLuminance + t * (lowLuminance - midLuminance);  // Interpolate from mid to low

                        // Calculate target saturation based on position (higher for later positions)
                        const targetSat = Math.min(100, Math.round((colorIndex / 4) * 102)); // Goes up to 102 to ensure we try full saturation

                        // Search for color with target luminance, starting from target saturation
                        let bestSat = 0;
                        let bestLight = midLight;
                        let bestLuminanceDiff = Infinity;

                        // Search from target saturation upward
                        for (let s = targetSat; s <= 100; s++) {
                            // For each saturation, search lightness with finer increments
                            for (let l = 0; l <= 100; l += 0.2) {
                                const testColor = createColor(hue, s, l);
                                const luminanceDiff = Math.abs(testColor.luminance - targetLuminance);
                                if (luminanceDiff < bestLuminanceDiff) {
                                    bestLuminanceDiff = luminanceDiff;
                                    bestSat = s;
                                    bestLight = l;
                                }
                                if (luminanceDiff < 0.001) break;
                            }
                            // If we found a good enough match, stop searching
                            if (bestLuminanceDiff < 0.001) break;
                        }
                        
                        color = createColor(hue, bestSat, bestLight);
                    }
                } else {
                    // Use default interpolation
                    const s = 70;
                    const l = groupIndex === 0 
                        ? 85 - (colorIndex * 15)  // 85, 70, 55, 40, 25 for increasing luminance
                        : 15 + (colorIndex * 15); // 15, 30, 45, 60, 75 for decreasing luminance
                    color = createColor(hue, s, l);
                }

                colors.push(color);
            }
        }
    }

    return colors;
}

export function findMidLuminanceColor(targetLuminance: number): number {
    // Search for lightness value that gives target luminance at 0 saturation
    let bestLight = 50;
    let bestDiff = Infinity;
    
    for (let l = 0; l <= 100; l += 0.2) {
        const color = createColor(0, 0, l);
        const luminanceDiff = Math.abs(color.luminance - targetLuminance);
        if (luminanceDiff < bestDiff) {
            bestDiff = luminanceDiff;
            bestLight = l;
        }
        if (luminanceDiff < 0.001) break;
    }
    return bestLight;
} 

// Matrix multiplication helper
function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => 
        row.reduce((sum, value, index) => sum + value * vector[index], 0)
    );
}

export function oklabMix(color1: Color, color2: Color, t: number): Color {
    // Convert RGB values to linear space (0-1)
    const lin1 = [color1.rgb.r / 255, color1.rgb.g / 255, color1.rgb.b / 255];
    const lin2 = [color2.rgb.r / 255, color2.rgb.g / 255, color2.rgb.b / 255];

    // Matrix constants for cone and LMS conversions
    const CONE_TO_LMS = [
        [0.4121656120, 0.2118591070, 0.0883097947],
        [0.5362752080, 0.6807189584, 0.2818474174],
        [0.0514575653, 0.1074065790, 0.6302613616]
    ];
    const LMS_TO_CONE = [
        [4.0767245293, -1.2681437731, -0.0041119885],
        [-3.3072168827, 2.6093323231, -0.7034763098],
        [0.2307590544, -0.3411344290, 1.7068625689]
    ];

    // Convert to LMS space
    const lms1 = multiplyMatrixVector(CONE_TO_LMS, lin1).map(v => Math.pow(Math.max(0, v), 1/3));
    const lms2 = multiplyMatrixVector(CONE_TO_LMS, lin2).map(v => Math.pow(Math.max(0, v), 1/3));

    // Interpolate in LMS space
    const lms = lms1.map((v, i) => v * (1 - t) + lms2[i] * t);

    // Apply gain in the middle
    const gain = 1.0 + 0.2 * t * (1.0 - t);
    const lmsGained = lms.map(v => v * gain);

    // Convert back to RGB space
    const rgb = multiplyMatrixVector(LMS_TO_CONE, lmsGained.map(v => v * v * v));

    // Convert back to 0-255 range and create new Color object
    const result = {
        rgb: {
            r: Math.round(Math.max(0, Math.min(255, rgb[0] * 255))),
            g: Math.round(Math.max(0, Math.min(255, rgb[1] * 255))),
            b: Math.round(Math.max(0, Math.min(255, rgb[2] * 255)))
        }
    };

    // Create and return final color (using createColor to ensure proper format)
    const chromaColor = chroma.rgb(result.rgb.r, result.rgb.g, result.rgb.b);
    const [h, s, l] = chromaColor.hsl();
    return createColor(h, s * 100, l * 100);
}