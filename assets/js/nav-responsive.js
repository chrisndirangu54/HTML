/* Shared navigation for TeknTandao public pages. Keep destinations in this one file. */
(() => {
  'use strict';

  const items = [
    { label: 'Home', href: 'index.html' },
    { label: 'Services', children: [
      { label: 'All services', href: 'index.html#services' },
      { label: 'Cybersecurity', href: 'cybersecurity.html' },
      { label: 'ISP & networking', href: 'isp.html' },
      { label: 'Cloud Automation', href: 'cloud-automation.html' },
      { label: 'SEO Cloud', href: 'seo-cloud.html' },
      { label: 'Web3', href: 'web3.html' }
    ] },
    { label: 'Shop', href: 'shop.html' },
    { label: 'Explore', children: [
      { label: 'About us', href: 'index.html#about' },
      { label: 'Blogs', href: 'blog.html' },
      { label: 'Gallery', href: 'gallery.html' },
      { label: 'Awards', href: 'awards.html' },
      { label: 'Podcasts', href: 'podcasts.html' },
      { label: 'Events', href: 'events.html' },
      { label: 'Training', href: 'training.html' },
      { label: 'Communities', href: 'https://chat.whatsapp.com/LwqKsFRyua3Kinc9SRgZnj' }
    ] },
    { label: 'Contact', href: 'contact_page.html' },
    { label: 'Workspace', href: 'https://tekntandaoworkspace.web.app/' }
  ];

  // Load the same visual treatment across the differently styled public pages.
  if (!document.querySelector('link[data-tt-site-navigation]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'assets/css/site-navigation.css';
    style.dataset.ttSiteNavigation = 'true';
    document.head.appendChild(style);
  }

  function isCurrent(href) {
    if (/^https?:/i.test(href)) return false;
    const path = location.pathname.split('/').pop() || 'index.html';
    const target = href.split('#')[0] || 'index.html';
    return path === target;
  }

  function makeLink(item) {
    const anchor = document.createElement('a');
    anchor.href = item.href;
    anchor.textContent = item.label;
    anchor.className = 'tt-nav-link';
    if (/^https?:/i.test(item.href)) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    if (isCurrent(item.href)) anchor.setAttribute('aria-current', 'page');
    return anchor;
  }

  function makeItem(item, list) {
    const wrapper = list ? document.createElement('li') : document.createElement('div');
    wrapper.className = 'tt-nav-item';
    if (item.children) {
      const details = document.createElement('details');
      details.className = 'tt-nav-dropdown';
      const summary = document.createElement('summary');
      summary.textContent = item.label;
      details.appendChild(summary);
      const submenu = document.createElement('div');
      submenu.className = 'tt-nav-panel';
      item.children.forEach(child => submenu.appendChild(makeLink(child)));
      if (item.children.some(child => isCurrent(child.href))) wrapper.classList.add('tt-nav-current');
      details.appendChild(submenu);
      wrapper.appendChild(details);
    } else {
      wrapper.appendChild(makeLink(item));
    }
    return wrapper;
  }

  function closeGroups(root) {
    root.querySelectorAll('.tt-nav-dropdown[open]').forEach(details => { details.open = false; });
  }

  function fillList(node) {
    if (!node) return;
    node.replaceChildren(...items.map(item => makeItem(item, true)));
    node.classList.add('tt-nav-list');
  }

  function keepAction(node) {
    if (node.tagName === 'BUTTON') return true;
    if (node.matches('#auth-link, #whatsapp, .isp-sign-in, [data-nav-action]')) return true;
    if (node.tagName !== 'A') return false;
    const label = node.textContent.trim().toLowerCase();
    const href = node.getAttribute('href') || '';
    return /^(sign in|log in|log out|sign out|my account|customer isp|staff|admin)$/.test(label) ||
      /^(login|account|isp-staff|admin)\.html(?:[?#]|$)/.test(href);
  }

  function fillStandardNav(nav) {
    if (!nav || nav.dataset.ttNavReady) return;
    nav.dataset.ttNavReady = 'true';
    nav.setAttribute('aria-label', 'Primary navigation');
    const old = Array.from(nav.children);
    const brand = old.find(node => node.matches('a.brand')) || document.createElement('a');
    if (!brand.classList.contains('brand')) {
      brand.className = 'brand';
      brand.href = 'index.html';
      brand.textContent = 'TeknTandao';
    }
    const extras = old.filter(node => node !== brand && keepAction(node));
    const menu = document.createElement('div');
    menu.className = 'commerce-nav-menu tt-nav-items';
    menu.id = 'tt-menu-' + (document.querySelectorAll('[data-tt-nav-ready]').length + 1);
    items.forEach(item => menu.appendChild(makeItem(item, false)));
    if (extras.length) {
      const actions = document.createElement('div');
      actions.className = 'tt-nav-actions';
      extras.forEach(node => actions.appendChild(node));
      menu.appendChild(actions);
    }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'commerce-nav-toggle';
    toggle.textContent = '☰';
    toggle.setAttribute('aria-label', 'Open navigation menu');
    toggle.setAttribute('aria-controls', menu.id);
    toggle.setAttribute('aria-expanded', 'false');
    const setOpen = open => {
      menu.classList.toggle('is-active', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
      toggle.textContent = open ? '✕' : '☰';
      if (!open) closeGroups(menu);
    };
    toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-active')));
    nav.replaceChildren(brand, toggle, menu);
    nav.classList.add('tt-standard-nav');
    nav.addEventListener('click', event => {
      if (event.target.closest('.tt-nav-link')) setOpen(false);
    });
    nav.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeGroups(menu);
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', event => {
      if (!nav.contains(event.target)) {
        closeGroups(menu);
        if (menu.classList.contains('is-active')) setOpen(false);
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1100 && menu.classList.contains('is-active')) setOpen(false);
    });
  }

  // Homepage retains its original icon-led black-and-gold dropdown visual.
  // Links and nested destinations are still supplied by the shared catalogue.
  function decorateHomeMenu(menu) {
    if (!menu) return;
    const icons = {
      'Home': 'las la-home',
      'Services': 'las la-stream',
      'All services': 'las la-stream',
      'Cybersecurity': 'las la-shield-alt',
      'ISP & networking': 'las la-wifi',
      'Cloud Automation': 'las la-cloud',
      'SEO Cloud': 'las la-chart-line',
      'Web3': 'las la-cube',
      'Shop': 'las la-shopping-cart',
      'Explore': 'las la-compass',
      'About us': 'lar la-user',
      'Blogs': 'las la-newspaper',
      'Gallery': 'las la-images',
      'Awards': 'las la-trophy',
      'Podcasts': 'las la-microphone',
      'Events': 'las la-calendar',
      'Training': 'las la-graduation-cap',
      'Communities': 'las la-users',
      'Contact': 'las la-envelope',
      'Workspace': 'las la-arrow-right'
    };
    const buttons = menu.querySelectorAll('.tt-nav-item > a, .tt-nav-item > details > summary, .tt-nav-panel > a');
    buttons.forEach(node => {
      if (node.querySelector('i')) return;
      const iconName = icons[node.textContent.trim()];
      if (!iconName) return;
      const icon = document.createElement('i');
      icon.className = iconName;
      icon.setAttribute('aria-hidden', 'true');
      node.prepend(icon);
    });
  }

  function setupHome() {
    const desktop = document.querySelector('.top-menu');
    const mobile = document.querySelector('.top-mobile-menu');
    if (!desktop && !mobile) return;
    fillList(desktop);
    fillList(mobile);
    decorateHomeMenu(desktop);
    decorateHomeMenu(mobile);
    const header = document.querySelector('.top-navbar');
    if (header) {
      header.setAttribute('role', 'navigation');
      header.setAttribute('aria-label', 'Primary navigation');
    }
    document.addEventListener('click', event => {
      if (!event.target.closest('.top-navbar')) {
        if (desktop) closeGroups(desktop);
        if (mobile) closeGroups(mobile);
      }
    });
    [desktop, mobile].forEach(menu => menu && menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeGroups(menu);
    }));
  }

  function setupCybersecurity() {
    const links = document.getElementById('cyber-nav-links');
    if (!links) return;
    fillList(links);
    links.addEventListener('click', event => {
      if (!event.target.closest('a.tt-nav-link')) return;
      links.classList.remove('is-open');
      document.getElementById('cyber-nav-toggle')?.setAttribute('aria-expanded', 'false');
    });
  }

  function init() {
    document.querySelectorAll('.commerce-nav, .tt-site-nav').forEach(fillStandardNav);
    setupHome();
    setupCybersecurity();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
