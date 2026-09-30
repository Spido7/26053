// Color constants as per brief specifications
const COLOR_UNPASSABLE = 0xef4444; // Red
const COLOR_PASSABLE = 0xf59e0b; // Amber / Yellow
const COLOR_DYNAMIC = 0xa855f7; // Purple
const COLOR_DRIVABLE = 0x10b981; // Green
const COLOR_EGO = 0x3b82f6; // Bright Blue


// Global synthetic obstacle positions for consistency across viewports
const worldObjects = [];
const NUM_STATIC = 28;
const NUM_PASSABLE = 15;
const NUM_DYNAMIC = 6;

for (let i = 0; i < NUM_STATIC; i++) {
    const rad = 8 + Math.random() * 65;
    const th = Math.random() * Math.PI * 2;
    worldObjects.push({
        type: 'unpassable',
        x: Math.cos(th) * rad,
        z: Math.sin(th) * rad,
        w: 1.5 + Math.random() * 3,
        h: 2 + Math.random() * 8,
        d: 1.5 + Math.random() * 3,
        color: COLOR_UNPASSABLE
    });
}

for (let i = 0; i < NUM_PASSABLE; i++) {
    const rad = 5 + Math.random() * 45;
    const th = Math.random() * Math.PI * 2;
    worldObjects.push({
        type: 'passable',
        x: Math.cos(th) * rad,
        z: Math.sin(th) * rad,
        w: 1.2 + Math.random() * 1.5,
        h: 0.15 + Math.random() * 0.35, // Pothole or low curb
        d: 1.2 + Math.random() * 1.5,
        color: COLOR_PASSABLE
    });
}

for (let i = 0; i < NUM_DYNAMIC; i++) {
    const rad = 6 + Math.random() * 35;
    const th = Math.random() * Math.PI * 2;
    worldObjects.push({
        type: 'dynamic',
        x: Math.cos(th) * rad,
        z: Math.sin(th) * rad,
        baseR: rad,
        angle: th,
        speed: (Math.random() > 0.5 ? 1 : -1) * (0.008 + Math.random() * 0.015),
        w: 1.4, h: 2.0, d: 2.4,
        color: COLOR_DYNAMIC
    });
}

// Shared helper for Three.js initialization with OrbitControls
function initViewport(containerId) {
    const container = document.getElementById(containerId);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030711);
    scene.fog = new THREE.FogExp2(0x030711, 0.012);

    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 800);
    camera.position.set(0, 32, 45);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 160;

    // Ambient + Directional lighting
    const amb = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xa5f3fc, 0.8);
    dir.position.set(20, 40, 20);
    scene.add(dir);

    // Ego Vehicle Proxy (Centered at origin)
    const egoGroup = new THREE.Group();
    const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.9, 4.2),
        new THREE.MeshLambertMaterial({ color: COLOR_EGO })
    );
    chassis.position.y = 0.55;
    egoGroup.add(chassis);

    const turret = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16),
        new THREE.MeshBasicMaterial({ color: 0x00f3ff })
    );
    turret.position.y = 1.25;
    egoGroup.add(turret);
    scene.add(egoGroup);

    const resize = () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);

    return { scene, camera, renderer, controls, container, resize };
}

// Viewport 1: Ground Truth 3D CAD/Meshes
function setupView1() {
    const ctx = initViewport('canvas-3dmap');
    const terrain = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 160, 40, 40),
        new THREE.MeshLambertMaterial({ color: 0x0a1a15, wireframe: false })
    );
    terrain.rotation.x = -Math.PI / 2;
    ctx.scene.add(terrain);

    const grid = new THREE.GridHelper(160, 32, 0x10b981, 0x064e3b);
    grid.position.y = 0.02;
    ctx.scene.add(grid);

    const meshes = [];
    worldObjects.forEach(obj => {
        const geo = new THREE.BoxGeometry(obj.w, obj.h, obj.d);
        const mat = new THREE.MeshLambertMaterial({ color: obj.color });
        const m = new THREE.Mesh(geo, mat);
        m.position.set(obj.x, obj.h / 2, obj.z);
        ctx.scene.add(m);
        meshes.push({ mesh: m, data: obj });
    });

    return function update(time) {
        // Dynamic objects are intentionally frozen (no angle update)
        ctx.controls.update();
        ctx.renderer.render(ctx.scene, ctx.camera);
    };
}

// Viewport 2: Raw Semantic Point Cloud
function setupView2() {
    const ctx = initViewport('canvas-ptcloud');
    const ptCount = 38000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(ptCount * 3);
    const col = new Float32Array(ptCount * 3);

    let idx = 0;
    for (let i = 0; i < 26000; i++) {
        const r = Math.random() * 75;
        const th = Math.random() * Math.PI * 2;
        pos[idx * 3] = Math.cos(th) * r;
        pos[idx * 3 + 1] = (Math.random() - 0.5) * 0.2;
        pos[idx * 3 + 2] = Math.sin(th) * r;

        col[idx * 3] = 0.06;
        col[idx * 3 + 1] = 0.72;
        col[idx * 3 + 2] = 0.50;
        idx++;
    }

    for (let i = 0; i < 12000; i++) {
        const refObj = worldObjects[Math.floor(Math.random() * worldObjects.length)];
        pos[idx * 3] = refObj.x + (Math.random() - 0.5) * refObj.w * 1.1;
        pos[idx * 3 + 1] = Math.random() * refObj.h;
        pos[idx * 3 + 2] = refObj.z + (Math.random() - 0.5) * refObj.d * 1.1;

        const c = new THREE.Color(refObj.color);
        col[idx * 3] = c.r;
        col[idx * 3 + 1] = c.g;
        col[idx * 3 + 2] = c.b;
        idx++;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.85 });
    const pSystem = new THREE.Points(geo, mat);
    ctx.scene.add(pSystem);

    return function update(time) {
        ctx.controls.update();
        ctx.renderer.render(ctx.scene, ctx.camera);
    };
}

// Viewport 3: Concentric Lidar Rings & Active Sweep
function setupView3() {
    const ctx = initViewport('canvas-lidar');

    for (let r = 10; r <= 70; r += 10) {
        const ringGeo = new THREE.RingGeometry(r - 0.08, r + 0.08, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x005577, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        ctx.scene.add(ring);
    }

    const sweepGroup = new THREE.Group();
    const beamGeo = new THREE.ConeGeometry(75, 75, 32, 1, true, 0, Math.PI / 5);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.12,
        wireframe: true,
        side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.rotation.x = -Math.PI / 2;
    beam.position.z = -37.5;
    sweepGroup.add(beam);
    ctx.scene.add(sweepGroup);

    worldObjects.forEach(obj => {
        const bGeo = new THREE.BoxGeometry(obj.w, obj.h, obj.d);
        const edges = new THREE.EdgesGeometry(bGeo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: obj.color }));
        line.position.set(obj.x, obj.h / 2, obj.z);
        ctx.scene.add(line);
    });

    return function update(time) {
        sweepGroup.rotation.y = time * 0.003;
        ctx.controls.update();
        ctx.renderer.render(ctx.scene, ctx.camera);
    };
}

// Viewport 4: Adaptive Polar / Cylindrical 2.5D Foveated Elevation Heightmap
function setupView4() {
    const ctx = initViewport('canvas-foveated');

    // Concentric Range & Foveal Boundary Rings on Ground
    const createRangeRing = (radius, color, width = 0.18) => {
        const ringGeo = new THREE.RingGeometry(radius - width / 2, radius + width / 2, 96);
        const ringMat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(ringGeo, ringMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.03;
        return mesh;
    };

    // Inner Foveal (10m) - Bright Green
    ctx.scene.add(createRangeRing(10, 0x10b981, 0.22));
    // Mid-Range (30m) - Amber
    ctx.scene.add(createRangeRing(30, 0xf59e0b, 0.25));
    // Outer Horizon (65m) - Cyan/Dim
    ctx.scene.add(createRangeRing(65, 0x00f3ff, 0.28));

    // Polar Radial Guide Rays (12 tactical sweep radials)
    const rayMat = new THREE.LineBasicMaterial({ color: 0x005577, transparent: true, opacity: 0.35 });
    for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const pts = [
            new THREE.Vector3(Math.cos(ang) * 3.5, 0.02, Math.sin(ang) * 3.5),
            new THREE.Vector3(Math.cos(ang) * 65, 0.02, Math.sin(ang) * 65)
        ];
        const rayGeo = new THREE.BufferGeometry().setFromPoints(pts);
        ctx.scene.add(new THREE.Line(rayGeo, rayMat));
    }

    // Floor base circular grid
    const floorMesh = new THREE.Mesh(
        new THREE.CircleGeometry(66, 64),
        new THREE.MeshLambertMaterial({ color: 0x020712, side: THREE.DoubleSide })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0.01;
    ctx.scene.add(floorMesh);

    // Drivable clear ring around ego vehicle (r <= 3.5m)
    const egoSafeDisk = new THREE.Mesh(
        new THREE.CircleGeometry(3.5, 32),
        new THREE.MeshBasicMaterial({ color: 0x062820, transparent: true, opacity: 0.6 })
    );
    egoSafeDisk.rotation.x = -Math.PI / 2;
    egoSafeDisk.position.y = 0.04;
    ctx.scene.add(egoSafeDisk);

    // ── Build Polar Cylindrical Cells ──
    // Zone 1: Inner Foveal (3.5m <= r <= 10m): Fine resolution, tight delta-theta
    // Zone 2: Mid Range (10m < r <= 30m): Medium resolution
    // Zone 3: Outer Peripheral (30m < r <= 65m): Coarse polar arcs
    const cells = [];

    // Zone 1: Inner Foveal (r: 3.5m -> 10m, dr = 0.54m, 72 sectors)
    const r1_min = 3.5, r1_max = 10.0;
    const r1_steps = 12;
    const dr1 = (r1_max - r1_min) / r1_steps;
    const nTheta1 = 72;
    const dTheta1 = (Math.PI * 2) / nTheta1;

    for (let i = 0; i < r1_steps; i++) {
        const r = r1_min + (i + 0.5) * dr1;
        const radialDepth = dr1 * 0.92;
        const tangentialWidth = r * dTheta1 * 0.92;
        for (let j = 0; j < nTheta1; j++) {
            const theta = j * dTheta1;
            cells.push({ r, theta, w: tangentialWidth, d: radialDepth, zone: 1 });
        }
    }

    // Zone 2: Mid Range (r: 10m -> 30m, dr = 1.54m, 48 sectors)
    const r2_min = 10.0, r2_max = 30.0;
    const r2_steps = 13;
    const dr2 = (r2_max - r2_min) / r2_steps;
    const nTheta2 = 48;
    const dTheta2 = (Math.PI * 2) / nTheta2;

    for (let i = 0; i < r2_steps; i++) {
        const r = r2_min + (i + 0.5) * dr2;
        const radialDepth = dr2 * 0.92;
        const tangentialWidth = r * dTheta2 * 0.92;
        for (let j = 0; j < nTheta2; j++) {
            const theta = j * dTheta2;
            cells.push({ r, theta, w: tangentialWidth, d: radialDepth, zone: 2 });
        }
    }

    // Zone 3: Outer Peripheral (r: 30m -> 65m, dr = 4.37m, 32 sectors)
    const r3_min = 30.0, r3_max = 65.0;
    const r3_steps = 8;
    const dr3 = (r3_max - r3_min) / r3_steps;
    const nTheta3 = 32;
    const dTheta3 = (Math.PI * 2) / nTheta3;

    for (let i = 0; i < r3_steps; i++) {
        const r = r3_min + (i + 0.5) * dr3;
        const radialDepth = dr3 * 0.94;
        const tangentialWidth = r * dTheta3 * 0.94;
        for (let j = 0; j < nTheta3; j++) {
            const theta = j * dTheta3;
            cells.push({ r, theta, w: tangentialWidth, d: radialDepth, zone: 3 });
        }
    }

    // Single InstancedMesh for 60 FPS performance
    const totalCount = cells.length;
    const baseUnitGeo = new THREE.BoxGeometry(1, 1, 1);
    const pillarMat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        reflectivity: 0.3
    });
    const instancedMesh = new THREE.InstancedMesh(baseUnitGeo, pillarMat, totalCount);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();

    // Semantic Height & Solid Color mapping for each polar cell
    cells.forEach((cell, idx) => {
        const cx = Math.cos(cell.theta) * cell.r;
        const cz = Math.sin(cell.theta) * cell.r;

        let height = 0.2;
        let colorHex = 0x10b981; // default bright green traversable terrain

        // Proximity matching to worldObjects
        let maxObsH = 0;
        let matchedObj = null;

        for (let o = 0; o < worldObjects.length; o++) {
            const obj = worldObjects[o];
            const dx = cx - obj.x;
            const dz = cz - obj.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const collisionThreshold = Math.max(obj.w, obj.d) * 0.75 + Math.max(cell.w, cell.d) * 0.5;
            if (dist < collisionThreshold) {
                if (obj.h > maxObsH) {
                    maxObsH = obj.h;
                    matchedObj = obj;
                }
            }
        }

        if (matchedObj) {
            if (matchedObj.type === 'unpassable') {
                // Static barrier / obstacle: Solid Red (matching representation & other viewports)
                height = Math.max(2.0, matchedObj.h);
                colorHex = COLOR_UNPASSABLE; // 0xef4444 (Red)
            } else if (matchedObj.type === 'passable') {
                // Passable curb / mound: Solid Orange / Amber
                height = Math.max(0.65, matchedObj.h * 2.8);
                colorHex = COLOR_PASSABLE; // 0xf59e0b (Amber)
            } else if (matchedObj.type === 'dynamic') {
                // Dynamic vehicle / target: Solid Purple
                height = 2.4;
                colorHex = COLOR_DYNAMIC; // 0xa855f7 (Purple)
            }
        } else {
            // Elevation height and color based on Zone
            if (cell.zone === 1) {
                // Inner Foveal: fine bright green drivable terrain
                const noise = Math.sin(cx * 0.6) * Math.cos(cz * 0.6);
                height = 0.18 + Math.abs(noise) * 0.28;
                colorHex = COLOR_DRIVABLE; // 0x10b981 (Bright Green)
            } else if (cell.zone === 2) {
                // Mid Range: traversable green with occasional amber elevation features
                const noise = Math.sin(cx * 0.25 + 1.0) * Math.cos(cz * 0.25 + 0.6);
                height = 0.28 + Math.abs(noise) * 0.5;
                colorHex = (noise > 0.45) ? COLOR_PASSABLE : 0x059669; // Amber or Green
            } else {
                // Outer Peripheral: coarse neutral grey peripheral occupancy cells
                const noise = Math.sin(cx * 0.12) * Math.cos(cz * 0.12);
                height = 0.4 + Math.abs(noise) * 0.8;
                colorHex = (noise > 0.4) ? 0x64748b : 0x475569; // Peripheral Neutral Grey
            }
        }

        // Set position, rotation along polar ray, and scale
        dummy.position.set(cx, height / 2, cz);
        dummy.rotation.y = -cell.theta; // Orient tangentially along concentric ring
        dummy.scale.set(cell.w, height, cell.d);
        dummy.updateMatrix();

        instancedMesh.setMatrixAt(idx, dummy.matrix);
        tempColor.setHex(colorHex);
        instancedMesh.setColorAt(idx, tempColor);
    });

    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

    ctx.scene.add(instancedMesh);

    return function update(time) {
        ctx.controls.update();
        ctx.renderer.render(ctx.scene, ctx.camera);
    };
}

// ── Fullscreen expand — instant position, GPU-animated scale ──
let activeMaximizedIndex = -1;

function updateMaxOverlayButtons(activeIndex) {
    const overlayBar = document.getElementById('max-overlay-bar');
    if (!overlayBar) return;
    const btns = overlayBar.querySelectorAll('.max-bar__btn');
    btns.forEach((btn, i) => {
        if (i === activeIndex) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function expandPanel(index) {
    if (activeMaximizedIndex === index) return;

    // If another panel is currently maximized, switch directly
    if (activeMaximizedIndex !== -1) {
        const oldPanel = document.getElementById(`panel-${activeMaximizedIndex}`);
        if (oldPanel) {
            oldPanel.classList.remove('maximized', 'collapsing');
            oldPanel.removeAttribute('style');
        }
    }

    const panel      = document.getElementById(`panel-${index}`);
    const backdrop   = document.getElementById('vp-backdrop');
    const overlayBar = document.getElementById('max-overlay-bar');

    // Instantly place panel at full screen via fixed positioning
    panel.style.cssText = `
        position: fixed;
        top: 8px; left: 8px;
        width: ${window.innerWidth  - 16}px;
        height: ${window.innerHeight - 16}px;
        margin: 0;
    `;

    // Trigger the CSS keyframe animation via class
    panel.classList.add('maximized');
    if (backdrop) backdrop.classList.add('active');
    if (overlayBar) overlayBar.classList.remove('hidden');

    activeMaximizedIndex = index;
    updateMaxOverlayButtons(index);

    // Three.js needs resize so canvas fills the new size
    window.dispatchEvent(new Event('resize'));
}

function _collapsePanel(index, resetState = true) {
    const panel      = document.getElementById(`panel-${index}`);
    const backdrop   = document.getElementById('vp-backdrop');
    const overlayBar = document.getElementById('max-overlay-bar');

    if (panel) {
        panel.classList.add('collapsing');
        panel.classList.remove('maximized');
    }
    if (backdrop) backdrop.classList.remove('active');
    if (overlayBar) overlayBar.classList.add('hidden');

    // After collapse animation, clear all inline styles
    setTimeout(() => {
        if (panel) {
            panel.classList.remove('collapsing');
            panel.removeAttribute('style');
        }
        window.dispatchEvent(new Event('resize'));
    }, 150);

    if (resetState) activeMaximizedIndex = -1;
}

function closeMaximized() {
    if (activeMaximizedIndex === -1) return;
    _collapsePanel(activeMaximizedIndex);
}

// Switch directly between maximized views
function switchMaximizedView(newIndex) {
    if (activeMaximizedIndex === newIndex) return;
    expandPanel(newIndex);
}

// Alias for toggle buttons
function toggleMaximize(panelIndex) {
    if (activeMaximizedIndex === panelIndex) { closeMaximized(); return; }
    expandPanel(panelIndex);
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMaximized();
    if (activeMaximizedIndex !== -1) {
        if (e.key === '1') switchMaximizedView(0);
        if (e.key === '2') switchMaximizedView(1);
        if (e.key === '3') switchMaximizedView(2);
        if (e.key === '4') switchMaximizedView(3);
    }
});

// Keep maximized panel filling window on resize
window.addEventListener('resize', () => {
    if (activeMaximizedIndex !== -1) {
        const panel = document.getElementById(`panel-${activeMaximizedIndex}`);
        if (panel && panel.classList.contains('maximized')) {
            panel.style.width  = (window.innerWidth  - 16) + 'px';
            panel.style.height = (window.innerHeight - 16) + 'px';
        }
    }
});



// Initialize on window load
window.onload = function () {
    const updates = [
        setupView1(),
        setupView2(),
        setupView3(),
        setupView4()
    ];

    function animate(time) {
        requestAnimationFrame(animate);
        updates.forEach(fn => fn(time));
    }
    animate(0);

    // Realistic Telemetry Fluctuations
    setInterval(() => {
        document.getElementById('metric-latency').innerText = (11.4 + Math.random() * 1.8).toFixed(1) + ' ms';
        document.getElementById('metric-fps').innerText = (59.6 + Math.random() * 1.2).toFixed(1) + ' FPS';
        document.getElementById('metric-mem-curr').innerText = (41.2 + Math.random() * 1.4).toFixed(1) + ' MB';
    }, 1000);
};