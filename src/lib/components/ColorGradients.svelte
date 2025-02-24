<script lang="ts">
    import type { Color } from '$lib/types';
    import { createEventDispatcher } from 'svelte';
    import { oklabMix, createColor } from '$lib/utils/color';
    import chroma from 'chroma-js';

    export let startColor: Color | null = null;
    export let endColor: Color | null = null;
    export let activeColor: Color | null = null;
    export let hslGradientColors: Color[] = [];
    export let evenLumGradientColors: Color[] = [];
    export let oklabGradientColors: Color[] = [];
    export let oklabChromaGradientColors: Color[] = [];
    export let rgbGradientColors: Color[] = [];

    const dispatch = createEventDispatcher();

    function handleColorBoxClick(color: Color | null) {
        dispatch('colorSelected', { color });
    }

    $: hslGradientSteps = generateHSLGradient(startColor, endColor);
    $: evenLumGradientSteps = generateEvenLumGradient(startColor, endColor);
    $: oklabGradientSteps = generateOklabGradient(startColor, endColor, false);
    $: oklabChromaGradientSteps = generateOklabChromaGradient(startColor, endColor);
    $: rgbGradientSteps = generateRGBGradient(startColor, endColor);

    // Update exported gradient colors
    $: hslGradientColors = hslGradientSteps;
    $: evenLumGradientColors = evenLumGradientSteps;
    $: oklabGradientColors = oklabGradientSteps;
    $: oklabChromaGradientColors = oklabChromaGradientSteps;
    $: rgbGradientColors = rgbGradientSteps;

    $: isStartColorActive = activeColor && startColor && activeColor.h === startColor.h && 
                           activeColor.s === startColor.s && activeColor.l === startColor.l;
    $: isEndColorActive = activeColor && endColor && activeColor.h === endColor.h && 
                         activeColor.s === endColor.s && activeColor.l === endColor.l;

    function generateHSLGradient(start: Color | null, end: Color | null): Color[] {
        if (!start || !end) return [];
        
        const steps = 20;
        const colors: Color[] = [start]; // Start with exact start color
        
        // Convert start and end colors to XYZ coordinates
        const startAngle = (start.h * Math.PI) / 180;
        const endAngle = (end.h * Math.PI) / 180;
        const startRadius = start.s / 100;
        const endRadius = end.s / 100;
        const startHeight = (start.l / 50) - 1;
        const endHeight = (end.l / 50) - 1;
        
        const startX = startRadius * Math.cos(startAngle);
        const startZ = startRadius * Math.sin(startAngle);
        const startY = startHeight;
        
        const endX = endRadius * Math.cos(endAngle);
        const endZ = endRadius * Math.sin(endAngle);
        const endY = endHeight;
        
        // Generate intermediate steps by interpolating in XYZ space
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            
            // Linear interpolation in XYZ
            const x = startX + t * (endX - startX);
            const y = startY + t * (endY - startY);
            const z = startZ + t * (endZ - startZ);
            
            // Convert back to HSL
            const radius = Math.sqrt(x * x + z * z);
            const angle = Math.atan2(z, x);
            
            // Convert to HSL values
            let h = (angle * 180) / Math.PI;
            if (h < 0) h += 360;  // Ensure positive hue
            const s = radius * 100;
            const l = (y + 1) * 50;
            
            colors.push(createColor(h, s, l));
        }
        
        colors.push(end); // End with exact end color
        return colors;
    }

    function generateEvenLumGradient(start: Color | null, end: Color | null): Color[] {
        if (!start || !end) return [];
        
        const steps = 20;
        const colors: Color[] = [start]; // Start with exact start color
        
        // Convert start and end colors to XYZ coordinates (same as HSL-lin)
        const startAngle = (start.h * Math.PI) / 180;
        const endAngle = (end.h * Math.PI) / 180;
        const startRadius = start.s / 100;
        const endRadius = end.s / 100;
        const startHeight = (start.l / 50) - 1;
        const endHeight = (end.l / 50) - 1;
        
        const startX = startRadius * Math.cos(startAngle);
        const startZ = startRadius * Math.sin(startAngle);
        const startY = startHeight;
        
        const endX = endRadius * Math.cos(endAngle);
        const endZ = endRadius * Math.sin(endAngle);
        const endY = endHeight;
        
        // Generate intermediate steps
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            
            // Linear interpolation in XYZ
            const x = startX + t * (endX - startX);
            const y = startY + t * (endY - startY);
            const z = startZ + t * (endZ - startZ);
            
            // Convert back to HSL
            const radius = Math.sqrt(x * x + z * z);
            const angle = Math.atan2(z, x);
            
            // Convert to HSL values
            let h = (angle * 180) / Math.PI;
            if (h < 0) h += 360;  // Ensure positive hue
            const s = radius * 100;
            
            // Instead of using the interpolated y for lightness,
            // find a lightness that gives us the desired luminance
            const targetLum = start.luminance + t * (end.luminance - start.luminance);
            
            // Search for lightness value that gives target luminance
            let bestLight = 50;
            let bestLuminanceDiff = Infinity;
            let bestColor = null;
            
            // Search through lightness values with fine increments
            for (let l = 0; l <= 100; l += 0.2) {
                const testColor = createColor(h, s, l);
                const luminanceDiff = Math.abs(testColor.luminance - targetLum);
                
                if (luminanceDiff < bestLuminanceDiff) {
                    bestLuminanceDiff = luminanceDiff;
                    bestLight = l;
                    bestColor = testColor;
                }
                
                if (luminanceDiff < 0.001) break;
            }
            
            if (bestColor) {
                colors.push(bestColor);
            }
        }
        
        colors.push(end); // End with exact end color
        return colors;
    }

    function generateOklabGradient(start: Color | null, end: Color | null, applyGain: boolean): Color[] {
        if (!start || !end) return [];
        
        const steps = 20;
        const colors: Color[] = [];
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            colors.push(oklabMix(start, end, t, applyGain));
        }
        
        return colors;
    }

    function generateRGBGradient(start: Color | null, end: Color | null): Color[] {
        if (!start || !end) return [];
        
        const steps = 20;
        const colors: Color[] = [start]; // Start with exact start color
        
        // Generate intermediate steps with linear RGB interpolation
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const r = Math.round(start.rgb.r + t * (end.rgb.r - start.rgb.r));
            const g = Math.round(start.rgb.g + t * (end.rgb.g - start.rgb.g));
            const b = Math.round(start.rgb.b + t * (end.rgb.b - start.rgb.b));
            
            // Convert RGB back to HSL using chroma-js
            const chromaColor = chroma.rgb(r, g, b);
            const [h, s, l] = chromaColor.hsl();
            colors.push(createColor(h || 0, (s || 0) * 100, (l || 0) * 100));
        }
        
        colors.push(end); // End with exact end color
        return colors;
    }

    function generateOklabChromaGradient(start: Color | null, end: Color | null): Color[] {
        if (!start || !end) return [];
        
        const steps = 20;
        const colors: Color[] = [];
        
        const startChroma = chroma.rgb(start.rgb.r, start.rgb.g, start.rgb.b);
        const endChroma = chroma.rgb(end.rgb.r, end.rgb.g, end.rgb.b);
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const mixed = chroma.mix(startChroma, endChroma, t, 'oklab');
            const [h, s, l] = mixed.hsl();
            colors.push(createColor(h || 0, (s || 0) * 100, (l || 0) * 100));
        }
        
        return colors;
    }
</script>

<div class="gradients-panel">
    <h3>Gradients</h3>
    <div class="gradient-container">
        <div 
            class="color-box start-color" 
            class:active={isStartColorActive}
            style="background-color: {startColor ? `rgb(${startColor.rgb.r}, ${startColor.rgb.g}, ${startColor.rgb.b})` : '#fff'}"
            on:click={() => handleColorBoxClick(startColor)}
        />
        
        <div class="gradient-bars">
            <div class="gradient-bar">
                <span class="label">RGB ⬢</span>
                <div class="bar">
                    {#each rgbGradientSteps as color}
                        <div 
                            class="step"
                            style="background-color: rgb({color.rgb.r}, {color.rgb.g}, {color.rgb.b})"
                        />
                    {/each}
                </div>
            </div>
            
            <div class="gradient-bar">
                <span class="label">HSL-lin ●</span>
                <div class="bar">
                    {#each hslGradientSteps as color}
                        <div 
                            class="step"
                            style="background-color: rgb({color.rgb.r}, {color.rgb.g}, {color.rgb.b})"
                        />
                    {/each}
                </div>
            </div>
            
            <div class="gradient-bar">
                <span class="label">HSL-lin-lum ■</span>
                <div class="bar">
                    {#each evenLumGradientSteps as color}
                        <div 
                            class="step"
                            style="background-color: rgb({color.rgb.r}, {color.rgb.g}, {color.rgb.b})"
                        />
                    {/each}
                </div>
            </div>
            
            <div class="gradient-bar">
                <span class="label">Oklab ▲</span>
                <div class="bar">
                    {#each oklabGradientSteps as color}
                        <div 
                            class="step"
                            style="background-color: rgb({color.rgb.r}, {color.rgb.g}, {color.rgb.b})"
                        />
                    {/each}
                </div>
            </div>

            <div class="gradient-bar">
                <span class="label" title="Interpolate with chroma.js's built-in Oklab interpolation">Oklab-chroma ◆</span>
                <div class="bar">
                    {#each oklabChromaGradientSteps as color}
                        <div 
                            class="step"
                            style="background-color: rgb({color.rgb.r}, {color.rgb.g}, {color.rgb.b})"
                        />
                    {/each}
                </div>
            </div>
        </div>
        
        <div 
            class="color-box end-color" 
            class:active={isEndColorActive}
            style="background-color: {endColor ? `rgb(${endColor.rgb.r}, ${endColor.rgb.g}, ${endColor.rgb.b})` : '#fff'}"
            on:click={() => handleColorBoxClick(endColor)}
        />
    </div>
</div>

<style>
    .gradients-panel {
        background: white;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    h3 {
        margin: 0 0 1rem 0;
        font-size: 1.25rem;
        font-weight: 500;
        color: #333;
    }

    .gradient-container {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .color-box {
        width: 48px;
        height: 48px;
        border-radius: 4px;
        border: 2px solid #ccc;
        cursor: pointer;
        transition: all 0.2s;
    }

    .color-box:hover {
        border-color: #999;
    }

    .color-box.active {
        border-color: #4a4a4a;
        box-shadow: 0 0 0 2px rgba(74, 74, 74, 0.3);
    }

    .gradient-bars {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .gradient-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .label {
        width: 100px;
        font-size: 0.9rem;
        color: #666;
    }

    .bar {
        flex: 1;
        height: 24px;
        display: flex;
        border-radius: 4px;
        overflow: hidden;
    }

    .step {
        flex: 1;
        height: 100%;
    }
</style> 