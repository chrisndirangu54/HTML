(() => {
  const cfg = window.TEKNTANDAO_CONFIG || {};
  const root = document.querySelector('#blog-grid');
  if (!root) return;

  const escape = value => String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  function card(post) {
    const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const img = post.cover ? `<img src="${escape(post.cover)}" alt="${escape(post.title)}" loading="lazy">` : '';
    return `<article class="blog-card">${img}<div><span class="badge">${escape(post.category || 'Insight')} · ${escape(date)}</span><h2>${escape(post.title)}</h2><p>${escape(post.excerpt)}</p><a class="btn btn-primary" href="blog-post.html?slug=${encodeURIComponent(post.slug)}">Read article</a></div></article>`;
  }

  async function loadSeed() {
    const response = await fetch('data/blogs.json', { cache: 'no-store' });
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function loadLive() {
    const base = (cfg.functionsBaseUrl || '').replace(/\/$/, '');
    if (!base) return [];
    try {
      const response = await fetch(`${base}/listBlogs`);
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload.blogs) ? payload.blogs : [];
    } catch {
      return [];
    }
  }

  function merge(seed, live) {
    const map = new Map();
    [...seed, ...live].forEach(post => {
      if (post && post.slug) map.set(post.slug, post);
    });
    return [...map.values()].sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  }

  async function start() {
    try {
      const [seed, live] = await Promise.all([loadSeed(), loadLive()]);
      const posts = merge(seed, live);
      root.innerHTML = posts.length ? posts.map(card).join('') : '<p>No published articles yet.</p>';
    } catch (error) {
      root.innerHTML = `<div class="status">${escape(error.message)}</div>`;
    }
  }

  start();
})();
