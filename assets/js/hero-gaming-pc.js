(() => {
  'use strict';

  const HOME = '#home';
  const CSS_URL = 'assets/css/hero-gaming-pc.css';
  const MODEL_CHUNKS = Array.from({ length: 6 }, (_, i) => `assets/models/gaming-pc-user.${i}.b64`);
  const LOTTIE_CHUNKS = ['assets/lottie/ai-robo-core.gz.b64'];
  const THREE_URL = 'https://esm.sh/three@0.160.0';
  const GLTF_LOADER_URL = 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
  const LOTTIE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js';

  function addCss() {
    if ([...document.styleSheets].some(s => s.href && s.href.includes('hero-gaming-pc.css'))) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  function loadScript(src, globalCheck) {
    if (globalCheck()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(s => s.src === new URL(src, location.href).href);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function loadModelBytes() {
    const parts = await Promise.all(MODEL_CHUNKS.map(async path => {
      const response = await fetch(path, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Model chunk failed: ${path}`);
      return response.text();
    }));
    const base64 = parts.join('').replace(/\s+/g, '');
    const raw = atob(base64);
    let bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'glTF') throw new Error('Invalid GLB signature');
    const declaredLength = new DataView(bytes.buffer).getUint32(8, true);
    if (declaredLength !== bytes.byteLength) {
      const missing = declaredLength - bytes.byteLength;
      if (missing > 0 && missing <= 4096) {
        const repaired = new Uint8Array(declaredLength);
        repaired.set(bytes);
        bytes = repaired;
        console.warn(`Gaming PC GLB repaired by padding ${missing} trailing bytes.`);
      } else {
        throw new Error(`GLB length mismatch: ${declaredLength} != ${bytes.byteLength}`);
      }
    }
    return bytes.buffer;
  }

  async function loadLottieData() {
    const parts = await Promise.all(LOTTIE_CHUNKS.map(async path => {
      const response = await fetch(path, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Lottie chunk failed: ${path}`);
      return response.text();
    }));
    const base64 = parts.join('').replace(/\s+/g, '');
    const raw = atob(base64);
    const compressed = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) compressed[i] = raw.charCodeAt(i);

    if (!('DecompressionStream' in window)) throw new Error('Browser does not support gzip decompression');
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(stream).text();
    const data = JSON.parse(text);
    if (!data || data.w !== 700 || data.h !== 700 || !Array.isArray(data.layers) || !data.layers.length) {
      throw new Error('Invalid Lottie JSON');
    }
    return data;
  }

  function mountShell(home) {
    const existing = document.getElementById('tt-gaming-pc');
    if (existing) return existing;

    const heroContent = home.querySelector('.hero-content');
    const paragraph = heroContent && heroContent.querySelector(':scope > p');
    if (!heroContent || !paragraph) return null;

    const root = document.createElement('div');
    root.id = 'tt-gaming-pc';
    root.className = 'tt-gaming-pc';
    root.setAttribute('aria-label', 'Interactive 3D gaming PC and AI animation');
    root.innerHTML = `
      <div class="tt-gaming-pc__track">
        <div class="tt-gaming-pc__stage">
          <div class="tt-gaming-pc__glow" aria-hidden="true"></div>
          <canvas id="tt-gaming-pc-canvas" class="tt-gaming-pc__canvas" aria-label="TeknTandao gaming PC 3D model"></canvas>
          <div class="tt-gaming-pc__loading">Loading your 3D model…</div>
          <div class="tt-gaming-pc__badge">Scroll · move mouse</div>
          <div class="tt-gaming-pc__error">3D model could not load</div>
        </div>
        <button class="tt-ai-robo" type="button" aria-label="Replay AI robot animation">
          <span class="tt-ai-robo__glow" aria-hidden="true"></span>
          <span id="tt-ai-robo-lottie" class="tt-ai-robo__lottie"></span>
          <span class="tt-ai-robo__loading">AI</span>
        </button>
      </div>`;

    paragraph.insertAdjacentElement('afterend', root);
    return root;
  }

  function createScene(root, canvas, THREE) {
    const stage = root.querySelector('.tt-gaming-pc__stage');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.25 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    camera.position.set(4.8, 2.8, 6.8);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xeaffff, 0x050b12, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(5, 7, 5);
    scene.add(key);
    const cyan = new THREE.PointLight(0x19dfff, 18, 25, 2);
    cyan.position.set(4, 1.5, 4);
    scene.add(cyan);
    const purple = new THREE.PointLight(0x8d38ff, 14, 22, 2);
    purple.position.set(-4, 0, 3);
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

    return { renderer, scene, camera, cyan, purple };
  }

  function frameModel(model, THREE) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const maxAxis = Math.max(size.x, size.y, size.z) || 1;
    const scale = 3.55 / maxAxis;
    model.scale.setScalar(scale);
    model.position.y -= size.y * scale * 0.05;
  }

  function wireMotion(root, model, sceneState, home, THREE) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mouseX = 0, mouseY = 0, smoothX = 0, smoothY = 0, scrollProgress = 0, smoothScrollProgress = 0, visible = true;

    const updateScroll = () => {
      const r = home.getBoundingClientRect();
      const vh = innerHeight || 1;
      scrollProgress = Math.max(0, Math.min(1, (vh - r.top) / Math.max(vh + r.height, 1)));
    };
    const updatePointer = event => {
      mouseX = (event.clientX / Math.max(innerWidth, 1)) * 2 - 1;
      mouseY = (event.clientY / Math.max(innerHeight, 1)) * 2 - 1;
    };
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('pointermove', updatePointer, { passive: true });
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
    updateScroll();
    smoothScrollProgress = scrollProgress;

    const clock = new THREE.Clock();
    sceneState.renderer.setAnimationLoop(() => {
      if (!visible) return;
      const t = clock.getElapsedTime();
      smoothX += (mouseX - smoothX) * 0.05;
      smoothY += (mouseY - smoothY) * 0.05;
      smoothScrollProgress += (scrollProgress - smoothScrollProgress) * 0.035;
      const p = reduced ? 0.5 : smoothScrollProgress;
      const compactViewport = innerWidth <= 900;
      const travel = reduced ? 0 : (p - 0.5) * 70;
      const bounce = reduced ? 0 : Math.sin(p * Math.PI * 6) * 18 + Math.sin(t * 1.8) * 7;
      const pointerX = reduced ? 0 : smoothX * 16;
      const pointerY = reduced ? 0 : smoothY * 9;
      root.style.setProperty('--pc-scroll-x', `${travel.toFixed(2)}%`);
      root.style.setProperty('--pc-bounce-y', `${bounce.toFixed(2)}px`);
      root.style.setProperty('--pc-pointer-x', `${pointerX.toFixed(2)}px`);
      root.style.setProperty('--pc-pointer-y', `${pointerY.toFixed(2)}px`);

      model.rotation.y = compactViewport
        ? -0.48 + (p - 0.5) * 0.7 + smoothX * 0.06
        : -0.48 + p * Math.PI * 1.7 + smoothX * 0.1;
      model.rotation.x = -0.04 - smoothY * 0.05 + (reduced ? 0 : Math.sin(t * 0.75) * 0.015);
      sceneState.cyan.intensity = 16 + Math.sin(t * 2.1) * 3;
      sceneState.purple.intensity = 12 + Math.cos(t * 1.7) * 2;
      sceneState.renderer.render(sceneState.scene, sceneState.camera);
    });
  }

  async function start3d(root, home) {
    const canvas = root.querySelector('#tt-gaming-pc-canvas');
    try {
      const [THREE, loaderModule, buffer] = await Promise.all([
        import(THREE_URL),
        import(GLTF_LOADER_URL),
        loadModelBytes()
      ]);
      const { GLTFLoader } = loaderModule;
      const sceneState = createScene(root, canvas, THREE);
      const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject));
      const model = gltf.scene;
      frameModel(model, THREE);
      sceneState.scene.add(model);
      root.classList.add('is-loaded');
      wireMotion(root, model, sceneState, home, THREE);
    } catch (error) {
      console.error('Gaming PC direct GLTF load failed:', error);
      root.classList.add('has-error');
    }
  }

  async function startLottie(root) {
    const holder = root.querySelector('#tt-ai-robo-lottie');
    const button = root.querySelector('.tt-ai-robo');
    try {
      const [, animationData] = await Promise.all([
        loadScript(LOTTIE_URL, () => Boolean(window.lottie)),
        loadLottieData()
      ]);
      const animation = window.lottie.loadAnimation({
        container: holder,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData
      });
      button.classList.add('is-loaded');
      button.addEventListener('click', () => {
        animation.goToAndPlay(0, true);
        animation.setSpeed(1.25);
        setTimeout(() => animation.setSpeed(1), 900);
      });
    } catch (error) {
      console.error('AI robo Lottie failed:', error);
      button.classList.add('has-error');
    }
  }

  async function start() {
    const home = document.querySelector(HOME);
    if (!home) return;
    addCss();
    const root = mountShell(home);
    if (!root) return;
    await Promise.allSettled([start3d(root, home), startLottie(root)]);
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
