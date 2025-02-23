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
    <div class="picker-content">
        <div class="left-panel">
            <div class="preview-section">
                {#if $activeColor}
                    <div 
                        class="color-preview"
                        style="background-color: rgb({$activeColor.rgb.r}, {$activeColor.rgb.g}, {$activeColor.rgb.b})"
                    >
                        <div class="info">
                            <div>RGB: ({Math.round($activeColor.rgb.r)}, {Math.round($activeColor.rgb.g)}, {Math.round($activeColor.rgb.b)})</div>
                            <div>HSL: ({Math.round($activeColor.h)}, {Math.round($activeColor.s)}%, {$activeColor.l.toFixed(1)}%)</div>
                            <div>Luminance: {$activeColor.luminance.toFixed(3)}</div>
                        </div>
                    </div>
                {:else}
                    <div class="color-preview empty">
                        <div class="empty-message">
                            Select a color from the grid or 3D graph to edit
                        </div>
                    </div>
                {/if}
            </div>
            
            <div class="sliders" class:disabled={!$activeColor}>
                <label>
                    <div class="slider-label">Hue: {Math.round(h)}</div>
                    <input 
                        type="range" 
                        min="0" 
                        max="360" 
                        bind:value={h}
                        on:input={updateColor}
                        disabled={!$activeColor}
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
                        disabled={!$activeColor}
                    >
                </label>
                
                <label>
                    <div class="slider-label">Lightness: {l.toFixed(1)}</div>
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="0.2"
                        bind:value={l}
                        on:input={updateColor}
                        disabled={!$activeColor}
                    >
                </label>
            </div>
        </div>

        <div class="right-panel">
            <ColorWheel {activeColor} {colors} />
        </div>
    </div>
</div>

<style>
    .color-picker {
        background: white;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        width: 100%;
        box-sizing: border-box;
    }

    .picker-content {
        display: flex;
        gap: 1.5rem;
        height: 220px;
    }

    .left-panel {
        flex: 1;
        min-width: 220px;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .preview-section {
        flex: 1;
        min-height: 0;
    }

    .right-panel {
        display: flex;
        align-items: flex-start;
        justify-content: center;
    }

    .color-preview {
        width: 100%;
        height: 100%;
        border-radius: 4px;
        border: 1px solid black;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 0.5rem;
        box-sizing: border-box;
    }

    .color-preview.empty {
        background: #f0f0f0;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 1rem;
    }

    .empty-message {
        color: #666;
        font-style: italic;
    }

    .info {
        font-family: monospace;
        font-size: 0.9rem;
        white-space: nowrap;
        color: white;
        text-shadow: 0 0 2px black;
    }

    .sliders {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .sliders.disabled {
        opacity: 0.5;
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

    input[type="range"]:disabled {
        cursor: not-allowed;
    }
</style> 