<script lang="ts">
    import { createColor } from '$lib/utils/color';
    import type { Color } from '$lib/types';
    import type { Writable } from 'svelte/store';
    import ColorWheel from './ColorWheel.svelte';
    
    export let activeColor: Writable<Color | null>;
    export let colors: Writable<Color[]>;
    
    let h = 0;
    let s = 70;
    let l = 50;
    
    $: if ($activeColor) {
        h = $activeColor.h;
        s = $activeColor.s;
        l = $activeColor.l;
    }
    
    function updateColor() {
        if (!$activeColor) return;
        
        const newColor = createColor(h, s, l);
        
        // Find the index by comparing color values instead of object reference
        const index = $colors.findIndex((c: Color) => 
            c.h === $activeColor!.h && 
            c.s === $activeColor!.s && 
            c.l === $activeColor!.l
        );
        
        if (index !== -1) {
            // Create a new array with the updated color
            const updatedColors = [...$colors];
            updatedColors[index] = newColor;
            
            // Update both stores
            colors.set(updatedColors);
            activeColor.set(newColor);
        }
    }
</script>

<div class="color-picker">
    {#if $activeColor}
        <div class="picker-content">
            <div class="left-panel">
                <div class="preview-section">
                    <div 
                        class="color-preview"
                        style="background-color: rgb({$activeColor.rgb.r}, {$activeColor.rgb.g}, {$activeColor.rgb.b})"
                    ></div>
                    <div class="info">
                        <div>RGB: ({Math.round($activeColor.rgb.r)}, {Math.round($activeColor.rgb.g)}, {Math.round($activeColor.rgb.b)})</div>
                        <div>Luminance: {$activeColor.luminance.toFixed(3)}</div>
                    </div>
                </div>
                
                <div class="sliders">
                    <label>
                        <div class="slider-label">Hue: {Math.round(h)}</div>
                        <input 
                            type="range" 
                            min="0" 
                            max="360" 
                            bind:value={h}
                            on:input={updateColor}
                        >
                    </label>
                    
                    <label>
                        <div class="slider-label">Saturation: {Math.round(s)}</div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            bind:value={s}
                            on:input={updateColor}
                        >
                    </label>
                    
                    <label>
                        <div class="slider-label">Lightness: {Math.round(l)}</div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            bind:value={l}
                            on:input={updateColor}
                        >
                    </label>
                </div>
            </div>

            <div class="right-panel">
                <ColorWheel {activeColor} {colors} />
            </div>
        </div>
    {:else}
        <div class="no-selection">
            Select a color from the grid to edit
        </div>
    {/if}
</div>

<style>
    .color-picker {
        background: white;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .picker-content {
        display: flex;
        gap: 1.5rem;
    }

    .left-panel {
        flex: 1;
        min-width: 220px;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .preview-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .right-panel {
        display: flex;
        align-items: flex-start;
        justify-content: center;
    }

    .color-preview {
        width: 100%;
        height: 100px;
        border-radius: 4px;
        border: 1px solid black;
    }

    .info {
        font-family: monospace;
        font-size: 0.9rem;
        white-space: nowrap;
    }

    .sliders {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .slider-label {
        font-size: 0.9rem;
        margin-bottom: -0.25rem;
    }

    input[type="range"] {
        width: 100%;
    }

    .no-selection {
        text-align: center;
        padding: 2rem;
        color: #666;
    }
</style> 