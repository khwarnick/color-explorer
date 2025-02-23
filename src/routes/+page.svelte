<script lang="ts">
  import ColorSpace from '$lib/components/ColorSpace.svelte';
  import ColorGrid from '$lib/components/ColorGrid.svelte';
  import ColorPicker from '$lib/components/ColorPicker.svelte';
  import ColorRelaxation from '$lib/components/ColorRelaxation.svelte';
  import ColorSaveLoad from '$lib/components/ColorSaveLoad.svelte';
  import ColorGeneration from '$lib/components/ColorGeneration.svelte';
  import ColorGradients from '$lib/components/ColorGradients.svelte';
  import { writable } from 'svelte/store';
  import type { Color } from '$lib/types';
  import { createColor } from '$lib/utils/color';

  // Store for HSL tab colors
  const hslColors = writable<Color[]>([]);
  const hslActiveColor = writable<Color | null>(null);
  const hslLockedColors = writable<Set<number>>(new Set());

  // Store for Oklab tab colors
  const oklabColors = writable<Color[]>([]);
  const oklabActiveColor = writable<Color | null>(null);
  const oklabLockedColors = writable<Set<number>>(new Set());
  const oklabStartColor = writable<Color | null>(createColor(0, 100, 50));  // Initialize to red
  const oklabEndColor = writable<Color | null>(createColor(240, 100, 50));  // Initialize to blue
  const oklabActiveGradientColor = writable<'start' | 'end' | null>(null);  // Track which gradient color is active

  // Stores for gradient visualization
  const hslGradientColors = writable<Color[]>([]);
  const evenLumGradientColors = writable<Color[]>([]);
  const oklabGradientColors = writable<Color[]>([]);

  // Computed stores based on active tab
  $: colors = activeTab === 'hsl' ? hslColors : oklabColors;
  $: activeColor = activeTab === 'hsl' ? hslActiveColor : oklabActiveColor;
  $: lockedColors = activeTab === 'hsl' ? hslLockedColors : oklabLockedColors;

  // Store for generator hues
  let currentHues: number[] | undefined = undefined;
  // Store for active bar color index
  let activeBarColorIndex = -1;
  // Store for luminance values
  let midLightness: number | undefined = undefined;
  let highLuminance: number | undefined = undefined;
  let midLuminance: number | undefined = undefined;
  let lowLuminance: number | undefined = undefined;

  // Active tab state
  let activeTab = 'hsl';

  function handleHuesChanged(event: CustomEvent) {
    currentHues = event.detail.hues;
    midLightness = event.detail.midLightness;
    highLuminance = event.detail.highLuminance;
    midLuminance = event.detail.midLuminance;
    lowLuminance = event.detail.lowLuminance;
  }

  function handleBarColorSelected(event: CustomEvent) {
    activeBarColorIndex = event.detail.index;
  }

  // Relaxation handlers
  let startRelaxing: () => void;
  let stopRelaxing: () => void;

  function handleRelaxStart(event: CustomEvent) {
    startRelaxing = event.detail.start;
    stopRelaxing = event.detail.stop;
  }

  function handleGradientColorSelected(event: CustomEvent) {
    const color = event.detail.color;
    if (color === $oklabStartColor) {
      oklabActiveGradientColor.set('start');
    } else if (color === $oklabEndColor) {
      oklabActiveGradientColor.set('end');
    }
    oklabActiveColor.set(color);
  }

  // Update gradient colors when color picker changes active color
  $: if ($oklabActiveColor && $oklabActiveGradientColor) {
    if ($oklabActiveGradientColor === 'start') {
      oklabStartColor.set($oklabActiveColor);
    } else if ($oklabActiveGradientColor === 'end') {
      oklabEndColor.set($oklabActiveColor);
    }
  }

  // Update colors array for color picker to show gradient colors
  $: if (activeTab === 'oklab') {
    oklabColors.set([$oklabStartColor, $oklabEndColor].filter((c): c is Color => c !== null));
  }

  // Clear active gradient color when switching tabs
  $: if (activeTab !== 'oklab') {
    oklabActiveGradientColor.set(null);
  }
</script>

<main class="container">
  <h1 class="title">HSL Color Explorer - Evenly Changing Luminance Gradients</h1>
  
  <div class="tabs">
    <button 
      class="tab-button" 
      class:active={activeTab === 'hsl'} 
      on:click={() => activeTab = 'hsl'}
    >
      HSL gradient construction
    </button>
    <button 
      class="tab-button" 
      class:active={activeTab === 'oklab'} 
      on:click={() => activeTab = 'oklab'}
    >
      Oklab gradient comparison
    </button>
  </div>

  <div class="scrollable-content">
    {#if activeTab === 'hsl'}
      <div class="content">
        <div class="color-space">
          <ColorSpace 
            colors={hslColors} 
            activeColor={hslActiveColor} 
            lockedColors={hslLockedColors}
            showEqualLuminancePlot={true}
          />
        </div>
        <div class="controls">
          <div class="control-panel">
            <ColorGeneration {colors} {activeColor} on:huesChanged={handleHuesChanged} on:barColorSelected={handleBarColorSelected} />
            <ColorGrid {colors} {activeColor} {lockedColors} {activeBarColorIndex} generatorHues={currentHues} {midLightness} {highLuminance} {midLuminance} {lowLuminance} on:relaxHandlers={handleRelaxStart} />
            <ColorPicker {activeColor} {colors} />
            <ColorRelaxation {startRelaxing} {stopRelaxing} />
            <ColorSaveLoad {colors} />
          </div>
        </div>
      </div>
    {:else}
      <div class="content">
        <div class="color-space">
          <ColorSpace 
            colors={oklabColors} 
            activeColor={oklabActiveColor} 
            lockedColors={oklabLockedColors}
            showEqualLuminancePlot={false}
            hslGradientColors={$hslGradientColors}
            evenLumGradientColors={$evenLumGradientColors}
            oklabGradientColors={$oklabGradientColors}
          />
        </div>
        <div class="controls">
          <div class="control-panels-stack">
            <div class="control-panel">
              <ColorGradients 
                startColor={$oklabStartColor}
                endColor={$oklabEndColor}
                activeColor={$oklabActiveColor}
                on:colorSelected={handleGradientColorSelected}
                bind:hslGradientColors={$hslGradientColors}
                bind:evenLumGradientColors={$evenLumGradientColors}
                bind:oklabGradientColors={$oklabGradientColors}
              />
            </div>
            <div class="control-panel">
              <ColorPicker activeColor={oklabActiveColor} colors={oklabColors} />
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  .title {
    font-size: 2rem;
    font-weight: bold;
    color: #333;
    margin: 0 0 1rem 0;
    padding: 0;
  }

  .container {
    height: 100%;
    max-height: 100%;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .scrollable-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden; /* Disable main page scrolling */
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tab-button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px 8px 0 0;
    background: #e0e0e0;
    color: #666;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-button:hover {
    background: #d0d0d0;
  }

  .tab-button.active {
    background: #4a4a4a;
    color: white;
  }

  .content {
    flex: 1;
    display: flex;
    gap: 1rem;
    min-height: 0;
  }

  .color-space {
    flex: 1;
    min-width: 0;
    height: 800px; /* Reduced height for color space */
    background: #f0f0f0;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
  }

  .controls {
    display: flex;
    justify-content: flex-end;
    width: 600px;
    min-width: 0;
    flex-shrink: 0;
    overflow-y: auto; /* Keep scrolling for right panel */
    max-height: 800px; /* Match color space height */
  }

  .control-panels-stack {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .control-panel {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .placeholder {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    text-align: center;
  }

  .placeholder h2 {
    margin: 0 0 1rem 0;
    color: #333;
  }

  .placeholder p {
    color: #666;
    margin: 0;
  }
</style>
