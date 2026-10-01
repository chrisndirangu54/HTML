(() => {
  'use strict';

  function animateTallies() {
    const nodes = [...document.querySelectorAll('.tt-tally')];
    if (!nodes.length) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const run = (node) => {
      if (node.dataset.ran === '1') return;
      node.dataset.ran = '1';
      const target = Number(node.dataset.target);
      const suffix = node.dataset.suffix || '';
      if (!Number.isFinite(target)) return;
      if (reduced) {
        node.textContent = `${target}${suffix}`;
        return;
      }
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / 1400);
        const eased = 1 - Math.pow(1 - t, 3);
        node.textContent = `${Math.round(target * eased)}${suffix}`;
        if (t < 1) requestAnimationFrame(tick);
        else node.classList.add('is-done');
      };
      requestAnimationFrame(tick);
    };
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(run);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        run(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.55 });
    nodes.forEach((node) => observer.observe(node));
  }

  function animateStage() {
    const stage = document.querySelector('.tt-hero-parallax');
    if (!stage) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveal = () => stage.classList.add('is-in');
    if (reduced || !('IntersectionObserver' in window)) reveal();
    else {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal();
          observer.disconnect();
        }
      }, { threshold: 0.22 });
      observer.observe(stage);
    }
    if (reduced) return;
    const left = stage.querySelector('.tt-hero-parallax__media--left');
    const right = stage.querySelector('.tt-hero-parallax__media--right');
    const front = stage.querySelector('.tt-hero-parallax__media--front');
    const tick = () => {
      const rect = stage.getBoundingClientRect();
      const delta = (rect.top + rect.height / 2 - innerHeight / 2) / Math.max(innerHeight, 1);
      if (left) left.style.transform = `translate3d(${(delta * -34).toFixed(1)}px, ${(delta * 26).toFixed(1)}px, 0)`;
      if (right) right.style.transform = `translate3d(${(delta * 38).toFixed(1)}px, ${(delta * -20).toFixed(1)}px, 0)`;
      if (front) front.style.transform = `translate3d(${(delta * -10).toFixed(1)}px, ${(delta * 16).toFixed(1)}px, 0)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function boot() {
    animateTallies();
    animateStage();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
