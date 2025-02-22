<script lang="ts">
  import ColorSpace from '$lib/components/ColorSpace.svelte';
  import ColorGrid from '$lib/components/ColorGrid.svelte';
  import ColorPicker from '$lib/components/ColorPicker.svelte';
  import ColorRelaxation from '$lib/components/ColorRelaxation.svelte';
  import ColorSaveLoad from '$lib/components/ColorSaveLoad.svelte';
  import { writable } from 'svelte/store';
  import type { Color } from '$lib/types';

  // Store for selected colors
  const colors = writable<Color[]>([]);
  // Store for active color
  const activeColor = writable<Color | null>(null);
  // Store for locked colors
  const lockedColors = writable<Set<number>>(new Set());

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
        <ColorPicker {activeColor} {colors} />
        <ColorGrid {colors} {activeColor} {lockedColors} on:relaxHandlers={handleRelaxStart} />
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
    width: 500px;
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
