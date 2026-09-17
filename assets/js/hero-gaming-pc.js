(() => {
  'use strict';

  const HOME = '#home';
  const CSS_URL = 'assets/css/hero-gaming-pc.css';
  const MODEL_URL = 'assets/models/gaming-setup.glb';
  const THREE_URL = 'https://esm.sh/three@0.160.0';
  const GLTF_LOADER_URL = 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
  const ROOM_ENV_URL = 'https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

  function addCss() {
    if ([...document.styleSheets].some(s => s.href && s.href.includes('hero-gaming-pc.css'))) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  function mountShell(home) {
    const existing = document.getElementById('tt-gaming-pc');
    if (existing) return existing;

    const root = document.createElement('div');
    root.id = 'tt-gaming-pc';
    root.className = 'tt-gaming-pc';
    root.setAttribute('aria-label', 'Interactive 3D gaming setup');
    root.innerHTML = `
      <div class="tt-gaming-pc__sticky">
        <div class="tt-gaming-pc__stage">
          <div class="tt-gaming-pc__glow" aria-hidden="true"></div>
          <canvas id="tt-gaming-pc-canvas" class="tt-gaming-pc__canvas" aria-label="TeknTandao gaming setup 3D model"></canvas>
          <div class="tt-gaming-pc__loading">Loading 3D setup… <span data-pc-progress>0%</span></div>
          <div class="tt-gaming-pc__badge">Scroll to rotate <span data-pc-spin>0%</span></div>
          <div class="tt-gaming-pc__error">3D model could not load</div>
        </div>
      </div>`;

    const container = home.querySelector('.custom-container');
    if (container) container.insertAdjacentElement('afterend', root);
    else home.appendChild(root);
    return root;
  }

  function createScene(root, canvas, THREE) {
    const stage = root.querySelector('.tt-gaming-pc__stage');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.15 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    if ('useLegacyLights' in renderer) renderer.useLegacyLights = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 80);
    camera.position.set(0, 0.45, 6.4);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    scene.add(new THREE.HemisphereLight(0xd7f4ff, 0x1a120c, 1.35));
    const key = new THREE.DirectionalLight(0xfff6ea, 2.1);
    key.position.set(3.2, 5.4, 4.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xb9dcff, 0.8);
    fill.position.set(-4.5, 2.2, 2.4);
    scene.add(fill);
    const cyan = new THREE.PointLight(0x19dfff, 10, 18, 2);
    cyan.position.set(1.2, 0.8, 2.4);
    scene.add(cyan);
    const purple = new THREE.PointLight(0x8d38ff, 8, 16, 2);
    purple.position.set(-1.6, 0.4, 1.8);
    scene.add(purple);

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

    return { renderer, scene, camera, cyan, purple, stage };
  }

  async function addEnvironment(renderer, scene, THREE) {
    try {
      const { RoomEnvironment } = await import(ROOM_ENV_URL);
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
      pmrem.dispose();
    } catch (error) {
      console.warn('Gaming setup environment map skipped:', error);
    }
  }

  function prepareMaterials(model, THREE) {
    model.traverse(child => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!material) continue;
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.anisotropy = 4;
        }
        if (material.emissiveMap) {
          material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          if (material.emissiveIntensity < 0.35) material.emissiveIntensity = 1.15;
        }
        material.needsUpdate = true;
      }
    });
  }

  function mountCentered(model, scene, THREE) {
    const pivot = new THREE.Group();
    scene.add(pivot);
    pivot.add(model);
    model.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    const maxAxis = Math.max(size.x, size.y, size.z, 1);
    pivot.scale.setScalar(3.2 / maxAxis);

    model.updateWorldMatrix(true, true);
    const recentered = box.setFromObject(model).getCenter(new THREE.Vector3());
    model.position.sub(pivot.worldToLocal(recentered));
    return pivot;
  }

  function pinProgress(root) {
    const rect = root.getBoundingClientRect();
    const total = Math.max(root.offsetHeight - innerHeight, 1);
    return Math.max(0, Math.min(1, -rect.top / total));
  }

  function wireMotion(root, pivot, mixer, sceneState, THREE) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const badgeSpin = root.querySelector('[data-pc-spin]');
    const YAW_START = Math.PI / 2;
    const YAW_TRAVEL = Math.PI;
    let mouseX = 0;
    let smoothX = 0;
    let visible = true;

    window.addEventListener('pointermove', event => {
      mouseX = (event.clientX / Math.max(innerWidth, 1)) * 2 - 1;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

    const clock = new THREE.Clock();
    sceneState.renderer.setAnimationLoop(() => {
      if (!visible) return;
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      if (mixer) mixer.update(dt);
      smoothX += (mouseX - smoothX) * 0.08;
      const spin = reduced ? 0 : pinProgress(root);
      const pinning = spin > 0 && spin < 1;
      root.classList.toggle('is-pinning', pinning);

      pivot.rotation.set(0, YAW_START + spin * YAW_TRAVEL + (reduced ? 0 : smoothX * 0.12), 0);
      pivot.position.y = reduced ? 0 : Math.sin(t * 1.1) * 0.03;
      if (badgeSpin) badgeSpin.textContent = `${Math.round(spin * 100)}%`;

      sceneState.cyan.intensity = 8.5 + Math.sin(t * 2.1) * 1.8;
      sceneState.purple.intensity = 6.5 + Math.cos(t * 1.7) * 1.4;
      sceneState.renderer.render(sceneState.scene, sceneState.camera);
    });
  }

  function setProgress(root, value) {
    const label = root.querySelector('[data-pc-progress]');
    if (label) label.textContent = `${Math.round(value * 100)}%`;
  }

  async function start3d(root) {
    const canvas = root.querySelector('#tt-gaming-pc-canvas');
    try {
      const [THREE, loaderModule] = await Promise.all([
        import(THREE_URL),
        import(GLTF_LOADER_URL)
      ]);
      const { GLTFLoader } = loaderModule;
      const sceneState = createScene(root, canvas, THREE);
      await addEnvironment(sceneState.renderer, sceneState.scene, THREE);
      const gltf = await new Promise((resolve, reject) => {
        new GLTFLoader().load(
          MODEL_URL,
          resolve,
          event => { if (event.total) setProgress(root, event.loaded / event.total); },
          reject
        );
      });
      const model = gltf.scene;
      prepareMaterials(model, THREE);
      const pivot = mountCentered(model, sceneState.scene, THREE);
      const mixer = gltf.animations && gltf.animations.length ? new THREE.AnimationMixer(model) : null;
      if (mixer) mixer.clipAction(gltf.animations[0]).play();
      root.classList.add('is-loaded');
      wireMotion(root, pivot, mixer, sceneState, THREE);
    } catch (error) {
      console.error('Gaming setup GLB load failed:', error);
      root.classList.add('has-error');
    }
  }

  async function start() {
    const home = document.querySelector(HOME);
    if (!home) return;
    addCss();
    const root = mountShell(home);
    if (!root) return;
    await start3d(root);
  }

  function lazyStart() {
    const home = document.querySelector(HOME);
    if (!home) return;
    if (!('IntersectionObserver' in window)) return start();
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    }, { rootMargin: '350px' });
    observer.observe(home);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lazyStart, { once: true });
  else lazyStart();
})();
