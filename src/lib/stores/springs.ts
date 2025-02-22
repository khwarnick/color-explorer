import { writable } from 'svelte/store';
import type { Color } from '$lib/types';
import { createColor, calculateLuminance } from '$lib/utils/color';
import { browser } from '$app/environment';

const DEFAULT_SPRING_CONSTANT = 0.1;
const DEFAULT_DAMPING = 0.2;
const DEFAULT_TIMESTEP = 1.;

// Store for spring connections
export interface SpringConnection {
    index1: number;
    index2: number;
}

export const springConnections = writable<SpringConnection[]>([]);

// Function to add a spring connection
export function addSpringConnection(index1: number, index2: number) {
    springConnections.update(connections => {
        // Check if connection already exists
        const exists = connections.some(
            conn => (conn.index1 === index1 && conn.index2 === index2) ||
                   (conn.index1 === index2 && conn.index2 === index1)
        );
        if (!exists) {
            return [...connections, { index1, index2 }];
        }
        return connections;
    });
}

// Function to remove a spring connection
export function removeSpringConnection(index1: number, index2: number) {
    springConnections.update(connections => 
        connections.filter(conn => 
            !(conn.index1 === index1 && conn.index2 === index2) &&
            !(conn.index1 === index2 && conn.index2 === index1)
        )
    );
}

// Function to clear all spring connections
export function clearSpringConnections() {
    springConnections.set([]);
}

// Function to create a circular chain of connections
export function createCircularChain(indices: number[]) {
    for (let i = 0; i < indices.length; i++) {
        const nextIndex = (i + 1) % indices.length;
        addSpringConnection(indices[i], indices[nextIndex]);
    }
}

// Initialize circular chains for all color indices
export function initializeDefaultConnections() {
    clearSpringConnections();  // Clear all connections once at the start
    
    // For each position within a palette (0-4)
    for (let colorIndex = 0; colorIndex < 5; colorIndex++) {
        // Create chains for both groups
        for (let groupIndex = 0; groupIndex < 2; groupIndex++) {
            // Get indices of colors at this position in each palette of this group
            const indices = Array(6).fill(0).map((_, i) => groupIndex * 30 + i * 5 + colorIndex);
            createCircularChain(indices);
        }
    }
}

function getSpringConstant(): number {
    if (!browser) return DEFAULT_SPRING_CONSTANT;
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--spring-constant')) || DEFAULT_SPRING_CONSTANT;
}

function getDamping(): number {
    if (!browser) return DEFAULT_DAMPING;
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--damping')) || DEFAULT_DAMPING;
}

function getTimestep(): number {
    if (!browser) return DEFAULT_TIMESTEP;
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--timestep')) || DEFAULT_TIMESTEP;
}

interface ColorVelocity {
    h: number;
    s: number;
    l: number;
}

// Helper function to estimate lightness change needed for a given luminance change
function estimateLightnessChange(color: Color, targetLuminance: number): number {
    // Try a small change in lightness to estimate the relationship
    const testColor = createColor(color.h, color.s, color.l + 1);
    const luminanceDiff = testColor.luminance - color.luminance;
    
    // Use this to estimate the needed lightness change
    // Add a small factor (0.5) to prevent overshooting
    return 0.5 * (targetLuminance - color.luminance) / (luminanceDiff || 0.001);
}

export function createSpringSystem() {
    const velocities = new Map<number, ColorVelocity>();
    
    function initializeVelocities(colors: Color[]) {
        velocities.clear();
        colors.forEach((_, i) => {
            velocities.set(i, { h: 0, s: 0, l: 0 });
        });
    }

    function calculateSpringForce(pos1: number, pos2: number): number {
        // Calculate shortest distance considering periodic boundary
        let diff = pos2 - pos1;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff * getSpringConstant();
    }

    function getConnectedIndices(index: number): number[] {
        let connections: SpringConnection[] = [];
        springConnections.subscribe(value => connections = value)();
        
        return connections
            .filter(conn => conn.index1 === index || conn.index2 === index)
            .map(conn => conn.index1 === index ? conn.index2 : conn.index1);
    }

    function simulateStep(colors: Color[], lockedIndices: Set<number>) {
        if (velocities.size === 0) initializeVelocities(colors);
        
        const newColors = [...colors];
        const forces = new Map<number, ColorVelocity>();

        // Calculate forces for each color
        for (let i = 0; i < colors.length; i++) {
            if (lockedIndices.has(i)) continue;

            const connectedIndices = getConnectedIndices(i);
            const color = colors[i];
            let totalForceH = 0;
            let totalForceS = 0;
            let totalForceLuminance = 0;

            // Sum up forces from all connected colors
            for (const connectedIndex of connectedIndices) {
                const connectedColor = colors[connectedIndex];
                totalForceH += calculateSpringForce(color.h, connectedColor.h);
                totalForceS += (connectedColor.s - color.s) * getSpringConstant();
                
                // Calculate force based on luminance difference
                totalForceLuminance += (connectedColor.luminance - color.luminance) * getSpringConstant();
            }

            // Convert luminance force to approximate lightness force
            const lightnessForce = estimateLightnessChange(color, color.luminance + totalForceLuminance);

            forces.set(i, {
                h: totalForceH,
                s: totalForceS,
                l: lightnessForce
            });
        }

        const timestep = getTimestep();
        const damping = getDamping();

        // Update velocities and positions
        for (let i = 0; i < colors.length; i++) {
            if (lockedIndices.has(i)) continue;

            const force = forces.get(i) || { h: 0, s: 0, l: 0 };
            const vel = velocities.get(i)!;

            // Update velocity with damping
            vel.h = (vel.h + force.h * timestep) * (1 - damping);
            vel.s = (vel.s + force.s * timestep) * (1 - damping);
            vel.l = (vel.l + force.l * timestep) * (1 - damping);

            // Update position
            const color = colors[i];
            let newH = (color.h + vel.h * timestep) % 360;
            if (newH < 0) newH += 360;
            
            const newS = Math.max(0, Math.min(100, color.s + vel.s * timestep));
            const newL = Math.max(0, Math.min(100, color.l + vel.l * timestep));

            newColors[i] = createColor(newH, newS, newL);
        }

        return newColors;
    }

    return {
        simulateStep,
        reset: initializeVelocities
    };
}

export const springSystem = createSpringSystem(); 