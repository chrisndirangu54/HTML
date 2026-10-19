(() => {
  const root = document.querySelector('#post');
  const slug = new URLSearchParams(location.search).get('slug') || '';

  const escape = value => String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  async function loadAll() {
    return (await window.TTBlogs.loadPublished()).find(post => post.slug === slug) || null;
  }

  function render(post) {
    document.title = `${post.title} | TeknTandao`;
    const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const paragraphs = Array.isArray(post.body) ? post.body : String(post.body || '').split(/\n{2,}/);
    const img = post.cover ? `<img src="${escape(post.cover)}" alt="${escape(post.title)}">` : '';
    const references = (Array.isArray(post.sources) ? post.sources : []).filter(source => {
      try { return ['https:', 'http:'].includes(new URL(source.url).protocol); } catch { return false; }
    });
    const sources = references.length ? `<section class="post-sources"><h2>Sources and further reading</h2><ul>${references.map(source => `<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title)}</a></li>`).join('')}</ul></section>` : '';
    const back = post.category === 'ISP' ? 'isp.html' : post.category === 'Web3' ? 'web3.html' : 'blog.html';
    const backLabel = post.category === 'ISP' ? 'Back to ISP' : post.category === 'Web3' ? 'Back to Web3' : 'All articles';
    root.innerHTML = `${img}<span class="badge">${escape(post.category || 'Insight')}${date ? ` &middot; ${escape(date)}` : ''}</span><h1>${escape(post.title)}</h1>${paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}<p>${escape(post.category === "ISP" || post.category === "Web3" ? "TeknTandao explainer. Explore the original sources below." : "")}</p>${sources}<p><a class="btn btn-primary" href="${back}">${backLabel}</a></p>`;
  }

  loadAll().then(post => {
    if (!post) {
      root.innerHTML = '<h1>Article not found</h1><p class="muted">That slug is not in the local library or the live feed.</p><p><a class="btn btn-primary" href="blog.html">Back to blogs</a></p>';
      return;
    }
    if (post.postType === 'external') {
      const href = window.TTBlogs.safeUrl(post.externalUrl);
      root.innerHTML = href ? `<h1>${escape(post.title)}</h1><p>This article is published on an external website.</p><p><a class="btn btn-primary" href="${escape(href)}" target="_blank" rel="noopener noreferrer">Read external blog</a></p>` : '<h1>Article unavailable</h1>';
      return;
    }
    render(post);
  }).catch(error => {
    root.innerHTML = `<div class="status">${escape(error.message)}</div>`;
  });
})();
