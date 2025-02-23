<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { Color } from '$lib/types';
    import { createColor } from '$lib/utils/color';
    import type { Writable } from 'svelte/store';

    export let colors: Writable<Color[]>;
    export let activeColor: Writable<Color | null>;

    const dispatch = createEventDispatcher();
    let colorBar: HTMLCanvasElement;
    let generatorColors: Color[] = [];

    // Luminance parameters
    let highLuminance = 0.500;  // Default high luminance (0-1)
    let midLuminance = 0.216;   // Default mid luminance (0-1)
    let lowLuminance = 0.050;   // Default low luminance (0-1)

    function getBaseHue(index: number): number {
        // For first 6 colors: 0, 60, 120, 180, 240, 300
        // For next 6 colors: 30, 90, 150, 210, 270, 330
        return (index < 6) ? index * 60 : ((index - 6) * 60 + 30);
    }

    function findHighestSaturationForLuminance(hue: number, targetLuminance: number): { saturation: number, lightness: number } {
        let left = 0;
        let right = 100;
        let bestSat = 0;
        let bestLight = 50;
        
        // Binary search for highest saturation that can achieve target luminance
        while (right - left > 1) {
            const midSat = Math.floor((left + right) / 2);
            let foundLightness = false;
            
            // For this saturation, search for lightness that gives target luminance
            for (let l = 0; l <= 100; l++) {
                const color = createColor(hue, midSat, l);
                if (Math.abs(color.luminance - targetLuminance) < 0.005) {
                    bestSat = midSat;
                    bestLight = l;
                    foundLightness = true;
                    left = midSat;
                    break;
                }
            }
            
            if (!foundLightness) {
                right = midSat;
            }
        }
        
        return { saturation: bestSat, lightness: bestLight };
    }

    function findMidLuminanceColor(targetLuminance: number): number {
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

    function updateGeneratorColors() {
        // Update generator colors based on luminance parameters
        generatorColors = Array(12).fill(null).map((_, i) => {
            const hue = getBaseHue(i);
            const targetLuminance = i < 6 ? highLuminance : lowLuminance;
            const { saturation, lightness } = findHighestSaturationForLuminance(hue, targetLuminance);
            return createColor(hue, saturation, lightness);
        });

        if (colorBar) drawColorBar();
        
        // Find mid luminance gray
        const midLightnessValue = findMidLuminanceColor(midLuminance);
        
        // Notify parent to regenerate colors with new hues and luminance values
        dispatch('huesChanged', { 
            hues: generatorColors.map(c => c.h),
            midLightness: midLightnessValue,
            highLuminance,
            midLuminance,
            lowLuminance
        });
    }

    function drawColorBar() {
        const ctx = colorBar.getContext('2d')!;
        const width = colorBar.width;
        const height = colorBar.height - 20; // Leave space for tick marks

        // Clear the entire canvas first
        ctx.clearRect(0, 0, width, colorBar.height);

        // Draw the color spectrum
        for (let x = 0; x < width; x++) {
            const hue = (x / width) * 360;
            ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            ctx.fillRect(x, 0, 1, height);
        }

        // Draw tick marks for each generator color
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        generatorColors.forEach(color => {
            const x = (color.h / 360) * width;
            ctx.beginPath();
            ctx.moveTo(x, height - 5);
            ctx.lineTo(x, height + 15);
            ctx.stroke();
        });
    }

    function handleColorClick(color: Color) {
        dispatch('huesChanged', { 
            hues: generatorColors.map(c => c.h),
            midLightness: findMidLuminanceColor(midLuminance),
            highLuminance,
            midLuminance,
            lowLuminance
        });
    }

    // Update colors when luminance values change
    $: {
        if (highLuminance >= 0 && highLuminance <= 1 &&
            midLuminance >= 0 && midLuminance <= 1 &&
            lowLuminance >= 0 && lowLuminance <= 1) {
            updateGeneratorColors();
        }
    }

    // Add hue slider for active color bar color
    let activeBarColorIndex = -1;

    function handleHueChange(event: Event) {
        const newHue = parseFloat((event.target as HTMLInputElement).value);
        if (activeBarColorIndex !== -1) {
            const targetLuminance = activeBarColorIndex < 6 ? highLuminance : lowLuminance;
            const { saturation, lightness } = findHighestSaturationForLuminance(newHue, targetLuminance);
            generatorColors[activeBarColorIndex] = createColor(newHue, saturation, lightness);
            drawColorBar();
            dispatch('huesChanged', { 
                hues: generatorColors.map(c => c.h),
                midLightness: findMidLuminanceColor(midLuminance),
                highLuminance,
                midLuminance,
                lowLuminance
            });
        }
    }

    function handleBarColorClick(color: Color, index: number) {
        activeBarColorIndex = index;
        // Clear the active color in the color picker
        activeColor.set(null);
        // Dispatch the active bar color index
        dispatch('barColorSelected', { index });
    }

    onMount(() => {
        updateGeneratorColors();
    });
</script>

<div class="color-generation">
    <h2>Color Generation</h2>
    <div class="luminance-controls">
        <div class="luminance-row">
            <label>
                <span>High Luminance:</span>
                <input 
                    type="number" 
                    min="0"
                    max="1"
                    step="0.005"
                    bind:value={highLuminance}
                >
            </label>
            <div 
                class="luminance-preview"
                style="background-color: rgb({createColor(0, 0, findMidLuminanceColor(highLuminance)).rgb.r}, {createColor(0, 0, findMidLuminanceColor(highLuminance)).rgb.g}, {createColor(0, 0, findMidLuminanceColor(highLuminance)).rgb.b})"
            ></div>
        </div>
        <div class="luminance-row">
            <label>
                <span>Mid Luminance:</span>
                <input 
                    type="number" 
                    min="0"
                    max="1"
                    step="0.005"
                    bind:value={midLuminance}
                >
            </label>
            <div 
                class="luminance-preview"
                style="background-color: rgb({createColor(0, 0, findMidLuminanceColor(midLuminance)).rgb.r}, {createColor(0, 0, findMidLuminanceColor(midLuminance)).rgb.g}, {createColor(0, 0, findMidLuminanceColor(midLuminance)).rgb.b})"
            ></div>
        </div>
        <div class="luminance-row">
            <label>
                <span>Low Luminance:</span>
                <input 
                    type="number" 
                    min="0"
                    max="1"
                    step="0.005"
                    bind:value={lowLuminance}
                >
            </label>
            <div 
                class="luminance-preview"
                style="background-color: rgb({createColor(0, 0, findMidLuminanceColor(lowLuminance)).rgb.r}, {createColor(0, 0, findMidLuminanceColor(lowLuminance)).rgb.g}, {createColor(0, 0, findMidLuminanceColor(lowLuminance)).rgb.b})"
            ></div>
        </div>
    </div>
    <div class="color-bar-container">
        <canvas 
            bind:this={colorBar}
            width="550"
            height="50"
            class="color-bar"
        ></canvas>
    </div>
    <div class="generator-colors">
        {#each generatorColors as color, i}
            <button
                class="color-button"
                class:active={i === activeBarColorIndex}
                style="background-color: rgb({color.rgb.r}, {color.rgb.g}, {color.rgb.b})"
                on:click={() => handleBarColorClick(color, i)}
                aria-label="Color {i + 1}: RGB ({color.rgb.r}, {color.rgb.g}, {color.rgb.b})"
            ></button>
        {/each}
    </div>
    {#if activeBarColorIndex !== -1}
        <div class="hue-slider">
            <label>
                Selected Color Hue:
                <input 
                    type="range" 
                    min="0"
                    max="360"
                    step="1"
                    value={generatorColors[activeBarColorIndex].h}
                    on:input={handleHueChange}
                >
                <span class="hue-value">{Math.round(generatorColors[activeBarColorIndex].h)}°</span>
            </label>
        </div>
    {/if}
</div>

<style>
    .color-generation {
        background: white;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    h2 {
        margin: 0 0 1rem 0;
        font-size: 1.2rem;
        color: #333;
    }

    .luminance-controls {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .luminance-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .luminance-row label {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .luminance-row label span {
        min-width: 110px;
    }

    .luminance-row input {
        width: 80px;
        padding: 0.25rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        text-align: right;
    }

    .luminance-preview {
        width: 40px;
        height: 24px;
        border: 1px solid #ccc;
        border-radius: 4px;
        margin-left: 0.5rem;
    }

    .color-bar-container {
        margin-bottom: 1rem;
    }

    .color-bar {
        width: 100%;
        border-radius: 4px;
        border: 1px solid #ccc;
    }

    .generator-colors {
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
    }

    .color-button {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        padding: 0;
    }

    .color-button.active {
        outline: 2px solid black;
    }

    .hue-slider {
        margin-top: 1rem;
    }

    .hue-slider label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .hue-slider input[type="range"] {
        flex: 1;
    }

    .hue-value {
        min-width: 3em;
        text-align: right;
    }
</style> 