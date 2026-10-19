(() => {

  const root = document.querySelector('#blog-grid');
  if (!root) return;

  const escape = value => String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  function card(post) {
    const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const img = post.cover ? `<img src="${escape(post.cover)}" alt="${escape(post.title)}" loading="lazy">` : '';
    const external = post.postType === 'external';
    const href = external ? window.TTBlogs.safeUrl(post.externalUrl) : `blog-post.html?slug=${encodeURIComponent(post.slug)}`;
    if (!href) return '';
    return `<article class="blog-card">${img}<div><span class="badge">${escape(post.category || 'Insight')}${date ? ` &middot; ${escape(date)}` : ''}</span><h2>${escape(post.title)}</h2><p>${escape(post.excerpt)}</p><a class="btn btn-primary" href="${escape(href)}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ''}>${external ? 'Read external blog' : 'Read article'}</a></div></article>`;
  }

  async function start() {
    try {
      const page = root.dataset.blogPage || 'blogs';
      const posts = (await window.TTBlogs.loadPublished()).filter(post => post.pages.includes(page));
      root.innerHTML = posts.length ? posts.map(card).join('') : '<p>No published articles yet.</p>';
    } catch (error) {
      root.innerHTML = `<div class="status">${escape(error.message)}</div>`;
    }
  }

  start();
})();
