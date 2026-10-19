import { apiFetch } from './auth-client.js';

const cmsBase = window.TEKNTANDAO_CONFIG?.strapiBaseUrl;
const cmsLink = document.querySelector('#open-strapi-admin');
if (cmsBase && cmsLink) { cmsLink.href = `${cmsBase.replace(/\/$/, '')}/admin`; cmsLink.hidden = false; }

const form = document.querySelector('#blog-form');
const status = document.querySelector('#blog-admin-status');
const table = document.querySelector('#admin-blogs');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let articles = [], editing = false;
function typeFields() {
  const external = form.elements.postType.value === 'external';
  document.querySelector('#blog-external-field').hidden = !external;
  document.querySelector('#blog-body-field').hidden = external;
  form.elements.externalUrl.required = external;
  form.elements.body.required = !external;
}
function newArticle() {
  form.reset(); form.elements.id.value = ''; editing = false;
  status.textContent = ''; typeFields();
}
async function load() {
  status.textContent = 'Loading Strapi articles...';
  try {
    const response = await apiFetch('adminListBlogs');
    articles = (response.articles || []).map(window.TTBlogs.normalize);
    table.innerHTML = articles.length ? `<table class="data-table"><thead><tr><th>Title</th><th>Type</th><th>Pages</th><th>Visible</th><th>Action</th></tr></thead><tbody>${articles.map(a => `<tr><td>${esc(a.title)}<br><small>${esc(a.slug)}</small></td><td>${a.postType === 'external' ? 'External blog' : 'Site article'}</td><td>${esc(a.pages.join(', '))}</td><td>${a.visible ? 'Yes' : 'No'}</td><td><button type="button" class="btn btn-ghost" data-edit-blog="${esc(a.id)}">Edit</button></td></tr>`).join('')}</tbody></table>` : '<p>No articles in Strapi yet. Add a blog using the form above.</p>';
    status.textContent = `${articles.length} articles loaded from Strapi.`;
  } catch (error) { status.textContent = error.message; }
}
form.elements.postType.addEventListener('change', typeFields);
form.elements.title.addEventListener('input', () => {
  if (!editing && !form.elements.slug.dataset.manual) form.elements.slug.value = form.elements.title.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
});
form.elements.slug.addEventListener('input', () => { form.elements.slug.dataset.manual = 'true'; });
document.querySelector('#new-blog').addEventListener('click', () => { delete form.elements.slug.dataset.manual; newArticle(); });
document.querySelector('#refresh-admin-blogs').addEventListener('click', load);
document.querySelector('#import-starter-blogs').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  let imported = 0;
  try {
    const response = await fetch('data/blogs.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load starter blogs.');
    const seed = await response.json();
    const current = await apiFetch('adminListBlogs');
    const existing = new Set((current.articles || []).map(window.TTBlogs.normalize).map(a => a.slug));
    for (const raw of seed) {
      const post = window.TTBlogs.normalize(raw);
      if (existing.has(post.slug)) continue;
      const article = { title: post.title, slug: post.slug, category: post.category, excerpt: post.excerpt, pages: post.pages, postType: post.postType, externalUrl: post.externalUrl, body: post.body.join('\n\n'), coverUrl: raw.cover || '', visible: true };
      await apiFetch('adminSaveBlog', { method: 'POST', body: { article } });
      existing.add(post.slug); imported++;
    }
    await load(); status.textContent = `${imported} starter blogs imported into Strapi. Existing slugs were preserved.`;
  } catch (error) { await load(); status.textContent = `${imported} imported. ${error.message}`; }
  finally { button.disabled = false; }
});
table.addEventListener('click', event => {
  const button = event.target.closest('[data-edit-blog]');
  if (!button) return;
  const article = articles.find(a => String(a.id) === button.dataset.editBlog);
  if (!article) return;
  for (const key of ['id', 'title', 'slug', 'category', 'excerpt', 'postType', 'externalUrl']) form.elements[key].value = article[key] || '';
  form.elements.coverUrl.value = article.coverUrl || '';
  form.elements.body.value = article.body.join('\n\n');
  form.elements.visible.checked = article.visible;
  form.querySelectorAll('[name="pages"]').forEach(input => { input.checked = article.pages.includes(input.value); });
  editing = true; typeFields(); form.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(form);
  const selected = data.getAll('pages');
  if (!selected.length) { status.textContent = 'Select at least one page.'; return; }
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const article = Object.fromEntries(data);
    article.pages = selected; article.visible = data.get('visible') === 'on';
    await apiFetch('adminSaveBlog', { method: 'POST', body: { article } });
    delete form.elements.slug.dataset.manual;
    newArticle(); await load(); status.textContent = 'Blog saved to Strapi.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
typeFields();
// The existing dashboard reveals this panel only after administrator access is verified.
const panels = document.querySelector('#admin-panels');
if (!panels.hidden) load();
else {
  const observer = new MutationObserver(() => { if (!panels.hidden) { observer.disconnect(); load(); } });
  observer.observe(panels, { attributes: true, attributeFilter: ['hidden'] });
}
