(() => {
  'use strict';

  const CHUNKS = Array.from({ length: 6 }, (_, i) => `assets/lottie/ai-robo-core.${i}.gz.b64`);
  const LOTTIE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js';

  function loadScript(src) {
    if (window.lottie) return Promise.resolve();
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

  async function getAnimationData() {
    const parts = await Promise.all(CHUNKS.map(async path => {
      const response = await fetch(path, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Lottie chunk failed: ${path}`);
      return response.text();
    }));
    const base64 = parts.join('').replace(/\s+/g, '');
    const raw = atob(base64);
    const compressed = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) compressed[i] = raw.charCodeAt(i);
    if (!('DecompressionStream' in window)) throw new Error('gzip decompression unsupported');
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const data = JSON.parse(await new Response(stream).text());
    if (data.w !== 700 || data.h !== 700 || !Array.isArray(data.layers) || data.layers.length !== 3) {
      throw new Error('Invalid AI robo Lottie payload');
    }
    return data;
  }

  function waitForHolder() {
    const existing = document.getElementById('tt-ai-robo-lottie');
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        observer.disconnect();
        reject(new Error('AI robo holder was not mounted'));
      }, 10000);
      const observer = new MutationObserver(() => {
        const holder = document.getElementById('tt-ai-robo-lottie');
        if (!holder) return;
        clearTimeout(timeout);
        observer.disconnect();
        resolve(holder);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  async function start() {
    try {
      const [holder, data] = await Promise.all([waitForHolder(), getAnimationData(), loadScript(LOTTIE_URL)]).then(v => [v[0], v[1]]);
      if (!window.lottie || holder.dataset.fallbackRendered === 'true' || holder.children.length) return;
      const button = holder.closest('.tt-ai-robo');
      const animation = window.lottie.loadAnimation({
        container: holder,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: data
      });
      holder.dataset.fallbackRendered = 'true';
      if (button) {
        button.classList.remove('has-error');
        button.classList.add('is-loaded');
        button.addEventListener('click', () => animation.goToAndPlay(0, true));
      }
    } catch (error) {
      console.error('AI robo fallback failed:', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
