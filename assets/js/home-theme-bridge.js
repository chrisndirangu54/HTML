/* Shared homepage visual shell for public ISP and shop pages. */
(() => {
  'use strict';
  if (!document.body.classList.contains('tt-home-aligned')) return;

  // Reuse the actual homepage link catalogue via nav-responsive.js.
  const header = document.createElement('header');
  header.className = 'top-navbar tt-floating-header';
  header.setAttribute('aria-label', 'Site navigation');
  header.innerHTML = `<div class="top-navbar-container">
    <button class="top-hamburger tt-floating-toggle" type="button" aria-label="Open site menu" aria-expanded="false" aria-controls="tt-floating-menu">
      <span></span><span></span><span></span>
    </button>
    <ul class="top-menu" aria-label="Primary links"></ul>
    <ul class="top-mobile-menu" id="tt-floating-menu" aria-label="Site menu"></ul>
  </div>`;
  document.body.prepend(header);

  const toggle = header.querySelector('.tt-floating-toggle');
  const menu = header.querySelector('#tt-floating-menu');
  const setOpen = open => {
    menu.classList.toggle('show', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close site menu' : 'Open site menu');
    if (!open) menu.querySelectorAll('details[open]').forEach(item => { item.open = false; });
  };
  toggle.addEventListener('click', event => {
    event.stopPropagation();
    setOpen(!menu.classList.contains('show'));
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !menu.classList.contains('show')) return;
    setOpen(false);
    toggle.focus();
  });

  // The homepage's video is decorative; keep pages usable on reduced-motion
  // devices, constrained networks and browsers that disallow autoplay.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = Boolean(navigator.connection?.saveData);
  if (!reduce && !saveData) {
    const video = document.createElement('video');
    video.className = 'tt-home-video';
    video.muted = true;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    video.preload = 'none';
    const source = document.createElement('source');
    source.src = 'assets/images/video1.mp4';
    source.type = 'video/mp4';
    video.appendChild(source);
    document.body.prepend(video);
    const playing = video.play();
    if (playing && typeof playing.catch === 'function') playing.catch(() => video.remove());
  }

  // Mirror saved manual homepage palette preferences without loading its
  // heavyweight animated homepage-only scripts into shop and forms.
  const swatches = {
    color1:['#28e98c','#14c5fd'], color2:['#e4af12','#fe6f1d'],
    color3:['#fe6f1d','#ffd200'], color4:['#14c5fd','#0072ff'],
    color5:['#e8e8e8','#8d8d8d'], color6:['#1338f3','#00c6ff'],
    color7:['#f31313','#ff6f00'], color8:['#ff99cc','#fc00ff'],
    color9:['#cceb00','#43e97b'], color10:['#00ffcc','#ff00ff'],
    color11:['#ff6f00','#ffcc00'], color12:['#00f260','#0575e6'],
    color13:['#8e2de2','#4a00e0'], color14:['#928dab','#1f1c2c'],
    color15:['#ff512f','#dd2476'], color16:['#12c2e9','#c471ed'],
    color17:['#43e97b','#38f9d7'], color18:['#fc00ff','#00dbde'],
    color19:['#f7971e','#ffd200'], color20:['#1e3c72','#2a5298'],
    color21:['#00c9ff','#92fe9d'], color22:['#ff00cc','#333399'],
    color23:['#ff3c00','#ffafbd'], color24:['#00c6ff','#0072ff']
  };
  try {
    if (localStorage.getItem('colorMode') === 'manual') {
      const colors = swatches[localStorage.getItem('selectedColor')];
      if (colors) {
        document.documentElement.style.setProperty('--primary-color', colors[0]);
        document.documentElement.style.setProperty('--primary-gradient', 'linear-gradient(135deg, '+colors.join(', ')+')');
      }
    }
  } catch (_) { /* Storage access is optional. */ }
})();
