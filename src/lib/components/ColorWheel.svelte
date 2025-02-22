<script lang="ts">
    import { onMount } from 'svelte';
    import type { Color } from '$lib/types';
    import { createColor } from '$lib/utils/color';
    import type { Writable } from 'svelte/store';

    export let activeColor: Writable<Color | null>;
    export let colors: Writable<Color[]>;
    export let size = 200;  // Size of the wheel in pixels

    let canvas: HTMLCanvasElement;
    let isDragging = false;
    let currentL = 50;  // Current lightness value

    function drawColorWheel() {
        const ctx = canvas.getContext('2d')!;
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2;  // Full radius
        const safetyPixel = 2;  // Increased to 2 pixels for extra safety

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Draw color wheel
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= radius + safetyPixel) {  // Slightly larger check
                    // Convert position to hue and saturation
                    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
                    const saturation = Math.min((distance / radius) * 100, 100);  // Clamp to 100

                    // Create color with current lightness
                    const color = createColor(hue, saturation, currentL);
                    ctx.fillStyle = `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }

        // Draw current color position if active
        if ($activeColor) {
            const h = $activeColor.h;
            const s = $activeColor.s;
            currentL = $activeColor.l;

            // Convert h,s to x,y
            const angle = (h * Math.PI) / 180;
            const distance = (s / 100) * radius;
            const x = centerX + distance * Math.cos(angle);
            const y = centerY + distance * Math.sin(angle);

            // Draw position indicator
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    function updateColorFromPosition(x: number, y: number) {
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2;

        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // If outside the wheel, clamp to the edge
        const clampedDistance = Math.min(distance, radius);
        const saturation = (clampedDistance / radius) * 100;
        const hue = ((angle * 180) / Math.PI + 360) % 360;

        // Create and update color
        const newColor = createColor(hue, saturation, currentL);
        updateStores(newColor);
    }

    function updateStores(newColor: Color) {
        if ($activeColor) {
            const index = $colors.findIndex((c: Color) => 
                c.h === $activeColor!.h && 
                c.s === $activeColor!.s && 
                c.l === $activeColor!.l
            );

            if (index !== -1) {
                const updatedColors = [...$colors];
                updatedColors[index] = newColor;
                colors.set(updatedColors);
                activeColor.set(newColor);
            }
        }
    }

    function handleMouseDown(event: MouseEvent) {
        isDragging = true;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        updateColorFromPosition(x, y);
    }

    function handleMouseMove(event: MouseEvent) {
        if (isDragging) {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            updateColorFromPosition(x, y);
        }
    }

    function handleMouseUp() {
        isDragging = false;
    }

    // Update wheel when active color changes
    $: if (canvas && $activeColor) {
        currentL = $activeColor.l;
        drawColorWheel();
    }

    onMount(() => {
        drawColorWheel();
        
        // Add global mouse event listeners
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    });
</script>

<canvas 
    bind:this={canvas}
    width={size}
    height={size}
    on:mousedown={handleMouseDown}
    class="color-wheel"
></canvas>

<style>
    .color-wheel {
        border-radius: 50%;
        cursor: pointer;
        border: 1px solid black;
        box-sizing: content-box;  /* Ensure border doesn't affect size */
    }
</style> 