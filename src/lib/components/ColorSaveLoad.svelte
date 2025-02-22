<script lang="ts">
    import type { Color } from '$lib/types';
    import { createColor } from '$lib/utils/color';
    import type { Writable } from 'svelte/store';

    export let colors: Writable<Color[]>;

    function formatColors(colors: Color[]): string {
        let output = "Color Palettes\n\n";
        
        // Process 12 palettes (2 groups of 6)
        for (let groupIndex = 0; groupIndex < 2; groupIndex++) {
            output += `Group ${groupIndex + 1}\n`;
            output += "=".repeat(20) + "\n\n";
            
            // Process 6 palettes in each group
            for (let paletteIndex = 0; paletteIndex < 6; paletteIndex++) {
                output += `Palette ${paletteIndex + 1}\n`;
                output += "-".repeat(15) + "\n";
                
                // Process 5 colors in each palette
                for (let colorIndex = 0; colorIndex < 5; colorIndex++) {
                    const color = colors[groupIndex * 30 + paletteIndex * 5 + colorIndex];
                    output += `Color ${colorIndex + 1}:\n`;
                    output += `  HSL: ${Math.round(color.h)}°, ${Math.round(color.s)}%, ${Math.round(color.l)}%\n`;
                    output += `  RGB: ${Math.round(color.rgb.r)}, ${Math.round(color.rgb.g)}, ${Math.round(color.rgb.b)}\n`;
                    output += `  Luminance: ${color.luminance.toFixed(3)}\n\n`;
                }
                output += "\n";
            }
            output += "\n";
        }
        
        return output;
    }

    function parseColors(text: string): Color[] | null {
        try {
            const newColors: Color[] = new Array(60);
            let currentGroup = -1;
            let currentPalette = -1;
            let currentColor = -1;
            let h = 0, s = 0, l = 0;
            
            const lines = text.split('\n');
            for (const line of lines) {
                if (line.startsWith('Group')) {
                    currentGroup = parseInt(line.split(' ')[1]) - 1;
                    currentPalette = -1;
                } else if (line.startsWith('Palette')) {
                    currentPalette = parseInt(line.split(' ')[1]) - 1;
                    currentColor = -1;
                } else if (line.startsWith('Color')) {
                    currentColor = parseInt(line.split(' ')[1]) - 1;
                } else if (line.trim().startsWith('HSL:')) {
                    const [hStr, sStr, lStr] = line.split(':')[1].split(',');
                    h = parseFloat(hStr);
                    s = parseFloat(sStr);
                    l = parseFloat(lStr);
                    
                    if (currentGroup >= 0 && currentPalette >= 0 && currentColor >= 0) {
                        const index = currentGroup * 30 + currentPalette * 5 + currentColor;
                        newColors[index] = createColor(h, s, l);
                    }
                }
            }
            
            // Verify we have all 60 colors
            if (newColors.some(c => !c)) {
                throw new Error("Missing colors in file");
            }
            
            return newColors;
        } catch (error) {
            console.error("Error parsing colors:", error);
            return null;
        }
    }

    async function handleSave() {
        const content = formatColors($colors);
        
        // Try using the modern File System Access API
        if ('showSaveFilePicker' in window) {
            try {
                const options = {
                    suggestedName: 'color_palettes.txt',
                    types: [{
                        description: 'Text file',
                        accept: { 'text/plain': ['.txt'] }
                    }]
                };
                
                // Type assertion for showSaveFilePicker
                const picker = (window as any).showSaveFilePicker as (options: any) => Promise<FileSystemFileHandle>;
                const handle = await picker(options);
                
                // Create writable stream and write content
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
            } catch (err: unknown) {
                // User cancelled or other error
                if (err instanceof Error && err.name !== 'AbortError') {
                    console.error('Error saving file:', err);
                    alert('Error saving file. Please try again.');
                }
            }
        } else {
            // Fallback for browsers without File System Access API
            const blob = new Blob([content], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'color_palettes.txt';
            a.click();
            URL.revokeObjectURL(a.href);
        }
    }

    async function handleLoad() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            
            const text = await file.text();
            const newColors = parseColors(text);
            
            if (newColors) {
                colors.set(newColors);
            } else {
                alert('Error loading colors. Please check the file format.');
            }
        };
        
        input.click();
    }
</script>

<div class="save-load-panel">
    <h2>Save/Load Colors</h2>
    <div class="buttons">
        <button on:click={handleSave}>Save Colors</button>
        <button on:click={handleLoad}>Load Colors</button>
    </div>
</div>

<style>
    .save-load-panel {
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

    .buttons {
        display: flex;
        gap: 1rem;
    }

    button {
        flex: 1;
        padding: 0.5rem 1rem;
        font-size: 1rem;
        background-color: #4a4a4a;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    button:hover {
        background-color: #5a5a5a;
    }

    button:active {
        background-color: #3a3a3a;
    }
</style> 