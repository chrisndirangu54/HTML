(() => {
  'use strict';

  const LOTTIE_JSON = 'assets/lottie/ai-robo-lite.json';
  const LOTTIE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js';

  function loadScript(src) {
    if (window.lottie) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(s => s.src === new URL(src, location.href).href);
      if (existing) {
        if (window.lottie) return resolve();
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
    const response = await fetch(LOTTIE_JSON, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Lottie JSON failed: ${response.status}`);
    const data = await response.json();
    if (data.w !== 700 || data.h !== 700 || !Array.isArray(data.layers) || data.layers.length < 3) {
      throw new Error('Invalid AI robo Lottie JSON');
    }
    return data;
  }

  function waitForHolder() {
    const existing = document.getElementById('tt-ai-robo-lottie');
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      let observer;
      const timeout = setTimeout(() => {
        if (observer) observer.disconnect();
        reject(new Error('AI robo holder was not mounted'));
      }, 10000);
      observer = new MutationObserver(() => {
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
        button.addEventListener('click', () => {
          animation.goToAndPlay(0, true);
          animation.setSpeed(1.25);
          setTimeout(() => animation.setSpeed(1), 700);
        });
      }
    } catch (error) {
      console.error('AI robo fallback failed:', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
