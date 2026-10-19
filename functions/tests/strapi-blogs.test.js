import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStrapiClient, validateArticle } from '../strapi-blogs.js';

const article = { title: 'A network guide', slug: 'network-guide', postType: 'external', pages: ['isp', 'blogs'], externalUrl: 'https://publisher.example/post', visible: true };
test('external links reject executable and relative URLs', () => {
  for (const externalUrl of ['javascript:alert(1)', 'data:text/html,x', '/post']) assert.throws(() => validateArticle({ ...article, externalUrl }));
  assert.equal(validateArticle(article).body, '');
  assert.throws(() => validateArticle({ ...article, pages: ['admin'] }));
  assert.throws(() => validateArticle({ ...article, pages: [] }));
  assert.throws(() => validateArticle({ ...article, postType: 'internal' }));
});
test('Strapi 5 updates use document IDs and publish status; visibility persists', async () => {
  let received;
  const cms = createStrapiClient({ baseUrl: 'https://cms.example', token: 'server-only-token', fetchImpl: async (url, options) => {
    received = { url, options }; return { ok: true, json: async () => ({ data: { documentId: 'abc123' } }) };
  } });
  await cms.save({ ...article, id: 'abc123', visible: false });
  assert.equal(received.url, 'https://cms.example/api/articles/abc123?status=published');
  assert.equal(received.options.method, 'PUT');
  assert.equal(received.options.headers.Authorization, 'Bearer server-only-token');
  assert.equal(JSON.parse(received.options.body).data.visible, false);
  await assert.rejects(cms.save({ ...article, id: '../users' }));
});
test('Strapi 4 creates use publishedAt and list traverses every page', async () => {
  const requests = [];
  const cms = createStrapiClient({ baseUrl: 'https://cms.example', token: 'token', version: '4', fetchImpl: async (url, options) => {
    requests.push({ url, options });
    const page = new URL(url).searchParams.get('pagination[page]');
    return { ok: true, json: async () => ({ data: page ? [{ id: Number(page) }] : {}, meta: { pagination: { pageCount: 2 } } }) };
  } });
  await cms.save(article);
  assert.equal(requests[0].options.method, 'POST');
  assert.ok(JSON.parse(requests[0].options.body).data.publishedAt);
  assert.equal((await cms.list()).length, 2);
  assert.equal(new URL(requests[1].url).searchParams.get('publicationState'), 'preview');
});
test('Strapi validation errors reach the editor without claiming success', async () => {
  const cms = createStrapiClient({ baseUrl: 'https://cms.example', token: 'token', fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Unknown field pages' } }) }) });
  await assert.rejects(cms.save(article), /Unknown field pages/);
});
