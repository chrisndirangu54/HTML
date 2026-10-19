(() => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const limitedMemory = Number(navigator.deviceMemory) > 0 && navigator.deviceMemory <= 4;
  const limitedCpu = Number(navigator.hardwareConcurrency) > 0 && navigator.hardwareConcurrency <= 4;
  const slowConnection = /^(slow-2g|2g)$/.test(connection?.effectiveType || '');
  window.TTScenePolicy = Object.freeze({
    allowed: !(limitedMemory || limitedCpu || connection?.saveData || slowConnection || matchMedia('(prefers-reduced-motion: reduce)').matches)
  });
})();
