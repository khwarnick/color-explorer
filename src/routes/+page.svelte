<script lang="ts">
  import ColorSpace from '$lib/components/ColorSpace.svelte';
  import ColorGrid from '$lib/components/ColorGrid.svelte';
  import ColorPicker from '$lib/components/ColorPicker.svelte';
  import ColorRelaxation from '$lib/components/ColorRelaxation.svelte';
  import ColorSaveLoad from '$lib/components/ColorSaveLoad.svelte';
  import ColorGeneration from '$lib/components/ColorGeneration.svelte';
  import { writable } from 'svelte/store';
  import type { Color } from '$lib/types';

  // Store for selected colors
  const colors = writable<Color[]>([]);
  // Store for active color
  const activeColor = writable<Color | null>(null);
  // Store for locked colors
  const lockedColors = writable<Set<number>>(new Set());

  // Store for generator hues
  let currentHues: number[] | undefined = undefined;
  // Store for active bar color index
  let activeBarColorIndex = -1;
  // Store for luminance values
  let midLightness: number | undefined = undefined;
  let highLuminance: number | undefined = undefined;
  let midLuminance: number | undefined = undefined;
  let lowLuminance: number | undefined = undefined;

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
</script>

<main class="container">
  <h1 class="title">HSL Color Explorer</h1>
  <div class="content">
    <div class="color-space">
      <ColorSpace {colors} {activeColor} {lockedColors} />
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

  .content {
    flex: 1;
    display: flex;
    gap: 1rem;
    min-height: 0;
  }

  .color-space {
    flex: 1;
    min-width: 0;
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
  }

  .control-panel {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 100%;
    overflow-y: auto;
  }
</style>
