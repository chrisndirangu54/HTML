(() => {
  'use strict';

  const PALETTES = {
    color1: { color: '#28e98c', gradient: 'linear-gradient(135deg, #28e98c, #14c5fd)' },
    color2: { color: '#e4af12', gradient: 'linear-gradient(135deg, #e4af12, #fe6f1d)' },
    color3: { color: '#fe6f1d', gradient: 'linear-gradient(135deg, #fe6f1d, #ffd200)' },
    color4: { color: '#14c5fd', gradient: 'linear-gradient(135deg, #14c5fd, #0072ff)' },
    color5: { color: '#c0c0c0', gradient: 'linear-gradient(135deg, #e8e8e8, #8d8d8d)' },
    color6: { color: '#1338f3', gradient: 'linear-gradient(135deg, #1338f3, #00c6ff)' },
    color7: { color: '#f31313', gradient: 'linear-gradient(135deg, #f31313, #ff6f00)' },
    color8: { color: '#ff99cc', gradient: 'linear-gradient(135deg, #ff99cc, #fc00ff)' },
    color9: { color: '#cceb00', gradient: 'linear-gradient(135deg, #cceb00, #43e97b)' },
    color10: { color: '#00ffcc', gradient: 'linear-gradient(135deg, #00ffcc, #ff00ff)' },
    color11: { color: '#ff6f00', gradient: 'linear-gradient(135deg, #ff6f00, #ffcc00)' },
    color12: { color: '#00f260', gradient: 'linear-gradient(135deg, #00f260, #0575e6)' },
    color13: { color: '#8e2de2', gradient: 'linear-gradient(135deg, #8e2de2, #4a00e0)' },
    color14: { color: '#928dab', gradient: 'linear-gradient(135deg, #1f1c2c, #928dab)' },
    color15: { color: '#ff512f', gradient: 'linear-gradient(135deg, #ff512f, #dd2476)' },
    color16: { color: '#c471ed', gradient: 'linear-gradient(135deg, #12c2e9, #c471ed, #f64f59)' },
    color17: { color: '#43e97b', gradient: 'linear-gradient(135deg, #43e97b, #38f9d7)' },
    color18: { color: '#fc00ff', gradient: 'linear-gradient(135deg, #fc00ff, #00dbde)' },
    color19: { color: '#f7971e', gradient: 'linear-gradient(135deg, #f7971e, #ffd200)' },
    color20: { color: '#2a5298', gradient: 'linear-gradient(135deg, #1e3c72, #2a5298)' },
    color21: { color: '#00c9ff', gradient: 'linear-gradient(135deg, #00c9ff, #92fe9d)' },
    color22: { color: '#ff00cc', gradient: 'linear-gradient(135deg, #ff00cc, #333399)' },
    color23: { color: '#ff3c00', gradient: 'linear-gradient(135deg, #ff3c00, #ffafbd)' },
    color24: { color: '#00c6ff', gradient: 'linear-gradient(135deg, #00c6ff, #0072ff)' }
  };

  const LOTTIE_JSON = 'assets/lottie/ai-robo.json';
  const LOTTIE_LITE = 'assets/lottie/ai-robo-lite.json';
  const LOTTIE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js';

  let mode = localStorage.getItem('colorMode') || 'auto';
  let autoRaf = 0;
  let orbRaf = 0;
  let mouseX = 0;
  let mouseY = 0;
  let smoothX = 0;
  let smoothY = 0;

  function hexToRgb(hex) {
    const n = hex.replace('#', '');
    const v = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
    const num = parseInt(v, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  function applyTheme(color, gradient, name, persist) {
    const root = document.documentElement;
    const rgb = hexToRgb(color);
    root.style.setProperty('--primary-color', color);
    root.style.setProperty('--primary_color', color);
    root.style.setProperty('--primary-gradient', gradient);
    root.style.setProperty('--accent', color);
    root.style.setProperty('--accent-rgb', rgb.join(', '));
    document.body.style.setProperty('--primary-color', color);
    document.body.style.setProperty('--primary-gradient', gradient);
    if (name) {
      document.querySelectorAll('.color-boxed a').forEach(link => {
        link.classList.toggle('clr-active', link.getAttribute('onclick') === `${name}();`);
      });
    }
    if (persist) {
      localStorage.setItem('selectedColor', name || '');
      localStorage.setItem('colorMode', mode);
    }
  }

  function applyPalette(name, persist) {
    const palette = PALETTES[name];
    if (!palette) return;
    applyTheme(palette.color, palette.gradient, name, persist);
  }

  function setManual(name) {
    mode = 'manual';
    stopAuto();
    applyPalette(name, true);
  }

  function setAuto() {
    mode = 'auto';
    localStorage.setItem('colorMode', 'auto');
    document.querySelectorAll('.color-boxed a').forEach(link => {
      link.classList.toggle('clr-active', link.getAttribute('onclick') === 'colorAuto();');
    });
    startAuto();
  }

  function stopAuto() {
    if (autoRaf) cancelAnimationFrame(autoRaf);
    autoRaf = 0;
  }

  function startAuto() {
    stopAuto();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      applyPalette('color4', false);
      return;
    }
    const tick = now => {
      if (mode !== 'auto') return;
      const hue = (now / 70) % 360;
      const color = `hsl(${hue.toFixed(1)} 85% 56%)`;
      const gradient = `linear-gradient(135deg, hsl(${hue.toFixed(1)} 90% 58%), hsl(${((hue + 48) % 360).toFixed(1)} 85% 55%), hsl(${((hue + 118) % 360).toFixed(1)} 80% 52%))`;
      applyTheme(color, gradient, 'colorAuto', false);
      autoRaf = requestAnimationFrame(tick);
    };
    autoRaf = requestAnimationFrame(tick);
  }

  function loadScript(src, check) {
    if (check && check()) return Promise.resolve();
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
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function addStylesheet(href) {
    if ([...document.styleSheets].some(s => s.href && s.href.includes(href.split('/').pop()))) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function injectInnerChrome() {
    if (document.body.classList.contains('home1-page')) return;
    addStylesheet('assets/css/site-pages.css');

    if (!document.getElementById('background-video')) {
      const video = document.createElement('video');
      video.id = 'background-video';
      video.className = 'body-overlay';
      video.muted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.innerHTML = '<source src="assets/images/video1.mp4" type="video/mp4">';
      document.body.prepend(video);
    }

    if (!document.querySelector('.global-color')) {
      const wrap = document.createElement('div');
      wrap.className = 'global-color';
      wrap.innerHTML = `
        <span class="setting-toggle" title="Colours and themes"><i class="las la-cog"></i></span>
        <div class="inner">
          <div class="overlay"></div>
          <div class="global-color-option">
            <span class="close-settings"><i class="las la-times"></i></span>
            <h2>Configuration</h2>
            <div class="global-color-option-inner">
              <p>Colors</p>
              <div class="color-boxed"></div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const box = wrap.querySelector('.color-boxed');
      box.innerHTML = '<a href="#" onclick="colorAuto();" title="Auto cycle" class="tt-color-auto"></a>' +
        Object.keys(PALETTES).map(name => `<a href="#" onclick="${name}();" title="${name}" style="background:${PALETTES[name].color}"></a>`).join('');
    }

    if (!document.querySelector('.footer-area')) {
      const footer = document.createElement('footer');
      footer.className = 'footer-area tt-site-footer';
      footer.innerHTML = `
        <div class="custom-container">
          <div class="footer-widget-item">
            <h3>TeknTandao</h3>
            <p>Intelligent, data-driven software from Nairobi, Kenya.</p>
            <ul class="social-links">
              <li><a href="https://www.facebook.com/share/1GBT3wovGv/"><i class="lab la-facebook"></i></a></li>
              <li><a href="https://www.instagram.com/tekntandao/"><i class="lab la-instagram"></i></a></li>
              <li><a href="https://www.tiktok.com/@tekntandao"><i class="lab la-tiktok"></i></a></li>
              <li><a href="https://wa.me/254702258870"><i class="lab la-whatsapp"></i></a></li>
            </ul>
          </div>
          <div class="footer-widget-item footer-links">
            <h3>Explore</h3>
            <ul>
              <li><a href="index.html">Home</a></li>
              <li><a href="web3.html">Web3</a></li>
              <li><a href="isp.html">ISP</a></li>
              <li><a href="cybersecurity.html">Cybersecurity</a></li>
              <li><a href="shop.html">Shop</a></li>
              <li><a href="blog.html">Blogs</a></li>
              <li><a href="gallery.html">Gallery</a></li>
              <li><a href="index.html#contact">Contact</a></li>
            </ul>
          </div>
          <div class="footer-widget-item footer-contact-widget">
            <h3>Contact</h3>
            <ul>
              <li><span class="title">Email</span><span class="sub-title">info@tekntandao.com</span></li>
              <li><span class="title">Phone</span><span class="sub-title">+254 702 258 870</span></li>
            </ul>
          </div>
        </div>`;
      document.body.appendChild(footer);
    }
  }

  function ensureAutoSwatch() {
    const box = document.querySelector('.color-boxed');
    if (!box || box.querySelector('.tt-color-auto')) return;
    const auto = document.createElement('a');
    auto.href = '#';
    auto.className = 'tt-color-auto';
    auto.title = 'Auto cycle colours';
    auto.setAttribute('onclick', 'colorAuto();');
    box.appendChild(auto);
  }

  function pageProgress() {
    const max = Math.max((document.documentElement.scrollHeight || document.body.scrollHeight) - innerHeight, 1);
    return Math.max(0, Math.min(1, (window.pageYOffset || document.documentElement.scrollTop || 0) / max));
  }

  function mountOrb() {
    if (document.getElementById('tt-scroll-orb')) return document.getElementById('tt-scroll-orb');
    const orb = document.createElement('button');
    orb.type = 'button';
    orb.id = 'tt-scroll-orb';
    orb.className = 'tt-scroll-orb';
    orb.setAttribute('aria-label', 'Open the TeknTandao assistant');
    orb.setAttribute('aria-expanded', 'false');
    orb.setAttribute('aria-controls', 'tt-chat');
    orb.innerHTML = '<span class="tt-scroll-orb__lottie" id="tt-ai-robo-lottie"></span>';
    document.body.appendChild(orb);
    return orb;
  }

  function assistantEndpoint() {
    const cfg = window.TEKNTANDAO_CONFIG || {};
    const base = String(cfg.functionsBaseUrl || '').replace(/\/$/, '');
    return base ? `${base}/siteAssistant` : '/api/siteAssistant';
  }

  function mountChat() {
    if (document.getElementById('tt-chat')) return document.getElementById('tt-chat');
    const chat = document.createElement('div');
    chat.id = 'tt-chat';
    chat.className = 'tt-chat';
    chat.hidden = true;
    chat.innerHTML = `
      <div class="tt-chat__panel" role="dialog" aria-modal="false" aria-labelledby="tt-chat-title">
        <div class="tt-chat__bar">
          <strong id="tt-chat-title">TeknTandao assistant</strong>
          <button type="button" data-chat-close>Close</button>
        </div>
        <div class="tt-chat__log"></div>
        <form class="tt-chat__form">
          <textarea maxlength="800" rows="2" placeholder="Ask about our work, WiFi, or Kenyan Web3" required></textarea>
          <button type="submit">Send</button>
        </form>
        <p class="tt-chat__note">General information only. Not financial, legal, or licensing advice.</p>
      </div>`;
    document.body.appendChild(chat);
    return chat;
  }

  function wireChat(orb, chat) {
    const log = chat.querySelector('.tt-chat__log');
    const form = chat.querySelector('form');
    const input = chat.querySelector('textarea');
    const send = form.querySelector('button');
    const messages = [];
    const setOpen = (open) => {
      chat.hidden = !open;
      orb.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) window.setTimeout(() => input.focus(), 30);
    };
    const addBubble = (role, text) => {
      const item = document.createElement('p');
      item.className = `tt-chat__bubble tt-chat__bubble--${role}`;
      item.textContent = text;
      log.appendChild(item);
      log.scrollTop = log.scrollHeight;
      return item;
    };
    addBubble('assistant', 'Ask about TeknTandao, WiFi installation, or the Kenyan Web3 desk.');
    orb.addEventListener('click', () => setOpen(chat.hidden));
    chat.querySelector('[data-chat-close]').addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !chat.hidden) setOpen(false);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || send.disabled) return;
      input.value = '';
      addBubble('user', text);
      messages.push({ role: 'user', content: text });
      const pending = addBubble('assistant', 'Thinking…');
      send.disabled = true;
      try {
        const res = await fetch(assistantEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messages.slice(-8) })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.reply) throw new Error(data.error || 'offline');
        pending.textContent = data.reply;
        messages.push({ role: 'assistant', content: data.reply });
      } catch (error) {
        messages.pop();
        pending.textContent = 'The assistant is not reachable from this page yet. Email info@tekntandao.com or WhatsApp +254 702 258 870.';
      } finally {
        send.disabled = false;
        log.scrollTop = log.scrollHeight;
      }
    });
  }

  async function startOrb(orb) {
    const holder = orb.querySelector('#tt-ai-robo-lottie');
    try {
      await loadScript(LOTTIE_URL, () => Boolean(window.lottie));
      let data;
      try {
        const res = await fetch(LOTTIE_JSON, { cache: 'force-cache' });
        if (!res.ok) throw new Error(res.status);
        data = await res.json();
      } catch {
        const res = await fetch(LOTTIE_LITE, { cache: 'force-cache' });
        data = await res.json();
      }
      window.lottie.loadAnimation({
        container: holder,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: data
      });
      orb.classList.add('is-loaded');
    } catch (error) {
      console.error('Scroll orb failed:', error);
      orb.classList.add('has-error');
    }
  }

  function wireOrb(orb) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const onMove = event => {
      mouseX = (event.clientX / Math.max(innerWidth, 1)) * 2 - 1;
      mouseY = (event.clientY / Math.max(innerHeight, 1)) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const tick = t => {
      smoothX += (mouseX - smoothX) * 0.08;
      smoothY += (mouseY - smoothY) * 0.08;
      if (!reduced) {
        const p = pageProgress();
        const ang = p * Math.PI * 2;
        const x = 50 + Math.sin(ang) * 38 + smoothX * 10;
        const y = 16 + (1 - Math.cos(ang)) * 28 + Math.sin(p * Math.PI * 3) * 10 + smoothY * 8;
        const tilt = smoothX * 16;
        orb.style.setProperty('--orb-x', `${x.toFixed(2)}vw`);
        orb.style.setProperty('--orb-y', `${y.toFixed(2)}vh`);
        orb.style.setProperty('--orb-tilt', `${tilt.toFixed(2)}deg`);
        orb.style.setProperty('--orb-bob', `${Math.sin(t / 420) * 10}px`);
      }
      orbRaf = requestAnimationFrame(tick);
    };
    orbRaf = requestAnimationFrame(tick);
  }

  function loadPageScripts() {
    const add = (id, src) => {
      if (document.getElementById(id)) return;
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.defer = true;
      document.body.appendChild(script);
    };
    if (document.body.classList.contains('home1-page')) add('tt-footer-robot-loader', 'assets/js/footer-robot.js');
  }

  function wireSettings() {
    document.addEventListener('click', event => {
      if (event.target.closest('.setting-toggle')) {
        event.preventDefault();
        document.querySelector('.global-color')?.classList.add('active');
      }
      if (event.target.closest('.close-settings, .global-color .overlay')) {
        document.querySelector('.global-color')?.classList.remove('active');
      }
    });
  }

  function ensureIcons() {
    if ([...document.styleSheets].some(s => s.href && s.href.includes('line-awesome'))) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://maxst.icons8.com/vue-static/landings/line-awesome/line-awesome/1.3.0/css/line-awesome.min.css';
    document.head.appendChild(link);
  }

  window.colorAuto = function (event) {
    if (event) event.preventDefault();
    setAuto();
  };
  Object.keys(PALETTES).forEach(name => {
    window[name] = function (event) {
      if (event) event.preventDefault();
      setManual(name);
    };
  });
  window.applyColor = function (color, name) {
    mode = 'manual';
    stopAuto();
    applyTheme(color, `linear-gradient(135deg, ${color}, ${color})`, name, true);
  };
  window.applyGradient = function (gradient, name) {
    const palette = PALETTES[name] || { color: '#14c5fd', gradient };
    setManual(name || 'color4');
    applyTheme(palette.color, gradient, name, true);
  };
  window.TTTheme = { applyPalette, setAuto, setManual, palettes: PALETTES };

  function boot() {
    ensureIcons();
    ensureAutoSwatch();
    injectInnerChrome();
    wireSettings();
    addStylesheet('assets/css/hero-gaming-pc.css');
    addStylesheet('assets/css/site-pages.css');
    if (mode === 'manual' && PALETTES[localStorage.getItem('selectedColor')]) {
      applyPalette(localStorage.getItem('selectedColor'), false);
    } else {
      setAuto();
    }
    const orb = mountOrb();
    const chat = mountChat();
    wireOrb(orb);
    wireChat(orb, chat);
    startOrb(orb);
    loadPageScripts();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
