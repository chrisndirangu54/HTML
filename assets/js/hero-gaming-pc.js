(() => {
  'use strict';

  const HOME = '#home';
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
  const CSS_URL = 'assets/css/hero-gaming-pc.css';

  function addCss() {
    if ([...document.styleSheets].some(s => s.href && s.href.includes('hero-gaming-pc.css'))) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(s => s.src === new URL(THREE_URL, location.href).href);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.THREE), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = THREE_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve(window.THREE);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function mountShell(home) {
    if (document.getElementById('tt-gaming-pc')) return document.getElementById('tt-gaming-pc');
    const root = document.createElement('div');
    root.id = 'tt-gaming-pc';
    root.className = 'tt-gaming-pc';
    root.setAttribute('aria-label', 'Interactive 3D gaming PC');
    root.innerHTML = `
      <div class="tt-gaming-pc__stage">
        <div class="tt-gaming-pc__fallback" aria-hidden="true"></div>
        <div class="tt-gaming-pc__glow" aria-hidden="true"></div>
        <canvas class="tt-gaming-pc__canvas" id="tt-gaming-pc-canvas" aria-hidden="true"></canvas>
        <div class="tt-gaming-pc__badge">Scroll to rotate</div>
        <div class="tt-gaming-pc__error">3D fallback active</div>
      </div>`;
    home.appendChild(root);
    return root;
  }

  function box(THREE, w, h, d, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    return mesh;
  }

  function createFan(THREE, radius, ringMaterial, bladeMaterial) {
    const fan = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.085, 12, 64), ringMaterial);
    fan.add(ring);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, 0.09, 24), bladeMaterial);
    hub.rotation.x = Math.PI / 2;
    fan.add(hub);
    const blades = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.48, radius * 0.14, 0.035), bladeMaterial);
      blade.position.x = radius * 0.32;
      blade.rotation.z = (Math.PI * 2 * i) / 7 + 0.36;
      blade.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), (Math.PI * 2 * i) / 7);
      blades.add(blade);
    }
    fan.add(blades);
    fan.userData.blades = blades;
    return fan;
  }

  function buildPc(THREE, scene) {
    const pc = new THREE.Group();
    scene.add(pc);

    const black = new THREE.MeshStandardMaterial({ color: 0x080c12, metalness: 0.88, roughness: 0.23 });
    const graphite = new THREE.MeshStandardMaterial({ color: 0x202a35, metalness: 0.82, roughness: 0.28 });
    const silver = new THREE.MeshStandardMaterial({ color: 0x8997a4, metalness: 0.93, roughness: 0.2 });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x9bf8ff, emissive: 0x00cdec, emissiveIntensity: 1.65, metalness: 0.5, roughness: 0.18 });
    const violet = new THREE.MeshStandardMaterial({ color: 0xd2b5ff, emissive: 0x7b21ff, emissiveIntensity: 1.25, metalness: 0.45, roughness: 0.2 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x8edbea, transparent: true, opacity: 0.14, roughness: 0.08, metalness: 0.08, transmission: 0.35, side: THREE.DoubleSide, depthWrite: false });
    const bladesMat = new THREE.MeshStandardMaterial({ color: 0x151d27, metalness: 0.72, roughness: 0.3 });

    // Main chassis and frame.
    pc.add(box(THREE, 2.62, 3.75, 2.08, black));
    pc.add(box(THREE, 2.34, 3.45, 1.82, graphite, 0, 0, 0.03));
    pc.add(box(THREE, 0.07, 3.56, 1.88, silver, 1.31, 0, 0));
    pc.add(box(THREE, 0.035, 3.46, 1.78, glass, 1.355, 0, 0.01));
    pc.add(box(THREE, 2.44, 0.11, 1.9, silver, 0, 1.82, 0));
    pc.add(box(THREE, 2.44, 0.11, 1.9, silver, 0, -1.82, 0));

    // Motherboard and internals visible through the glass side.
    pc.add(box(THREE, 0.08, 2.55, 1.45, new THREE.MeshStandardMaterial({ color: 0x142b24, metalness: 0.32, roughness: 0.5 }), 0.98, 0.18, -0.06));
    pc.add(box(THREE, 1.88, 0.46, 0.62, black, 0.15, -0.18, 0.32)); // GPU
    pc.add(box(THREE, 1.55, 0.08, 0.07, cyan, 0.2, 0.04, 0.66));
    pc.add(box(THREE, 0.36, 0.92, 0.31, silver, 0.72, 0.66, 0.25)); // CPU cooler
    pc.add(box(THREE, 0.12, 0.85, 0.18, violet, 0.38, 0.73, 0.12));
    pc.add(box(THREE, 0.12, 0.85, 0.18, cyan, 0.18, 0.73, 0.12));
    pc.add(box(THREE, 1.9, 0.62, 1.42, black, 0, -1.36, 0.06)); // PSU shroud

    // Front RGB fans.
    const fans = [];
    [-1.05, 0, 1.05].forEach((y, i) => {
      const fan = createFan(THREE, 0.48, i === 1 ? violet : cyan, bladesMat);
      fan.position.set(0, y, 1.08);
      pc.add(fan);
      fans.push(fan);
    });

    // Rear exhaust fan, visible on rotation.
    const rear = createFan(THREE, 0.43, violet, bladesMat);
    rear.position.set(-0.55, 0.86, -1.06);
    rear.rotation.y = Math.PI;
    pc.add(rear);
    fans.push(rear);

    // Top radiator bars and feet.
    for (let i = -4; i <= 4; i++) pc.add(box(THREE, 0.13, 0.05, 1.35, graphite, i * 0.23, 1.9, -0.05));
    pc.add(box(THREE, 0.5, 0.12, 0.52, black, -0.83, -1.98, 0));
    pc.add(box(THREE, 0.5, 0.12, 0.52, black, 0.83, -1.98, 0));

    // Small illuminated logo plate.
    pc.add(box(THREE, 0.8, 0.035, 0.08, cyan, 0, 1.56, 1.08));

    pc.userData.fans = fans;
    pc.userData.cyanMat = cyan;
    pc.userData.violetMat = violet;
    pc.rotation.y = -0.48;
    pc.rotation.x = -0.04;
    return pc;
  }

  function init3d(root, stage, canvas) {
    const THREE = window.THREE;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = matchMedia('(max-width: 640px)').matches;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
    camera.position.set(5.05, 2.65, 6.6);
    camera.lookAt(0, 0.05, 0);

    scene.add(new THREE.HemisphereLight(0xe9fbff, 0x07101b, 1.8));
    const key = new THREE.PointLight(0x66efff, 22, 25, 2);
    key.position.set(4.2, 3.2, 5.2);
    scene.add(key);
    const purple = new THREE.PointLight(0xa149ff, 16, 22, 2);
    purple.position.set(-3.8, -0.6, 4.2);
    scene.add(purple);
    const rim = new THREE.PointLight(0xffffff, 8, 18, 2);
    rim.position.set(0, 4.4, -3.5);
    scene.add(rim);

    const pc = buildPc(THREE, scene);
    const clock = new THREE.Clock();
    let mx = 0, my = 0, sx = 0, sy = 0, visible = true;

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    };
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
    else window.addEventListener('resize', resize, { passive: true });
    resize();

    const pointer = e => {
      mx = (e.clientX / innerWidth) * 2 - 1;
      my = (e.clientY / innerHeight) * 2 - 1;
      root.style.setProperty('--pc-pointer-x', `${(mx * 7).toFixed(1)}px`);
      root.style.setProperty('--pc-pointer-y', `${(my * 5).toFixed(1)}px`);
    };
    window.addEventListener('pointermove', pointer, { passive: true });

    const hero = document.querySelector(HOME);
    const scrollState = { progress: 0 };
    const onScroll = () => {
      if (!hero) return;
      const r = hero.getBoundingClientRect();
      const vh = innerHeight || 1;
      scrollState.progress = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

    root.classList.add('is-webgl');

    function frame() {
      requestAnimationFrame(frame);
      if (!visible) return;
      const t = clock.getElapsedTime();
      sx += (mx - sx) * 0.04;
      sy += (my - sy) * 0.04;
      const p = reduced ? 0.38 : scrollState.progress;
      pc.rotation.y = -0.62 + p * Math.PI * 1.45 + sx * 0.08;
      pc.rotation.x = -0.04 - sy * 0.035 + (reduced ? 0 : Math.sin(t * 0.65) * 0.015);
      pc.position.y = reduced ? -0.05 : -0.05 + Math.sin(t * 1.05) * 0.055;
      pc.userData.fans.forEach((fan, i) => {
        if (!reduced) fan.userData.blades.rotation.z -= 0.035 + i * 0.004;
      });
      const pulse = 1 + Math.sin(t * 2.2) * 0.32;
      pc.userData.cyanMat.emissiveIntensity = 1.35 * pulse;
      pc.userData.violetMat.emissiveIntensity = 1.05 * (1.9 - pulse * 0.45);
      key.intensity = 19 + pulse * 4;
      renderer.render(scene, camera);
    }
    frame();
  }

  async function start() {
    const home = document.querySelector(HOME);
    if (!home) return;
    addCss();
    const root = mountShell(home);
    const stage = root.querySelector('.tt-gaming-pc__stage');
    const canvas = root.querySelector('#tt-gaming-pc-canvas');
    try {
      await loadThree();
      if (!window.THREE) throw new Error('Three.js unavailable');
      init3d(root, stage, canvas);
    } catch (err) {
      console.warn('Gaming PC 3D fallback:', err);
      root.classList.add('has-error');
    }
  }

  function lazyStart() {
    const home = document.querySelector(HOME);
    if (!home) return;
    if (!('IntersectionObserver' in window)) return start();
    const io = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        io.disconnect();
        start();
      }
    }, { rootMargin: '350px' });
    io.observe(home);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lazyStart, { once: true });
  else lazyStart();
})();
