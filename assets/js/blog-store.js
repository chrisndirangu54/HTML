(() => {
  const cfg = window.TEKNTANDAO_CONFIG || {};
  const base = String(cfg.strapiBaseUrl || '').replace(/\/$/, '');
  const collection = /^[a-z0-9-]+$/i.test(cfg.strapiArticleCollection || '') ? cfg.strapiArticleCollection : 'articles';
  const safeUrl = value => {
    if (!value) return '';
    try { const url = new URL(value, location.href); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; }
  };
  const text = node => typeof node === 'string' ? node : node?.text || (node?.children || []).map(text).join('');
  const paragraphs = value => Array.isArray(value) ? value.map(text).filter(Boolean) : String(value || '').split(/\n{2,}/).filter(Boolean);
  function normalize(row) {
    const a = row.attributes || row;
    const media = a.cover?.data?.attributes || a.cover?.data || a.cover;
    const category = typeof a.category === 'string' ? a.category : a.category?.data?.attributes?.name || a.category?.name || 'Insight';
    const pages = Array.isArray(a.pages) ? a.pages : [category.toLowerCase() === 'isp' ? 'isp' : category.toLowerCase() === 'web3' ? 'web3' : 'blogs'];
    let cover = a.coverUrl || (typeof media === 'string' ? media : media?.url) || '';
    if (cover && cover.startsWith('/') && base) cover = new URL(cover, base).href;
    return { ...a, id: row.documentId || row.id, slug: a.slug || '', title: a.title || '', excerpt: a.excerpt || a.description || '', category, pages, postType: a.postType === 'external' ? 'external' : 'internal', externalUrl: /^https?:\/\//i.test(a.externalUrl || '') ? safeUrl(a.externalUrl) : '', cover: cover ? safeUrl(cover) : '', body: paragraphs(a.body || a.content), visible: a.visible !== false };
  }
  async function request(params) {
    const response = await fetch(`${base}/api/${collection}?${params}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || 'Unable to load articles from Strapi.');
    return payload;
  }
  async function loadPublished() {
    if (!base) {
      const response = await fetch('data/blogs.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load articles.');
      return (await response.json()).map(normalize).filter(p => p.visible && p.published !== false);
    }
    const rows = [];
    let page = 1, last = 1;
    do {
      const params = new URLSearchParams({ populate: '*', 'sort[0]': 'publishedAt:desc', 'pagination[page]': page, 'pagination[pageSize]': 100 });
      if (String(cfg.strapiApiVersion || '5') === '4') params.set('publicationState', 'live');
      else params.set('status', 'published');
      const payload = await request(params);
      rows.push(...(payload.data || []));
      last = payload.meta?.pagination?.pageCount || 1;
      page++;
    } while (page <= last);
    return rows.map(normalize).filter(p => p.visible && p.publishedAt);
  }
  window.TTBlogs = { loadPublished, normalize, safeUrl };
})();
