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

export function findColorsWithLuminance(targetLuminance: number, tolerance: number = 0.001): Color[] {
    return colorSpace.filter(color => 
        Math.abs(color.luminance - targetLuminance) <= tolerance
    );
}

export function findClosestColorByLuminance(h: number, s: number, targetLuminance: number): Color {
    // Find colors with this hue and saturation
    const candidates = colorSpace.filter(color => 
        color.h === h && color.s === s
    );
    
    // Find the one with closest luminance
    return candidates.reduce((closest, current) => 
        Math.abs(current.luminance - targetLuminance) < Math.abs(closest.luminance - targetLuminance)
            ? current
            : closest
    );
}

export function calculateLuminance(r: number, g: number, b: number): number {
    // Convert to sRGB
    const rsRGB = r / 255;
    const gsRGB = g / 255;
    const bsRGB = b / 255;
    
    // Convert to linear RGB
    const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
    
    // Calculate luminance using the coefficients for BT.709
    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

export function createColor(h: number, s: number, l: number): Color {
    const chromaColor = chroma.hsl(h, s / 100, l / 100);
    const [r, g, b] = chromaColor.rgb();
    
    return {
        h,
        s,
        l,
        rgb: { r, g, b },
        luminance: calculateLuminance(r, g, b)
    };
}

export function getDefaultColors(): Color[] {
    // Initialize the color space if not already done
    initializeColorSpace();
    
    const colors: Color[] = new Array(60);
    
    // Create first palette of each group as before to establish target luminance values
    for (let groupIndex = 0; groupIndex < 2; groupIndex++) {
        const baseOffset = groupIndex * 30;  // Start of this group
        const h = groupIndex * 30;  // First palette in each group starts at 0° or 30°
        
        // Create the first palette in this group
        for (let colorIndex = 0; colorIndex < 5; colorIndex++) {
            // Linear interpolation of saturation within palette
            const s = (colorIndex / 4) * 100;  // Saturation goes from 0 to 100
            
            // Calculate lightness based on group and color position
            const startL = 50;  // Both groups start at 50
            const endL = groupIndex === 0 ? 85 : 15;  // Group 0 goes up, Group 1 goes down
            const l = startL + (colorIndex / 4) * (endL - startL);
            
            // Create the reference color for this position
            colors[baseOffset + colorIndex] = createColor(h, s, l);
        }
    }
    
    // Now create remaining palettes, matching luminance to first palette in their group
    for (let groupIndex = 0; groupIndex < 2; groupIndex++) {
        const baseOffset = groupIndex * 30;  // Start of this group
        
        // Skip first palette (already created), do remaining 5 palettes
        for (let paletteIndex = 1; paletteIndex < 6; paletteIndex++) {
            // Calculate hue for this palette
            const h = ((paletteIndex / 6) * 360) + (groupIndex * 30);
            
            for (let colorIndex = 0; colorIndex < 5; colorIndex++) {
                const position = baseOffset + paletteIndex * 5 + colorIndex;
                const referencePosition = baseOffset + colorIndex;  // Corresponding position in first palette
                
                // Get target luminance from reference color
                const targetLuminance = colors[referencePosition].luminance;
                
                // Calculate saturation as before
                const s = (colorIndex / 4) * 100;
                
                // Find the color with this hue and saturation that matches the target luminance
                colors[position] = findClosestColorByLuminance(h, s, targetLuminance);
            }
        }
    }
    
    return colors;
} 