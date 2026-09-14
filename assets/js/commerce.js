const config = window.TeknTandaoCommerceConfig || {};
const state = {
  products: [],
  cart: new Map(),
  category: 'All',
  query: '',
  firebase: null,
  functions: null,
  db: null
};

const money = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0
});

function formatKes(value) {
  return money.format(Number(value || 0)).replace('KES', 'KSh');
}

function safeText(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value), window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch (_) {
    return '#';
  }
}

function sectionMarkup(id, icon, kicker, title, lead, body) {
  return `
    <section class="tt-section page-section scroll-to-page" id="${safeText(id)}">
      <div class="custom-container">
        <div class="content-width">
          <div class="section-header">
            <div class="tt-kicker"><i class="${safeText(icon)}"></i> ${safeText(kicker)}</div>
            <h1>${title}</h1>
            <p class="tt-lead">${lead}</p>
          </div>
          ${body}
        </div>
      </div>
    </section>`;
}

function installSections() {
  if (document.getElementById('Shop')) return;
  const contact = document.getElementById('contact');
  if (!contact?.parentNode) return;

  const html = `
    ${sectionMarkup(
      'Shop', 'las la-shopping-cart', 'TeknTandao Shop',
      'Smart gadgets, connectivity and ICT equipment',
      'Shop practical networking, Starlink, CCTV, smart-home, power and computing equipment. Reference prices were checked against Kenyan online sellers; final TeknTandao availability and selling price may change.',
      `<div class="tt-shop-toolbar">
        <input id="tt-product-search" type="search" placeholder="Search routers, CCTV, Starlink, smart gadgets…" aria-label="Search products">
        <select id="tt-category-filter" aria-label="Filter product category"><option>All</option></select>
        <button class="tt-action" id="tt-cart-open" type="button"><i class="las la-shopping-bag"></i> Cart <span id="tt-cart-count">0</span></button>
      </div>
      <div class="tt-market-note"><i class="las la-info-circle"></i><span>Market-reference pricing is shown for transparency. Payment checkout uses the current Firestore product price and never trusts a browser-supplied total.</span></div>
      <div id="tt-product-grid" class="tt-product-grid"><div class="tt-empty">Loading catalogue…</div></div>`
    )}

    ${sectionMarkup(
      'blogs', 'las la-newspaper', 'Blog',
      'Insights from TeknTandao',
      'Articles are delivered from Strapi so the team can publish without editing this website.',
      `<div id="tt-blog-grid" class="tt-content-grid"><div class="tt-empty">Loading Strapi articles…</div></div>`
    )}

    ${sectionMarkup(
      'gallery', 'las la-images', 'Gallery',
      'Inside TeknTandao',
      'Highlights from our builds, community work, installations and technology programmes.',
      `<div class="tt-instagram-wrap">${instagramEmbed('https://www.instagram.com/p/DMX7tXoCWi2/')}</div>`
    )}

    ${sectionMarkup(
      'awards', 'las la-trophy', 'Awards',
      'Recognition & Awards',
      'We are preparing a verified showcase of awards, competition results and partner recognition.',
      comingSoon('las la-trophy', 'Awards showcase coming soon')
    )}

    ${sectionMarkup(
      'podcasts', 'las la-podcast', 'Podcasts',
      'TeknTandao Podcasts',
      'Conversations with builders, founders and practitioners across technology and business.',
      comingSoon('las la-microphone', 'Podcasts coming soon')
    )}

    ${sectionMarkup(
      'training', 'las la-chalkboard-teacher', 'Training',
      'Training & Workshops',
      'Hands-on learning, technology demonstrations and practical skills programmes.',
      `<div class="tt-instagram-wrap">${instagramEmbed('https://www.instagram.com/p/DLpor3UCHb2/')}</div>`
    )}

    ${sectionMarkup(
      'events', 'las la-calendar', 'Events',
      'Events & Community',
      'Meetups, showcases and collaborative technology events from the TeknTandao ecosystem.',
      `<div class="tt-instagram-wrap">${instagramEmbed('https://www.instagram.com/reel/DLsWD18CuJM/')}</div>`
    )}
  `;

  const holder = document.createElement('div');
  holder.innerHTML = html;
  while (holder.firstElementChild) contact.parentNode.insertBefore(holder.firstElementChild, contact);

  document.body.insertAdjacentHTML('beforeend', cartMarkup());
  bindUi();
  loadInstagramEmbeds();
}

function instagramEmbed(permalink) {
  const clean = permalink.endsWith('/') ? permalink : `${permalink}/`;
  return `<blockquote class="instagram-media" data-instgrm-captioned data-instgrm-permalink="${clean}" data-instgrm-version="14" style="background:#fff;border:0;border-radius:12px;box-shadow:0 0 1px rgba(0,0,0,.5),0 1px 10px rgba(0,0,0,.15);margin:1px;max-width:540px;min-width:280px;padding:0;width:100%;"><div style="padding:16px"><a href="${clean}" target="_blank" rel="noopener">View this post on Instagram</a></div></blockquote>`;
}

function comingSoon(icon, label) {
  return `<div class="tt-coming-soon"><i class="${safeText(icon)}"></i><h3>${safeText(label)}</h3><p>We will publish this section once the first release is ready.</p></div>`;
}

function cartMarkup() {
  return `
  <div class="tt-cart-drawer" id="tt-cart-drawer" aria-hidden="true">
    <div class="tt-overlay" data-close-cart></div>
    <aside class="tt-cart-panel" aria-label="Shopping cart">
      <div class="tt-panel-head"><h3>Your cart</h3><button class="tt-icon-button" type="button" data-close-cart aria-label="Close cart">&times;</button></div>
      <div id="tt-cart-items" class="tt-cart-items"></div>
      <div class="tt-cart-total"><span>Total</span><span id="tt-cart-total">KSh 0</span></div>
      <div class="tt-cart-footer">
        <button class="tt-action is-primary" id="tt-checkout-open" type="button"><i class="las la-credit-card"></i> Checkout</button>
        <button class="tt-action is-whatsapp" id="tt-whatsapp-order" type="button"><i class="lab la-whatsapp"></i> Order / Ask on WhatsApp</button>
      </div>
    </aside>
  </div>
  <div class="tt-checkout-modal" id="tt-checkout-modal" aria-hidden="true">
    <div class="tt-overlay" data-close-checkout></div>
    <div class="tt-checkout-box">
      <div class="tt-panel-head"><h3>Secure checkout</h3><button class="tt-icon-button" type="button" data-close-checkout aria-label="Close checkout">&times;</button></div>
      <form id="tt-checkout-form" class="tt-checkout">
        <label>Full name<input name="name" autocomplete="name" required></label>
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Phone (Safaricom for M-Pesa)<input name="phone" inputmode="tel" autocomplete="tel" placeholder="0702258870" required></label>
        <label>Payment method<select name="method" required><option value="mpesa">M-Pesa STK Push</option><option value="paystack">Paystack (card/mobile money)</option></select></label>
        <div id="tt-checkout-status" class="tt-status" role="status"></div>
        <div class="tt-checkout-actions">
          <button class="tt-action is-primary" type="submit"><i class="las la-lock"></i> Pay securely</button>
          <button class="tt-action is-whatsapp" id="tt-checkout-whatsapp" type="button"><i class="lab la-whatsapp"></i> WhatsApp instead</button>
        </div>
      </form>
    </div>
  </div>`;
}

async function bootFirebase() {
  const firebaseConfig = config.firebase || {};
  const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
  if (!configured || config.forceLocalCatalog) return false;
  try {
    const [appSdk, firestoreSdk, functionsSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js')
    ]);
    const app = appSdk.initializeApp(firebaseConfig);
    state.firebase = { appSdk, firestoreSdk, functionsSdk, app };
    state.db = firestoreSdk.getFirestore(app);
    state.functions = functionsSdk.getFunctions(app, config.functionsRegion || 'europe-west1');
    return true;
  } catch (error) {
    console.warn('TeknTandao Firebase commerce boot failed; using local catalogue.', error);
    return false;
  }
}

async function loadLocalProducts() {
  const response = await fetch('data/products.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
  return response.json();
}

async function loadProducts() {
  const local = await loadLocalProducts();
  state.products = local.filter(product => product.active !== false);
  if (state.db && state.firebase) {
    try {
      const { collection, getDocs, limit, query, where } = state.firebase.firestoreSdk;
      const snap = await getDocs(query(collection(state.db, 'products'), where('active', '==', true), limit(100)));
      if (!snap.empty) {
        state.products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    } catch (error) {
      console.warn('Firestore catalogue unavailable; using sourced local catalogue.', error);
    }
  }
  hydrateCategories();
  renderProducts();
}

function hydrateCategories() {
  const select = document.getElementById('tt-category-filter');
  if (!select) return;
  const categories = [...new Set(state.products.map(p => p.category).filter(Boolean))].sort();
  select.innerHTML = '<option value="All">All categories</option>' + categories.map(category => `<option value="${safeText(category)}">${safeText(category)}</option>`).join('');
}

function visibleProducts() {
  const q = state.query.trim().toLowerCase();
  return state.products.filter(product => {
    const matchesCategory = state.category === 'All' || product.category === state.category;
    const haystack = `${product.name} ${product.brand || ''} ${product.category || ''} ${product.description || ''}`.toLowerCase();
    return matchesCategory && (!q || haystack.includes(q));
  });
}

function renderProducts() {
  const grid = document.getElementById('tt-product-grid');
  if (!grid) return;
  const products = visibleProducts();
  if (!products.length) {
    grid.innerHTML = '<div class="tt-empty">No products match your search.</div>';
    return;
  }
  grid.innerHTML = products.map(product => {
    const img = safeHttpUrl(product.imageUrl);
    const source = safeHttpUrl(product.sourcePriceUrl);
    const compare = Number(product.compareAtKes || 0) > Number(product.priceKes || 0)
      ? `<span class="tt-compare">${formatKes(product.compareAtKes)}</span>` : '';
    return `<article class="tt-product-card">
      <div class="tt-product-media">
        <img src="${img}" alt="${safeText(product.name)}" loading="lazy" referrerpolicy="no-referrer">
        ${product.featured ? '<span class="tt-badge">Featured</span>' : ''}
      </div>
      <div class="tt-product-body">
        <span class="tt-product-brand">${safeText(product.brand || product.category)}</span>
        <h3 class="tt-product-title">${safeText(product.name)}</h3>
        <p class="tt-product-desc">${safeText(product.description)}</p>
        <div class="tt-price-row"><span class="tt-price">${formatKes(product.priceKes)}</span>${compare}<span class="tt-stock">${Number(product.stock || 0)} in stock</span></div>
        <div class="tt-product-actions">
          <button class="tt-action is-primary" type="button" data-add-product="${safeText(product.id)}"><i class="las la-cart-plus"></i> Add to cart</button>
          <button class="tt-action" type="button" data-whatsapp-product="${safeText(product.id)}"><i class="lab la-whatsapp"></i> Ask</button>
        </div>
        <div class="tt-source">Market reference: <a href="${source}" target="_blank" rel="noopener">${safeText(product.sourceLabel || 'online seller')}</a>. ${safeText(product.sourceNote || '')}<br>${safeText(product.imageCredit || '')}</div>
      </div>
    </article>`;
  }).join('');
}

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem('tekntandao-cart-v1') || '{}');
    Object.entries(parsed).forEach(([id, qty]) => {
      if (Number.isInteger(qty) && qty > 0) state.cart.set(id, qty);
    });
  } catch (_) {}
}

function saveCart() {
  localStorage.setItem('tekntandao-cart-v1', JSON.stringify(Object.fromEntries(state.cart)));
  renderCart();
}

function productById(id) { return state.products.find(product => product.id === id); }

function addToCart(id, amount = 1) {
  const product = productById(id);
  if (!product) return;
  const current = state.cart.get(id) || 0;
  const maximum = Math.max(1, Number(product.stock || 99));
  state.cart.set(id, Math.min(maximum, current + amount));
  saveCart();
}

function setQuantity(id, qty) {
  if (qty <= 0) state.cart.delete(id);
  else {
    const product = productById(id);
    const maximum = Math.max(1, Number(product?.stock || 99));
    state.cart.set(id, Math.min(maximum, qty));
  }
  saveCart();
}

function cartEntries() {
  return [...state.cart.entries()].map(([id, quantity]) => ({ product: productById(id), quantity })).filter(row => row.product);
}

function cartTotal() {
  return cartEntries().reduce((sum, row) => sum + Number(row.product.priceKes || 0) * row.quantity, 0);
}

function renderCart() {
  const rows = cartEntries();
  const target = document.getElementById('tt-cart-items');
  const count = document.getElementById('tt-cart-count');
  const total = document.getElementById('tt-cart-total');
  if (count) count.textContent = String(rows.reduce((sum, row) => sum + row.quantity, 0));
  if (total) total.textContent = formatKes(cartTotal());
  if (!target) return;
  target.innerHTML = rows.length ? rows.map(({ product, quantity }) => `<div class="tt-cart-item">
    <img src="${safeHttpUrl(product.imageUrl)}" alt="${safeText(product.name)}">
    <div><strong>${safeText(product.name)}</strong><small>${formatKes(product.priceKes)} each</small><div class="tt-qty"><button type="button" data-cart-dec="${safeText(product.id)}">−</button><span>${quantity}</span><button type="button" data-cart-inc="${safeText(product.id)}">+</button></div></div>
    <strong>${formatKes(Number(product.priceKes) * quantity)}</strong>
  </div>`).join('') : '<div class="tt-empty">Your cart is empty.</div>';
}

function whatsappMessage(product = null) {
  const lines = ['Hello TeknTandao, I am interested in the following ICT equipment:'];
  if (product) lines.push(`• ${product.name} — ${formatKes(product.priceKes)}`);
  else cartEntries().forEach(({ product: row, quantity }) => lines.push(`• ${row.name} × ${quantity} — ${formatKes(Number(row.priceKes) * quantity)}`));
  if (!product) lines.push(`Total shown: ${formatKes(cartTotal())}`);
  lines.push('', 'Please confirm current stock, final price and delivery/installation options.');
  return lines.join('\n');
}

function openWhatsApp(product = null) {
  const number = String(config.whatsappNumber || '254702258870').replace(/\D/g, '');
  const url = `https://wa.me/${number}?text=${encodeURIComponent(whatsappMessage(product))}`;
  window.open(url, '_blank', 'noopener');
}

function setCheckoutStatus(message, kind = '') {
  const element = document.getElementById('tt-checkout-status');
  if (!element) return;
  element.textContent = message;
  element.className = `tt-status is-visible${kind ? ` is-${kind}` : ''}`;
}

async function callFunction(name, payload) {
  if (!state.functions || !state.firebase) throw new Error('Online checkout is not configured yet. Please order via WhatsApp.');
  const fn = state.firebase.functionsSdk.httpsCallable(state.functions, name);
  const response = await fn(payload);
  return response.data;
}

async function pollOrder(orderId, statusToken, maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 4000));
    const result = await callFunction('getOrderStatus', { orderId, statusToken });
    if (result.status === 'paid') return result;
    if (['failed', 'cancelled'].includes(result.status)) throw new Error(`Payment ${result.status}.`);
    setCheckoutStatus(`Waiting for M-Pesa confirmation… (${attempt + 1}/${maxAttempts})`);
  }
  throw new Error('Payment confirmation is taking longer than expected. Keep the order reference and contact us on WhatsApp if you were charged.');
}

async function handleCheckout(event) {
  event.preventDefault();
  if (!cartEntries().length) return setCheckoutStatus('Your cart is empty.', 'error');
  const form = new FormData(event.currentTarget);
  const customer = {
    name: String(form.get('name') || '').trim(),
    email: String(form.get('email') || '').trim(),
    phone: String(form.get('phone') || '').trim()
  };
  const method = String(form.get('method') || 'mpesa');
  const items = cartEntries().map(({ product, quantity }) => ({ productId: product.id, quantity }));
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  setCheckoutStatus('Creating secure order…');
  try {
    if (method === 'paystack') {
      const result = await callFunction('createPaystackCheckout', {
        items,
        customer,
        callbackUrl: config.paystackCallbackUrl || `${location.origin}/#Shop`
      });
      if (!result.authorizationUrl) throw new Error('Paystack did not return a checkout URL.');
      setCheckoutStatus('Redirecting to Paystack…', 'success');
      location.href = result.authorizationUrl;
      return;
    }
    const result = await callFunction('createMpesaCheckout', { items, customer });
    setCheckoutStatus('M-Pesa prompt sent. Complete it on your phone.');
    await pollOrder(result.orderId, result.statusToken);
    state.cart.clear();
    saveCart();
    setCheckoutStatus(`Payment confirmed. Order ${result.orderId} is paid.`, 'success');
  } catch (error) {
    console.error(error);
    setCheckoutStatus(error.message || 'Checkout failed. Please try WhatsApp instead.', 'error');
  } finally {
    submit.disabled = false;
  }
}

function bindUi() {
  document.getElementById('tt-product-search')?.addEventListener('input', event => {
    state.query = event.target.value;
    renderProducts();
  });
  document.getElementById('tt-category-filter')?.addEventListener('change', event => {
    state.category = event.target.value;
    renderProducts();
  });
  document.getElementById('tt-cart-open')?.addEventListener('click', () => toggleCart(true));
  document.getElementById('tt-checkout-open')?.addEventListener('click', () => {
    if (!cartEntries().length) return;
    toggleCart(false);
    toggleCheckout(true);
  });
  document.getElementById('tt-whatsapp-order')?.addEventListener('click', () => openWhatsApp());
  document.getElementById('tt-checkout-whatsapp')?.addEventListener('click', () => openWhatsApp());
  document.getElementById('tt-checkout-form')?.addEventListener('submit', handleCheckout);
  document.addEventListener('click', event => {
    const add = event.target.closest('[data-add-product]');
    if (add) addToCart(add.dataset.addProduct);
    const ask = event.target.closest('[data-whatsapp-product]');
    if (ask) openWhatsApp(productById(ask.dataset.whatsappProduct));
    const inc = event.target.closest('[data-cart-inc]');
    if (inc) setQuantity(inc.dataset.cartInc, (state.cart.get(inc.dataset.cartInc) || 0) + 1);
    const dec = event.target.closest('[data-cart-dec]');
    if (dec) setQuantity(dec.dataset.cartDec, (state.cart.get(dec.dataset.cartDec) || 0) - 1);
    if (event.target.closest('[data-close-cart]')) toggleCart(false);
    if (event.target.closest('[data-close-checkout]')) toggleCheckout(false);
  });
}

function toggleCart(open) {
  const drawer = document.getElementById('tt-cart-drawer');
  drawer?.classList.toggle('is-open', open);
  drawer?.setAttribute('aria-hidden', String(!open));
}

function toggleCheckout(open) {
  const modal = document.getElementById('tt-checkout-modal');
  modal?.classList.toggle('is-open', open);
  modal?.setAttribute('aria-hidden', String(!open));
}

async function loadBlogs() {
  const grid = document.getElementById('tt-blog-grid');
  if (!grid) return;
  const base = String(config.strapiUrl || '').replace(/\/$/, '');
  if (!base) {
    grid.innerHTML = '<div class="tt-empty">Strapi is ready to connect. Set <code>strapiUrl</code> in <code>assets/js/commerce-config.js</code> to publish blog posts here.</div>';
    return;
  }
  try {
    const response = await fetch(`${base}/api/articles?populate=*&sort=publishedAt:desc&pagination[limit]=6`);
    if (!response.ok) throw new Error(`Strapi HTTP ${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload.data) ? payload.data : [];
    if (!rows.length) throw new Error('No published articles');
    grid.innerHTML = rows.map(row => {
      const article = row.attributes || row;
      const title = article.title || 'TeknTandao article';
      const excerpt = article.excerpt || article.description || '';
      const slug = article.slug || row.documentId || row.id;
      const published = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('en-KE', { dateStyle: 'medium' }) : '';
      const media = article.cover?.data?.attributes || article.cover?.data || article.cover || null;
      let image = media?.url || '';
      if (image && image.startsWith('/')) image = `${base}${image}`;
      const href = article.url || `${base}/blog/${slug}`;
      return `<article class="tt-content-card">${image ? `<img src="${safeHttpUrl(image)}" alt="${safeText(title)}" loading="lazy">` : ''}<div class="tt-content-meta">${safeText(published)}</div><h3>${safeText(title)}</h3><p>${safeText(excerpt)}</p><a class="tt-action" href="${safeHttpUrl(href)}" target="_blank" rel="noopener">Read article <i class="las la-arrow-right"></i></a></article>`;
    }).join('');
  } catch (error) {
    console.warn('Strapi blog failed', error);
    grid.innerHTML = '<div class="tt-empty">Blog service is temporarily unavailable. Please check back shortly.</div>';
  }
}

function loadInstagramEmbeds() {
  const process = () => window.instgrm?.Embeds?.process?.();
  const existing = document.querySelector('script[src*="instagram.com/embed.js"]');
  if (existing) return process();
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.instagram.com/embed.js';
  script.onload = process;
  document.body.appendChild(script);
}

async function init() {
  installSections();
  loadCart();
  renderCart();
  await bootFirebase();
  await Promise.allSettled([loadProducts(), loadBlogs()]);
}

init().catch(error => {
  console.error('TeknTandao commerce failed to initialize', error);
  const grid = document.getElementById('tt-product-grid');
  if (grid) grid.innerHTML = '<div class="tt-empty">The shop could not load. Please contact us on WhatsApp at 0702258870.</div>';
});
