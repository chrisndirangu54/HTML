const pages = new Set(['blogs', 'isp', 'web3']);
function text(value, max) { return String(value || '').trim().slice(0, max); }
export function validateArticle(input) {
  const title = text(input.title, 200);
  const slug = text(input.slug, 120);
  if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('A title and lowercase hyphenated slug are required.');
  if (!['internal', 'external'].includes(input.postType)) throw new Error('Choose site article or external blog.');
  const selected = [...new Set(Array.isArray(input.pages) ? input.pages : [])];
  if (!selected.length || selected.some(page => !pages.has(page))) throw new Error('Select at least one valid page.');
  const externalUrl = text(input.externalUrl, 2000);
  if (input.postType === 'external') {
    let url;
    try { url = new URL(externalUrl); } catch { throw new Error('Enter a complete external blog URL.'); }
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('External blogs must use HTTP or HTTPS.');
  }
  const body = input.postType === 'external' ? '' : text(input.body, 100000);
  if (input.postType === 'internal' && !body) throw new Error('Site articles need article text.');
  const coverUrl = text(input.coverUrl, 2000);
  if (coverUrl && !/^https?:\/\//i.test(coverUrl) && !/^\/?assets\/[a-z0-9_./ -]+$/i.test(coverUrl)) throw new Error('Use an HTTP image URL or a local assets path.');
  return { title, slug, excerpt: text(input.excerpt, 2000), category: text(input.category, 80) || 'Insight', pages: selected, postType: input.postType, externalUrl: input.postType === 'external' ? externalUrl : '', body, coverUrl, visible: input.visible !== false };
}

export function createStrapiClient({ baseUrl, token, collection = 'articles', version = '5', fetchImpl = fetch }) {
  if (!/^https?:\/\//i.test(baseUrl || '') || !token) throw new Error('Configure STRAPI_BASE_URL and STRAPI_API_TOKEN on the server.');
  if (!/^[a-z0-9-]+$/i.test(collection) || !['4', '5'].includes(String(version))) throw new Error('Invalid Strapi collection or API version.');
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/${collection}`;
  async function request(suffix, options = {}) {
    const response = await fetchImpl(endpoint + suffix, {
      ...options, signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `Strapi request failed (${response.status}).`);
    return payload;
  }
  return {
    async list() {
      const articles = [];
      let page = 1, last = 1;
      do {
        const params = new URLSearchParams({ populate: '*', 'pagination[page]': page, 'pagination[pageSize]': 100, 'sort[0]': 'updatedAt:desc' });
        if (String(version) === '4') params.set('publicationState', 'preview');
        else params.set('status', 'draft');
        const payload = await request(`?${params}`);
        articles.push(...(payload.data || []));
        last = payload.meta?.pagination?.pageCount || 1;
        page++;
      } while (page <= last);
      return articles;
    },
    async save(input) {
      const data = validateArticle(input);
      const id = text(input.id, 120);
      if (id && !/^[a-z0-9]+$/i.test(id)) throw new Error('Invalid Strapi article identifier.');
      if (String(version) === '4') data.publishedAt = new Date().toISOString();
      const suffix = (id ? `/${id}` : '') + (String(version) === '5' ? '?status=published' : '');
      return request(suffix, { method: id ? 'PUT' : 'POST', body: JSON.stringify({ data }) });
    }
  };
}
