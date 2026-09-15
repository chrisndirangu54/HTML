(() => {
  'use strict';

  const HOME = '#home';
  const CSS_URL = 'assets/css/hero-gaming-pc.css';
  const MODEL_VIEWER_URL = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
  const MODEL_CHUNKS = Array.from({ length: 6 }, (_, i) => `assets/models/gaming-pc-user.${i}.b64`);

  function addCss() {
    if ([...document.styleSheets].some(s => s.href && s.href.includes('hero-gaming-pc.css'))) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  function loadModelViewer() {
    if (customElements.get('model-viewer')) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(s => s.src === new URL(MODEL_VIEWER_URL, location.href).href);
      if (existing) {
        customElements.whenDefined('model-viewer').then(resolve).catch(reject);
        return;
      }
      const script = document.createElement('script');
      script.type = 'module';
      script.src = MODEL_VIEWER_URL;
      script.crossOrigin = 'anonymous';
      script.onload = () => customElements.whenDefined('model-viewer').then(resolve).catch(reject);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function buildModelUrl() {
    const parts = await Promise.all(MODEL_CHUNKS.map(async path => {
      const response = await fetch(path, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Model chunk failed: ${path}`);
      return response.text();
    }));
    const base64 = parts.join('').replace(/\s+/g, '');
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    if (String.fromCharCode(...bytes.slice(0, 4)) !== 'glTF') throw new Error('Invalid GLB signature');
    return URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }));
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
    root.setAttribute('aria-label', 'Interactive 3D gaming PC');
    root.innerHTML = `
      <div class="tt-gaming-pc__track">
        <div class="tt-gaming-pc__stage">
          <div class="tt-gaming-pc__glow" aria-hidden="true"></div>
          <model-viewer
            id="tt-gaming-pc-model"
            class="tt-gaming-pc__model"
            alt="TeknTandao gaming PC 3D model"
            interaction-prompt="none"
            shadow-intensity="1.15"
            shadow-softness=".9"
            exposure="1.15"
            environment-image="neutral"
            camera-orbit="-28deg 72deg auto"
            min-camera-orbit="-180deg 48deg auto"
            max-camera-orbit="180deg 88deg auto"
            disable-pan
          ></model-viewer>
          <div class="tt-gaming-pc__loading">Loading 3D model…</div>
          <div class="tt-gaming-pc__badge">Scroll · move mouse</div>
          <div class="tt-gaming-pc__error">3D model could not load</div>
        </div>
      </div>`;

    paragraph.insertAdjacentElement('afterend', root);
    return root;
  }

  function wireMotion(root, model, home) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mouseX = 0;
    let mouseY = 0;
    let smoothX = 0;
    let smoothY = 0;
    let scrollProgress = 0;
    let visible = true;
    let raf = 0;

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

    const frame = time => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;

      smoothX += (mouseX - smoothX) * 0.055;
      smoothY += (mouseY - smoothY) * 0.055;

      const p = reduced ? 0.5 : scrollProgress;
      const travel = reduced ? 0 : (p - 0.5) * 70;
      const bounce = reduced ? 0 : Math.sin(p * Math.PI * 6) * 18 + Math.sin(time * 0.0014) * 7;
      const pointerX = reduced ? 0 : smoothX * 16;
      const pointerY = reduced ? 0 : smoothY * 9;

      root.style.setProperty('--pc-scroll-x', `${travel.toFixed(2)}%`);
      root.style.setProperty('--pc-bounce-y', `${bounce.toFixed(2)}px`);
      root.style.setProperty('--pc-pointer-x', `${pointerX.toFixed(2)}px`);
      root.style.setProperty('--pc-pointer-y', `${pointerY.toFixed(2)}px`);

      const azimuth = -35 + p * 310 + smoothX * 16;
      const polar = 70 + smoothY * 5;
      model.setAttribute('camera-orbit', `${azimuth.toFixed(1)}deg ${polar.toFixed(1)}deg auto`);
    };

    raf = requestAnimationFrame(frame);
    window.addEventListener('pagehide', () => cancelAnimationFrame(raf), { once: true });
  }

  async function start() {
    const home = document.querySelector(HOME);
    if (!home) return;
    addCss();
    const root = mountShell(home);
    if (!root) return;

    const model = root.querySelector('#tt-gaming-pc-model');
    try {
      const [modelUrl] = await Promise.all([buildModelUrl(), loadModelViewer().then(() => null)]).then(async values => {
        const url = values[0] || await buildModelUrl();
        return [url];
      });
      model.src = modelUrl;
      model.addEventListener('load', () => root.classList.add('is-loaded'), { once: true });
      model.addEventListener('error', () => root.classList.add('has-error'), { once: true });
      wireMotion(root, model, home);
      window.addEventListener('pagehide', () => URL.revokeObjectURL(modelUrl), { once: true });
    } catch (error) {
      console.warn('Gaming PC model failed:', error);
      root.classList.add('has-error');
    }
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
