<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { EdgesGeometry, LineSegments } from 'three';
    import type { Color } from '$lib/types';
    import { writable } from 'svelte/store';
    import { springConnections } from '$lib/stores/springs';
    import type { SpringConnection } from '$lib/stores/springs';
    import { findClosestColorByLuminance, calculateLuminance, createColor } from '$lib/utils/color';
    import chroma from 'chroma-js';

    export let colors: any;  // Svelte store
    export let activeColor: any;  // Svelte store
    export let lockedColors: any;  // Add this line
    export let showEqualLuminancePlot: boolean = true;  // New prop with default value
    export let hslGradientColors: Color[] = [];  // Add gradient colors
    export let evenLumGradientColors: Color[] = [];
    export let oklabGradientColors: Color[] = [];
    export let oklabChromaGradientColors: Color[] = [];
    export let rgbGradientColors: Color[] = [];

    const colorSpaceMode = writable<'saturation' | 'chroma'>('saturation');
    let showEqualLuminance = false;
    let equalLuminancePoints: THREE.Mesh[] = [];
    let samplingMode: 'rgb' | 'hsl' = 'rgb';
    let container: HTMLElement;
    let wheelCanvas: HTMLCanvasElement;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let controls: OrbitControls;
    let colorPoints: { mesh: THREE.Mesh; color: Color }[] = [];  // Track both mesh and color
    let activePoint: THREE.Group | null = null;
    let raycaster: THREE.Raycaster;
    let mouse: THREE.Vector2;

    // Create a circular outline texture
    function createCircleOutlineTexture(): THREE.Texture {
        const size = 64;
        const center = size / 2;
        const radius = (size / 2) - 2; // Leave 2 pixels for the outline
        const lineWidth = 2;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // Clear background
        ctx.clearRect(0, 0, size, size);

        // Draw black circle outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.stroke();

        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // Calculate chroma from RGB values
    function calculateChroma(r: number, g: number, b: number): number {
        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        return max - min;
    }

    // Convert color to position based on mode
    function colorToPosition(color: Color, mode: 'saturation' | 'chroma'): THREE.Vector3 {
        const { h, s, l, rgb } = color;
        const angle = (h * Math.PI) / 180;
        const height = (l / 50) - 1;  // Map 0-100 to -1 to 1

        if (mode === 'saturation') {
            // Cylindrical HSL
            const radius = s / 100;
            const x = radius * Math.cos(angle);
            const z = radius * Math.sin(angle);
            return new THREE.Vector3(x, height, z);
        } else {
            // Biconic HSL with chroma
            const chroma = calculateChroma(rgb.r, rgb.g, rgb.b);
            const radius = chroma;
            const x = radius * Math.sin(angle);
            const z = radius * Math.cos(angle);
            return new THREE.Vector3(x, height, z);
        }
    }

    function init() {
        // Scene setup
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);

        // Camera setup
        camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(2, 2, 2);
        camera.lookAt(0, 0, 0);

        // Renderer setup
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        // Controls setup
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = true;
        controls.target.set(0, 0, 0);
        controls.update();

        // Initialize raycaster and mouse vector
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // Add mousedown event listener only
        container.addEventListener('mousedown', handleMouseDown);
        // Prevent context menu from appearing
        container.addEventListener('contextmenu', e => e.preventDefault());

        // Create HSL color space visualization
        createColorSpace($colorSpaceMode);

        // Handle window resize
        const handleResize = () => {
            if (!container) return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            container.removeEventListener('mousedown', handleMouseDown);
            container.removeEventListener('contextmenu', e => e.preventDefault());
            renderer.dispose();
        };
    }

    function handleMouseDown(event: MouseEvent) {
        event.preventDefault();
        
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const rect = container.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        raycaster.setFromCamera(mouse, camera);

        // Test intersections with color points
        const colorIntersects = raycaster.intersectObjects(colorPoints.map(cp => cp.mesh), true);
        
        // Test intersections with active point separately
        const activeIntersects = activePoint ? raycaster.intersectObject(activePoint, true) : [];
        
        // Combine intersections
        const allIntersects = [...colorIntersects, ...activeIntersects];

        if (allIntersects.length > 0) {
            // Find the color associated with the clicked mesh
            const clickedObject = allIntersects[0].object;
            const clickedPoint = colorPoints.find(cp => 
                cp.mesh === clickedObject || // Direct mesh match
                cp.mesh === clickedObject.parent || // Parent match (for active point group)
                (clickedObject.parent && cp.mesh === clickedObject.parent.parent) // Grandparent match (for sprite in active point)
            );

            if (clickedPoint) {
                const index = $colors.findIndex((c: Color) => 
                    c.h === clickedPoint.color.h && 
                    c.s === clickedPoint.color.s && 
                    c.l === clickedPoint.color.l
                );

                if (event.button === 2) { // Right click
                    lockedColors.update((set: Set<number>) => {
                        const newSet = new Set(set);
                        if (newSet.has(index)) {
                            newSet.delete(index);
                        } else {
                            newSet.add(index);
                        }
                        return newSet;
                    });
                } else { // Left click
                    activeColor.set(clickedPoint.color);
                }
            }
        }
    }

    // Create text sprite for axis labels
    function createTextSprite(text: string): THREE.Sprite {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = 512;  // Increased canvas size
        canvas.height = 256;

        context.font = 'Bold 80px Arial';  // Increased font size
        context.fillStyle = 'black';
        context.textAlign = 'center';
        context.fillText(text, 256, 128);  // Adjusted for new canvas size

        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;

        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            sizeAttenuation: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(0.15, 0.075, 1);  // Increased sprite scale

        // Store the texture reference so it can be disposed later
        sprite.userData.texture = texture;
        return sprite;
    }

    function createAxisLabels(mode: 'saturation' | 'chroma') {
        // Remove existing labels if any
        const existingLabels = scene.children.filter(child => child.name?.startsWith('label_'));
        existingLabels.forEach(label => scene.remove(label));

        // Create lightness label
        const lightnessLabel = createTextSprite('Lightness');
        lightnessLabel.name = 'label_lightness';
        lightnessLabel.position.set(0, 1.2, 0);
        scene.add(lightnessLabel);

        // Create radial axis label
        const radialLabel = createTextSprite(mode === 'saturation' ? 'Saturation' : 'Chroma');
        radialLabel.name = 'label_radial';
        radialLabel.position.set(1.2, 0, 0);
        scene.add(radialLabel);
    }

    function createColorSpace(mode: 'saturation' | 'chroma') {
        // Remove existing shape if any
        const existingShape = scene.children.find(child => child.name === 'colorSpace');
        if (existingShape) {
            scene.remove(existingShape);
        }

        const segments = 32;

        if (mode === 'saturation') {
            // Create cylindrical shape with lines
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const indices = [];

            // Create vertices for top and bottom circles
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const x = Math.cos(angle);
                const z = Math.sin(angle);
                
                // Top circle vertices (at y = 1)
                vertices.push(x, 1, z);
                
                // Bottom circle vertices (at y = -1)
                vertices.push(x, -1, z);
            }

            // Create indices for the wireframe
            for (let i = 0; i < segments; i++) {
                const baseTop = i * 2;
                const baseBottom = i * 2 + 1;
                const nextTop = ((i + 1) * 2) % ((segments + 1) * 2);
                const nextBottom = ((i + 1) * 2 + 1) % ((segments + 1) * 2);

                // Circle lines
                indices.push(baseTop, nextTop);        // Top circle
                indices.push(baseBottom, nextBottom);  // Bottom circle
                
                // Vertical lines
                indices.push(baseTop, baseBottom);     // Side connection
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setIndex(indices);

            const material = new THREE.LineBasicMaterial({
                color: 0x888888,
                transparent: true,
                opacity: 0.3
            });

            const mesh = new THREE.LineSegments(geometry, material);
            mesh.name = 'colorSpace';
            scene.add(mesh);
        } else {
            // Create true biconic shape
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const indices = [];

            // Create vertices for middle circle (at y = 0)
            const midCircleStartIndex = vertices.length / 3;
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const x = Math.cos(angle);
                const z = Math.sin(angle);
                vertices.push(x, 0, z);  // Middle circle at maximum radius
            }

            // Add top and bottom cone points
            const topPointIndex = vertices.length / 3;
            vertices.push(0, 1, 0);  // Top point (white)
            const bottomPointIndex = vertices.length / 3;
            vertices.push(0, -1, 0); // Bottom point (black)

            // Create indices for the wireframe
            // Middle circle
            for (let i = 0; i < segments; i++) {
                const current = midCircleStartIndex + i;
                const next = midCircleStartIndex + ((i + 1) % (segments + 1));
                indices.push(current, next);

                // Lines to top point (white cone)
                indices.push(current, topPointIndex);

                // Lines to bottom point (black cone)
                indices.push(current, bottomPointIndex);
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setIndex(indices);

            const material = new THREE.LineBasicMaterial({
                color: 0x888888,
                transparent: true,
                opacity: 0.3
            });

            const mesh = new THREE.LineSegments(geometry, material);
            mesh.name = 'colorSpace';
            scene.add(mesh);
        }

        // Add axes helpers
        const axesHelper = new THREE.AxesHelper(2);
        scene.add(axesHelper);

        // Add axis labels
        createAxisLabels(mode);
    }

    function createActivePoint(color: Color, position: THREE.Vector3): THREE.Group {
        const group = new THREE.Group();

        // Create the colored sphere
        const sphereGeometry = new THREE.SphereGeometry(0.04, 16, 16);  // Increased sphere size
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(
                color.rgb.r / 255,
                color.rgb.g / 255,
                color.rgb.b / 255
            )
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        group.add(sphere);

        // Create the outline sprite
        const outlineTexture = createCircleOutlineTexture();
        const spriteMaterial = new THREE.SpriteMaterial({
            map: outlineTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(0.15, 0.15, 1);  // Increased outline size
        group.add(sprite);

        group.position.copy(position);
        return group;
    }

    function createLockIndicator(position: THREE.Vector3): THREE.Sprite {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = 64;
        canvas.height = 64;

        context.fillStyle = 'black';
        context.font = 'bold 48px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('✕', 32, 32);

        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.7,
            depthTest: false
        });

        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.1, 0.1, 1);
        sprite.position.copy(position);

        // Store the texture reference so it can be disposed later
        sprite.userData.texture = texture;
        return sprite;
    }

    function createGradientPoint(color: Color, position: THREE.Vector3, shape: 'sphere' | 'box' | 'cone' | 'diamond' | 'pentagon'): THREE.Mesh {
        let geometry;
        
        switch (shape) {
            case 'sphere':
                geometry = new THREE.SphereGeometry(0.02, 16, 16);
                break;
            case 'box':
                geometry = new THREE.BoxGeometry(0.03, 0.03, 0.03);
                break;
            case 'cone':
                geometry = new THREE.ConeGeometry(0.02, 0.04, 8);
                break;
            case 'diamond':
                geometry = new THREE.OctahedronGeometry(0.025);
                break;
            case 'pentagon':
                geometry = new THREE.CylinderGeometry(0.025, 0.025, 0.015, 6);  // Changed from 5 to 6 sides
                break;
        }

        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(
                color.rgb.r / 255,
                color.rgb.g / 255,
                color.rgb.b / 255
            )
        });

        const point = new THREE.Mesh(geometry, material);
        point.position.copy(position);
        
        if (shape === 'cone') {
            point.rotation.x = Math.PI;  // Point the cone downward
        } else if (shape === 'pentagon') {
            point.rotation.x = Math.PI / 2;  // Lay the pentagon flat
        }
        
        return point;
    }

    function createHSLSamplingPoints() {
        // Remove existing points
        equalLuminancePoints.forEach(point => scene.remove(point));
        equalLuminancePoints = [];

        if (!$activeColor) return;

        // Create points for every 2 degrees of hue, 2% saturation, and 2% lightness
        for (let h = 0; h < 360; h += 2) {
            for (let s = 0; s <= 100; s += 1) {
                for (let l = 1; l < 100; l += 1) {
                    const color = createColor(h, s, l);
                    // Only show points with luminance close to active color
                    if (Math.abs(color.luminance - $activeColor.luminance) < 0.001) {
                        const pos = colorToPosition(color, $colorSpaceMode);
                        const size = (h === $activeColor.h && s === $activeColor.s && l === $activeColor.l) ? 0.02 : 0.01;
                        const geom = new THREE.SphereGeometry(size, 8, 8);
                        const mat = new THREE.MeshBasicMaterial({
                            color: new THREE.Color(color.rgb.r/255, color.rgb.g/255, color.rgb.b/255)
                        });
                        const point = new THREE.Mesh(geom, mat);
                        point.position.copy(pos);
                        point.name = 'equalLuminancePoint';
                        
                        scene.add(point);
                        equalLuminancePoints.push(point);
                    }
                }
            }
        }
    }

    function createRGBSamplingPoints() {
        // Remove existing points
        equalLuminancePoints.forEach(point => scene.remove(point));
        equalLuminancePoints = [];

        if (!$activeColor) return;
        const targetLuminance = $activeColor.luminance;
        
        // Create points for every 2 RGB values
        for (let r = 0; r <= 255; r += 2) {
            for (let g = 0; g <= 255; g += 2) {
                for (let b = 0; b <= 255; b += 2) {
                    const luminance = calculateLuminance(r, g, b);
                    if (Math.abs(luminance - targetLuminance) < 0.001 || 
                        (r === $activeColor.rgb.r && g === $activeColor.rgb.g && b === $activeColor.rgb.b)) {
                        const chromaColor = chroma.rgb(r, g, b);
                        const [h, s, l] = chromaColor.hsl();
                        if (!isNaN(h) && !isNaN(s) && !isNaN(l)) {
                            const equalLumColor = createColor(
                                h || 0,
                                s * 100,
                                l * 100
                            );
                            const pos = colorToPosition(equalLumColor, $colorSpaceMode);
                            
                            const size = (r === $activeColor.rgb.r && g === $activeColor.rgb.g && b === $activeColor.rgb.b) ? 0.02 : 0.01;
                            const geom = new THREE.SphereGeometry(size, 8, 8);
                            const mat = new THREE.MeshBasicMaterial({
                                color: new THREE.Color(r/255, g/255, b/255)
                            });
                            const equalLumPoint = new THREE.Mesh(geom, mat);
                            equalLumPoint.position.copy(pos);
                            equalLumPoint.name = 'equalLuminancePoint';
                            
                            scene.add(equalLumPoint);
                            equalLuminancePoints.push(equalLumPoint);
                        }
                    }
                }
            }
        }
    }

    function updateEqualLuminancePoints() {
        // Return early if plot is off or no active color
        if (!showEqualLuminance || !$activeColor) {
            equalLuminancePoints.forEach(point => scene.remove(point));
            equalLuminancePoints = [];
            return;
        }

        // Remove existing points
        equalLuminancePoints.forEach(point => scene.remove(point));
        equalLuminancePoints = [];

        if (samplingMode === 'rgb') {
            createRGBSamplingPoints();
        } else {
            createHSLSamplingPoints();
        }
    }

    function updateColorPoints() {
        // Dispose of existing materials and textures
        colorPoints.forEach(cp => {
            if (cp.mesh.material instanceof THREE.Material) {
                cp.mesh.material.dispose();
            }
        });

        // Remove existing points and lines
        colorPoints.forEach(cp => scene.remove(cp.mesh));
        colorPoints = [];
        
        if (activePoint) {
            // Dispose of materials and textures in the active point group
            activePoint.children.forEach(child => {
                if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
                    child.material.dispose();
                }
                if (child instanceof THREE.Sprite) {
                    const material = child.material as THREE.SpriteMaterial;
                    if (material.map) {
                        material.map.dispose();
                    }
                    material.dispose();
                }
            });
            scene.remove(activePoint);
            activePoint = null;
        }

        // Remove and dispose of existing lines, lock indicators, and gradient points
        scene.children
            .filter(child => 
                child.name === 'connectionLine' || 
                child.name === 'lockIndicator' ||
                child.name === 'gradientPoint'
            )
            .forEach(obj => {
                if (obj instanceof THREE.Mesh && obj.material instanceof THREE.Material) {
                    obj.material.dispose();
                }
                if (obj instanceof THREE.Sprite) {
                    const material = obj.material as THREE.SpriteMaterial;
                    if (material.map) {
                        material.map.dispose();
                    }
                    material.dispose();
                }
                if (obj instanceof THREE.Line && obj.material instanceof THREE.Material) {
                    obj.material.dispose();
                }
                scene.remove(obj);
            });

        // Create regular color points
        for (let i = 0; i < $colors.length; i++) {
            const color = $colors[i];
            const position = colorToPosition(color, $colorSpaceMode);
            
            const geometry = new THREE.SphereGeometry(0.03, 16, 16);
            const material = new THREE.MeshBasicMaterial({ 
                color: new THREE.Color(
                    color.rgb.r / 255,
                    color.rgb.g / 255,
                    color.rgb.b / 255
                )
            });
            const point = new THREE.Mesh(geometry, material);
            point.position.copy(position);
            
            scene.add(point);
            colorPoints.push({ mesh: point, color });

            // Add lock indicator if color is locked
            if ($lockedColors.has(i)) {
                const lockIndicator = createLockIndicator(position);
                lockIndicator.name = 'lockIndicator';
                scene.add(lockIndicator);
            }

            // If this is the active color, create the special active point
            if ($activeColor === color) {
                activePoint = createActivePoint(color, position);
                scene.add(activePoint);
            }
        }

        // Add gradient points with different shapes
        rgbGradientColors.forEach(color => {
            const position = colorToPosition(color, $colorSpaceMode);
            const point = createGradientPoint(color, position, 'pentagon');
            point.name = 'gradientPoint';
            scene.add(point);
        });

        hslGradientColors.forEach(color => {
            const position = colorToPosition(color, $colorSpaceMode);
            const point = createGradientPoint(color, position, 'sphere');
            point.name = 'gradientPoint';
            scene.add(point);
        });

        evenLumGradientColors.forEach(color => {
            const position = colorToPosition(color, $colorSpaceMode);
            const point = createGradientPoint(color, position, 'box');
            point.name = 'gradientPoint';
            scene.add(point);
        });

        oklabGradientColors.forEach(color => {
            const position = colorToPosition(color, $colorSpaceMode);
            const point = createGradientPoint(color, position, 'cone');
            point.name = 'gradientPoint';
            scene.add(point);
        });

        oklabChromaGradientColors.forEach(color => {
            const position = colorToPosition(color, $colorSpaceMode);
            const point = createGradientPoint(color, position, 'diamond');
            point.name = 'gradientPoint';
            scene.add(point);
        });

        // Get spring connections and create lines
        let connections: SpringConnection[] = [];
        springConnections.subscribe(value => connections = value)();

        // Create lines only between connected points
        for (const connection of connections) {
            const point1 = colorPoints[connection.index1];
            const point2 = colorPoints[connection.index2];
            
            if (point1 && point2) {
                const lineGeometry = new THREE.BufferGeometry();
                const lineVertices = [
                    point1.mesh.position.x, point1.mesh.position.y, point1.mesh.position.z,
                    point2.mesh.position.x, point2.mesh.position.y, point2.mesh.position.z
                ];
                
                lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lineVertices, 3));
                const lineMaterial = new THREE.LineBasicMaterial({ 
                    color: 0x000000,
                    transparent: true,
                    opacity: 0.3
                });
                const line = new THREE.Line(lineGeometry, lineMaterial);
                line.name = 'connectionLine';
                scene.add(line);
            }
        }
    }

    // Update visualization when mode changes
    $: if (scene && $colorSpaceMode) {
        createColorSpace($colorSpaceMode);
        updateColorPoints();
        if (showEqualLuminance && $activeColor) {
            updateEqualLuminancePoints();
        }
    }

    // Update points when colors change
    $: if (scene && $colors) {
        updateColorPoints();
    }

    // Update active point when active color changes
    $: if (scene && $activeColor) {
        updateColorPoints();
    }

    // Update points when locked colors change
    $: if (scene && $lockedColors) {
        updateColorPoints();
    }

    // Update when gradient colors change
    $: if (scene && (rgbGradientColors.length > 0 || hslGradientColors.length > 0 || 
                    evenLumGradientColors.length > 0 || oklabGradientColors.length > 0 || 
                    oklabChromaGradientColors.length > 0)) {
        updateColorPoints();
    }

    // Update points when sampling mode changes
    $: if (scene && samplingMode && showEqualLuminance && $activeColor) {
        updateEqualLuminancePoints();
    }

    // Update wheel when equal luminance points change or show state changes
    $: if (wheelCanvas && showEqualLuminance && $activeColor) {
        drawColorWheel();
    }

    onMount(() => {
        const cleanup = init();
        return cleanup;
    });

    function handleModeChange(mode: 'saturation' | 'chroma') {
        colorSpaceMode.set(mode);
    }

    function handleSamplingModeChange(mode: 'rgb' | 'hsl') {
        samplingMode = mode;
    }

    function toggleEqualLuminance() {
        showEqualLuminance = !showEqualLuminance;
        if (showEqualLuminance && $activeColor) {
            updateEqualLuminancePoints();
            drawColorWheel();
        } else {
            equalLuminancePoints.forEach(point => scene.remove(point));
            equalLuminancePoints = [];
        }
    }

    // Add resize handler to update label positions
    function handleResize() {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }

    function drawColorWheel() {
        if (!wheelCanvas || !showEqualLuminance || !$activeColor) return;
        
        const ctx = wheelCanvas.getContext('2d')!;
        const size = wheelCanvas.width;
        const center = size / 2;
        const radius = (size / 2) - 4;  // Leave some padding
        
        // Clear canvas
        ctx.clearRect(0, 0, size, size);
        
        // Draw background circle
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f0f0f0';
        ctx.fill();
        
        // Draw equal luminance points
        equalLuminancePoints.forEach(point => {
            const color = point.material as THREE.MeshBasicMaterial;
            const position = point.position;
            
            // Convert 3D position to 2D angle and radius
            const angle = Math.atan2(position.z, position.x);
            const distance = Math.sqrt(position.x * position.x + position.z * position.z);
            
            // Calculate point position on canvas
            const x = center + (radius * distance) * Math.cos(angle);
            const y = center + (radius * distance) * Math.sin(angle);
            
            // Draw point
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${color.color.r * 255}, ${color.color.g * 255}, ${color.color.b * 255})`;
            ctx.fill();
        });
        
        // If active color exists, draw it larger
        if ($activeColor) {
            const activePoint = equalLuminancePoints.find(point => {
                const material = point.material as THREE.MeshBasicMaterial;
                return material.color.r === $activeColor.rgb.r / 255 &&
                       material.color.g === $activeColor.rgb.g / 255 &&
                       material.color.b === $activeColor.rgb.b / 255;
            });
            
            if (activePoint) {
                const position = activePoint.position;
                const angle = Math.atan2(position.z, position.x);
                const distance = Math.sqrt(position.x * position.x + position.z * position.z);
                
                const x = center + (radius * distance) * Math.cos(angle);
                const y = center + (radius * distance) * Math.sin(angle);
                
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fillStyle = `rgb(${$activeColor.rgb.r}, ${$activeColor.rgb.g}, ${$activeColor.rgb.b})`;
                ctx.fill();
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }
</script>

<div class="container">
    <div class="viewport" bind:this={container}></div>
    <div class="control-panel control-panel-narrow control-panel-left">
        <h3>Color Space</h3>
        <div class="mode-selector mode-selector-vertical">
            <label>
                <input 
                    type="radio" 
                    name="colorspace" 
                    value="saturation"
                    checked={$colorSpaceMode === 'saturation'}
                    on:change={() => handleModeChange('saturation')}
                >
                HSL (Saturation)
            </label>
            <label>
                <input 
                    type="radio" 
                    name="colorspace" 
                    value="chroma"
                    checked={$colorSpaceMode === 'chroma'}
                    on:change={() => handleModeChange('chroma')}
                >
                HSL (Chroma)
            </label>
        </div>
    </div>

    {#if showEqualLuminancePlot}
        <div class="control-panel control-panel-narrow control-panel-right">
            <h3>Equal Luminance Plot</h3>
            <div class="sampling-controls">
                <div class="sampling-section">
                    <span class="sampling-label">Sampling method:</span>
                    <div class="mode-selector mode-selector-vertical">
                        <label>
                            <input 
                                type="radio" 
                                name="sampling" 
                                value="rgb"
                                checked={samplingMode === 'rgb'}
                                on:change={() => handleSamplingModeChange('rgb')}
                            >
                            RGB
                        </label>
                        <label>
                            <input 
                                type="radio" 
                                name="sampling" 
                                value="hsl"
                                checked={samplingMode === 'hsl'}
                                on:change={() => handleSamplingModeChange('hsl')}
                            >
                            HSL
                        </label>
                    </div>
                </div>
                <button 
                    class="luminance-toggle"
                    class:active={showEqualLuminance}
                    disabled={!$activeColor}
                    on:click={toggleEqualLuminance}
                >
                    Plot Equal Luminance
                </button>
                {#if showEqualLuminance}
                    <div class="wheel-container">
                        <canvas 
                            bind:this={wheelCanvas}
                            width="150"
                            height="150"
                            class="color-wheel"
                        ></canvas>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        position: relative;
        background: #f0f0f0;
        border-radius: 8px;
        overflow: hidden;
    }

    .controls {
        position: absolute;
        top: 0.5rem;
        left: 0;
        right: 0;
        display: flex;
        justify-content: space-between;
        padding: 0 0.5rem;
        pointer-events: none;
        z-index: 1;
    }

    .control-panel {
        background: white;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        pointer-events: auto;
    }

    .control-panel-narrow {
        width: auto;
        min-width: 150px;
    }

    .control-panel-left {
        position: absolute;
        top: 0.5rem;
        left: 0.5rem;
    }

    .control-panel-right {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
    }

    h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1rem;
        color: #333;
    }

    .mode-selector {
        display: flex;
        gap: 1rem;
    }

    .mode-selector-vertical {
        flex-direction: column;
        gap: 0.5rem;
    }

    .sampling-controls {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .sampling-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .sampling-label {
        white-space: nowrap;
        color: #333;
        font-weight: 500;
    }

    .viewport {
        width: 100%;
        height: 100%;
        position: relative;
        z-index: 0;
    }

    .viewport :global(canvas) {
        width: 100% !important;
        height: 100% !important;
        outline: none;
    }

    label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        white-space: nowrap;
    }

    input[type="radio"] {
        cursor: pointer;
    }

    .luminance-toggle {
        padding: 0.5rem 1rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
        width: 100%;
    }

    .luminance-toggle:disabled {
        background: #e0e0e0;
        color: #999;
        cursor: not-allowed;
        border-color: #ddd;
    }

    .luminance-toggle.active {
        background: #4a4a4a;
        color: white;
        border-color: #4a4a4a;
    }

    .luminance-toggle:not(:disabled):hover {
        background: #f0f0f0;
    }

    .luminance-toggle.active:not(:disabled):hover {
        background: #5a5a5a;
    }

    .wheel-container {
        display: flex;
        justify-content: center;
        margin-top: 0.5rem;
    }

    .color-wheel {
        border-radius: 50%;
        border: 1px solid #ccc;
        background: white;
    }
</style> 