document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.commerce-nav').forEach((nav) => {
    if (nav.querySelector('.commerce-nav-toggle')) return;

    const brand = nav.querySelector('.brand');
    const links = Array.from(nav.children).filter((child) => child !== brand);

    const toggle = document.createElement('button');
    toggle.className = 'commerce-nav-toggle';
    toggle.setAttribute('aria-label', 'Toggle menu');
    toggle.innerHTML = '☰';

    const menuWrapper = document.createElement('div');
    menuWrapper.className = 'commerce-nav-menu';
    links.forEach((link) => menuWrapper.appendChild(link));

    toggle.addEventListener('click', () => {
      menuWrapper.classList.toggle('is-active');
      toggle.innerHTML = menuWrapper.classList.contains('is-active') ? '✕' : '☰';
    });

    nav.appendChild(toggle);
    nav.appendChild(menuWrapper);
  });
});
