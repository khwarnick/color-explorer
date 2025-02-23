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

    const dispatch = createEventDispatcher();

    function handleColorBoxClick(color: Color | null) {
        dispatch('colorSelected', { color });
    }

    $: hslGradientSteps = generateHSLGradient(startColor, endColor);
    $: evenLumGradientSteps = generateEvenLumGradient(startColor, endColor);
    $: oklabGradientSteps = generateOKLabGradient(startColor, endColor);

    // Update exported gradient colors
    $: hslGradientColors = hslGradientSteps;
    $: evenLumGradientColors = evenLumGradientSteps;
    $: oklabGradientColors = oklabGradientSteps;

    $: isStartColorActive = activeColor && startColor && activeColor.h === startColor.h && 
                           activeColor.s === startColor.s && activeColor.l === startColor.l;
    $: isEndColorActive = activeColor && endColor && activeColor.h === endColor.h && 
                         activeColor.s === endColor.s && activeColor.l === endColor.l;

    function generateHSLGradient(start: Color | null, end: Color | null): Color[] {
        if (!start || !end) return [];
        
        const steps = 20;
        const colors: Color[] = [start]; // Start with exact start color
        
        // Calculate shortest path for hue interpolation
        let startHue = start.h;
        let endHue = end.h;
        let hueDiff = ((endHue - startHue + 540) % 360) - 180; // Ensure shortest path
        
        // Generate intermediate steps
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            // Interpolate hue along shortest path
            const h = (startHue + hueDiff * t + 360) % 360;
            const s = start.s + t * (end.s - start.s);
            const l = start.l + t * (end.l - start.l);
            colors.push(createColor(h, s, l));
        }
        
        colors.push(end); // End with exact end color
        return colors;
    }

    function generateEvenLumGradient(start: Color | null, end: Color | null): Color[] {
        if (!start || !end) return [];
        
        const steps = 20;
        const colors: Color[] = [start]; // Start with exact start color
        
        // Calculate shortest path for hue interpolation
        let startHue = start.h;
        let endHue = end.h;
        let hueDiff = ((endHue - startHue + 540) % 360) - 180; // Ensure shortest path
        
        // Generate intermediate steps
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const targetLum = start.luminance + t * (end.luminance - start.luminance);
            
            // Interpolate hue and saturation linearly
            const h = (startHue + hueDiff * t + 360) % 360;
            const s = start.s + t * (end.s - start.s);
            
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

    function generateOKLabGradient(start: Color | null, end: Color | null): Color[] {
        if (!start || !end) return [];
        
        const steps = 20;
        const colors: Color[] = [];
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            colors.push(oklabMix(start, end, t));
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
                <span class="label">HSL ●</span>
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
                <span class="label">Even Luminance ■</span>
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
                <span class="label">OKLab ▲</span>
                <div class="bar">
                    {#each oklabGradientSteps as color}
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