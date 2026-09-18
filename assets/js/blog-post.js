(() => {
  const cfg = window.TEKNTANDAO_CONFIG || {};
  const root = document.querySelector('#post');
  const slug = new URLSearchParams(location.search).get('slug') || '';

  const escape = value => String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  async function loadAll() {
    const posts = [];
    try {
      const seed = await fetch('data/blogs.json', { cache: 'no-store' }).then(r => r.json());
      if (Array.isArray(seed)) posts.push(...seed);
    } catch {}
    const base = (cfg.functionsBaseUrl || '').replace(/\/$/, '');
    if (base) {
      try {
        const live = await fetch(`${base}/listBlogs`).then(r => r.json());
        if (Array.isArray(live.blogs)) posts.push(...live.blogs);
      } catch {}
    }
    const map = new Map();
    posts.forEach(post => { if (post?.slug) map.set(post.slug, post); });
    return map.get(slug) || null;
  }

  function render(post) {
    document.title = `${post.title} | TeknTandao`;
    const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const paragraphs = Array.isArray(post.body) ? post.body : String(post.body || '').split(/\n{2,}/);
    const img = post.cover ? `<img src="${escape(post.cover)}" alt="${escape(post.title)}">` : '';
    root.innerHTML = `${img}<span class="badge">${escape(post.category || 'Insight')} · ${escape(date)}</span><h1>${escape(post.title)}</h1>${paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}<p><a class="btn btn-primary" href="blog.html">All articles</a></p>`;
  }

  loadAll().then(post => {
    if (!post) {
      root.innerHTML = '<h1>Article not found</h1><p class="muted">That slug is not in the local library or the live feed.</p><p><a class="btn btn-primary" href="blog.html">Back to blogs</a></p>';
      return;
    }
    render(post);
  }).catch(error => {
    root.innerHTML = `<div class="status">${escape(error.message)}</div>`;
  });
})();
