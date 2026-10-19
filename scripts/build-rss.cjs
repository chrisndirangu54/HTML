const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = 'https://tekntandao.web.app';
const escape = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const posts = JSON.parse(fs.readFileSync(path.join(root, 'data/blogs.json'), 'utf8'))
  .filter(post => post.published !== false && post.visible !== false)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
const items = posts.map(post => {
  const link = post.postType === 'external' && /^https?:\/\//.test(post.externalUrl || '')
    ? post.externalUrl : `${origin}/blog-post.html?slug=${encodeURIComponent(post.slug)}`;
  const date = new Date(post.publishedAt);
  const publication = Number.isFinite(date.getTime()) ? `<pubDate>${date.toUTCString()}</pubDate>` : '';
  return `<item><title>${escape(post.title)}</title><link>${escape(link)}</link><guid isPermaLink="false">${escape(origin + '/blogs/' + post.slug)}</guid><description>${escape(post.excerpt)}</description><category>${escape(post.category)}</category>${publication}</item>`;
});
fs.writeFileSync(path.join(root, 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>TeknTandao Blogs</title><link>${origin}/blog.html</link><description>Latest TeknTandao insights and blogs</description><language>en</language><atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml"/>${items.join('\n')}</channel></rss>\n`);
console.log(`RSS generated with ${items.length} posts.`);
