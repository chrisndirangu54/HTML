/* Non-essential Web3 visual enhancement. Images remain visible without JS. */
(() => {
  'use strict';
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dataSaver = Boolean(navigator.connection && navigator.connection.saveData);
  const hiddenPage = document.visibilityState === 'hidden';
  if (reducedMotion || dataSaver) {
    document.body.classList.add('tt-w3-motion-off');
    return;
  }
  const refreshVisibility = () => {
    document.body.classList.toggle('tt-w3-motion-off', document.visibilityState === 'hidden');
  };
  if (hiddenPage) document.body.classList.add('tt-w3-motion-off');
  document.addEventListener('visibilitychange', refreshVisibility);
  const targets = Array.from(document.querySelectorAll('.tt-w3-reveal'));
  if (!targets.length || !('IntersectionObserver' in window)) return;
  // Progressive enhancement: reveal every element if observer setup fails.
  try {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, {rootMargin:'0px 0px -6% 0px',threshold:0.08});
    targets.forEach(element => observer.observe(element));
    // Do not hide content until observers are active and can reveal it.
    document.body.classList.add('tt-w3-motion-ready');
  } catch (_) {
    targets.forEach(element => element.classList.add('is-visible'));
  }
})();
