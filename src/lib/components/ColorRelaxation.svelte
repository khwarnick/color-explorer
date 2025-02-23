<script lang="ts">
    import { writable } from 'svelte/store';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    const defaultSpringConstant = 0.1;
    const defaultDamping = 0.2;
    const defaultTimestep = 1;

    export let startRelaxing: () => void;
    export let stopRelaxing: () => void;

    // Spring system parameters
    const springConstant = writable(defaultSpringConstant);
    const damping = writable(defaultDamping);
    const timestep = writable(defaultTimestep);

    // Update CSS variables only in the browser
    onMount(() => {
        updateCSSVariables($springConstant, $damping, $timestep);
        return () => {
            // Clean up by resetting to defaults if needed
            updateCSSVariables(defaultSpringConstant, defaultDamping, defaultTimestep);
        };
    });

    function updateCSSVariables(spring: number, damp: number, time: number) {
        if (!browser) return;
        document.documentElement.style.setProperty('--spring-constant', spring.toString());
        document.documentElement.style.setProperty('--damping', damp.toString());
        document.documentElement.style.setProperty('--timestep', time.toString());
    }

    // Watch for changes and update CSS variables
    $: if (browser && ($springConstant !== undefined || $damping !== undefined || $timestep !== undefined)) {
        updateCSSVariables($springConstant, $damping, $timestep);
    }
</script>

<div class="relaxation-panel">
    <h2>Color Relaxation</h2>
    
    <div class="parameters">
        <label>
            Spring Constant:
            <input 
                type="number" 
                bind:value={$springConstant}
                min="0"
                max="1"
                step="0.01"
                id="spring-constant"
                name="spring-constant"
            >
        </label>
        
        <label>
            Damping:
            <input 
                type="number" 
                bind:value={$damping}
                min="0"
                max="1"
                step="0.01"
                id="damping"
                name="damping"
            >
        </label>
        
        <label>
            Timestep:
            <input 
                type="number" 
                bind:value={$timestep}
                min="0.01"
                max="1"
                step="0.01"
                id="timestep"
                name="timestep"
            >
        </label>
    </div>

    <button 
        class="relax-button"
        on:mousedown={startRelaxing}
        on:mouseup={stopRelaxing}
        on:mouseleave={stopRelaxing}
    >
        Relax Colors
    </button>
</div>

<style>
    .relaxation-panel {
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

    .parameters {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    label {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
    }

    input {
        width: 80px;
        padding: 0.25rem;
        border: 1px solid #ccc;
        border-radius: 4px;
    }

    .relax-button {
        width: 100%;
        padding: 0.5rem 1rem;
        font-size: 1rem;
        background-color: #4a4a4a;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .relax-button:hover {
        background-color: #5a5a5a;
    }

    .relax-button:active {
        background-color: #3a3a3a;
    }
</style> 