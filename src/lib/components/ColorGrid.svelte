<script lang="ts">
    import { onMount } from 'svelte';
    import type { Color } from '$lib/types';
    import { getDefaultColors } from '$lib/utils/color';
    import { writable } from 'svelte/store';
    import { springSystem, initializeDefaultConnections } from '$lib/stores/springs';
    import { onDestroy } from 'svelte';
    import { createEventDispatcher } from 'svelte';
    
    export let colors: any;  // Svelte store
    export let activeColor: any;  // Svelte store
    export let lockedColors: any;  // Svelte store
    export let generatorHues: number[] | undefined = undefined;
    export let activeBarColorIndex: number = -1;
    export let midLightness: number | undefined = undefined;
    export let highLuminance: number | undefined = undefined;
    export let midLuminance: number | undefined = undefined;
    export let lowLuminance: number | undefined = undefined;

    let isRelaxing = false;
    let animationFrameId: number | null = null;
    
    const dispatch = createEventDispatcher();

    onMount(() => {
        colors.set(getDefaultColors(generatorHues, midLightness, highLuminance, midLuminance, lowLuminance));
        initializeDefaultConnections();
    });
    
    // Watch for changes in generator hues and luminance values
    $: if (generatorHues || midLightness !== undefined || highLuminance !== undefined || midLuminance !== undefined || lowLuminance !== undefined) {
        colors.set(getDefaultColors(generatorHues, midLightness, highLuminance, midLuminance, lowLuminance));
    }

    function handleColorClick(event: MouseEvent, index: number) {
        if (event.button === 2) {  // Right click
            event.preventDefault();
            lockedColors.update((set: Set<number>) => {
                const newSet = new Set(set);
                if (newSet.has(index)) {
                    newSet.delete(index);
                } else {
                    newSet.add(index);
                }
                return newSet;
            });
        } else {  // Left click
            activeColor.set($colors[index]);
        }
    }

    function isColorLocked(index: number): boolean {
        return $lockedColors.has(index);
    }

    function isColorActive(color: Color): boolean {
        if (!$activeColor) return false;
        return color.h === $activeColor.h && 
               color.s === $activeColor.s && 
               color.l === $activeColor.l;
    }

    function isPaletteActive(groupIndex: number, paletteIndex: number): boolean {
        // For first group (0-5), activeBarColorIndex is the same
        // For second group (6-11), subtract 6 from activeBarColorIndex
        if (groupIndex === 0) {
            return activeBarColorIndex < 6 && paletteIndex === activeBarColorIndex;
        } else {
            return activeBarColorIndex >= 6 && paletteIndex === (activeBarColorIndex - 6);
        }
    }

    function startRelaxing() {
        if (isRelaxing) return;
        isRelaxing = true;
        animate();
    }

    function stopRelaxing() {
        isRelaxing = false;
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    function animate() {
        if (!isRelaxing) return;
        
        const newColors = springSystem.simulateStep($colors, $lockedColors);
        colors.set(newColors);
        
        animationFrameId = requestAnimationFrame(animate);
    }

    onDestroy(() => {
        stopRelaxing();
    });

    // Dispatch relaxation handlers
    dispatch('relaxHandlers', {
        start: startRelaxing,
        stop: stopRelaxing
    });
</script>

{#if $colors && $colors.length === 60}
    <div class="grid-container">
        {#each Array(2) as _, groupIndex}
            <div class="grid-section">
                <h3 class="grid-label">{groupIndex === 0 ? 'Increasing luminance' : 'Decreasing luminance'}</h3>
                <div class="palette-group">
                    {#each Array(6) as _, paletteIndex}
                        <div class="palette" class:active-palette={isPaletteActive(groupIndex, paletteIndex)}>
                            {#each Array(5) as _, colorIndex}
                                {@const i = groupIndex * 30 + paletteIndex * 5 + colorIndex}
                                <button
                                    class="color-box"
                                    class:active={isColorActive($colors[i])}
                                    class:locked={isColorLocked(i)}
                                    style="background-color: rgb({$colors[i].rgb.r}, {$colors[i].rgb.g}, {$colors[i].rgb.b})"
                                    on:mousedown={(e) => handleColorClick(e, i)}
                                >
                                    <div class="rgb-values">
                                        <div>R: {Math.round($colors[i].rgb.r)}</div>
                                        <div>G: {Math.round($colors[i].rgb.g)}</div>
                                        <div>B: {Math.round($colors[i].rgb.b)}</div>
                                    </div>
                                    {#if isColorLocked(i)}
                                        <div class="lock-indicator">✕</div>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    {/each}
                </div>
            </div>
            {#if groupIndex === 0}
                <div class="group-separator"></div>
            {/if}
        {/each}
    </div>
{:else}
    <div class="color-grid loading">
        <p>Initializing colors...</p>
    </div>
{/if}

<style>
    .grid-container {
        display: flex;
        gap: 1rem;
        padding: 1rem;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        width: 100%;
        box-sizing: border-box;
    }

    .grid-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .grid-label {
        margin: 0;
        padding: 0;
        font-size: 1rem;
        color: #333;
        text-align: center;
    }

    .palette-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .palette {
        display: flex;
        gap: 4px;
        padding: 2px;
        border-radius: 4px;
    }

    .palette.active-palette {
        outline: 2px solid black;
    }

    .color-box {
        flex: 1;
        aspect-ratio: 1;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        padding: 4px;
        min-width: 0;
    }

    .color-box.active {
        outline: 2px solid #000;
    }

    .color-box.locked {
        cursor: not-allowed;
    }

    .rgb-values {
        font-size: 8px;
        color: white;
        text-shadow: 0 0 2px black;
        text-align: center;
        line-height: 1.2;
        display: flex;
        flex-direction: column;
        gap: 1px;
        white-space: nowrap;
    }

    .lock-indicator {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 2em;
        color: black;
        text-shadow: 0 0 2px white;
        pointer-events: none;
        opacity: 0.7;
    }

    .group-separator {
        width: 2px;
        background: black;
        margin: 0 0.5rem;
    }

    .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 200px;
    }

    .loading p {
        color: #666;
        font-style: italic;
    }
</style> 