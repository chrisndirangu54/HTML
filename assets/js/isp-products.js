/* Public equipment gallery shares the exact catalogue used by shop.html. */
const grid = document.getElementById('isp-products');
const status = document.getElementById('isp-products-status');
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isNetworkProduct = p => p.active !== false && (
  p.ispDirectory === true ||
  ['Networking', 'ISP Equipment', 'Starlink'].includes(p.category) ||
  /\b(router|switch|starlink|access point|extender|wireless bridge|gpon|ont|cpe|ethernet cable)\b/i.test(p.name || '')
);
const formatPrice = value => new Intl.NumberFormat('en-KE', {style:'currency', currency:'KES', maximumFractionDigits:0}).format(value);
const safeImage = value => {
  try {
    const url = new URL(value, location.href);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : 'assets/images/services/wifi.jpg';
  } catch { return 'assets/images/services/wifi.jpg'; }
};
async function renderEquipment() {
  try {
    const response = await fetch('data/products.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Equipment could not be loaded right now.');
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('Equipment list is unavailable.');
    const products = payload.filter(isNetworkProduct);
    if (!products.length) {
      grid.innerHTML = '<p>We are updating our networking products. <a href="shop.html">Visit the shop</a> or request a quotation.</p>';
      status.textContent = 'No network products are currently listed';
      return;
    }
    status.textContent = products.length + ' network products · availability on request';
    grid.innerHTML = products.map(p => {
      const href = 'shop.html?product=' + encodeURIComponent(p.id);
      const quote = p.quoteOnly === true || !Number.isFinite(Number(p.priceKes)) || Number(p.priceKes) <= 0;
      const price = quote ? 'Price on request' : 'Reference: ' + formatPrice(p.priceKes);
      return `<article class="isp-product">
        <a class="isp-product-picture" href="${href}" aria-label="View ${escapeText(p.name)} in shop"><img src="${escapeText(safeImage(p.imageUrl))}" alt="${escapeText(p.name)} product photograph" width="350" height="270" loading="lazy" referrerpolicy="no-referrer"></a>
        <div class="isp-product-content">
          <span class="isp-product-kind">${escapeText(p.category || 'Networking')}</span>
          <h3>${escapeText(p.name)}</h3>
          <p>${escapeText(p.description || 'Network equipment for suitable installations.')}</p>
          <div class="isp-product-state">${escapeText(price)}</div>
          <a class="isp-button primary" href="${href}">View in shop <i class="las la-arrow-right" aria-hidden="true"></i></a>
        </div>
      </article>`;
    }).join('');
    grid.querySelectorAll('img').forEach(img => {
      img.addEventListener('error', () => {
        if (img.dataset.fallback) return;
        img.dataset.fallback = 'true';
        img.src = 'assets/images/services/wifi.jpg';
      });
    });
  } catch (error) {
    status.textContent = 'Equipment list temporarily unavailable';
    grid.innerHTML = '<p>Unable to show products. <a href="shop.html">Browse the shop</a> or <a href="isp-customer.html">request assistance</a>.</p>';
    console.warn('ISP catalogue unavailable', error);
  }
}
renderEquipment();
