import {loadCatalogue,escapeProductText as esc,productImage} from './product-store.js';
const grid=document.getElementById('isp-products');
const status=document.getElementById('isp-products-status');
const money=value=>new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:0}).format(value);
try{
  const {products,source}=await loadCatalogue();
  const equipment=products.filter(product=>/network|router|switch|starlink|\bont\b|\bolt\b|\bcpe\b|fiber|fibre|wireless|mikrotik|comfast/i.test(`${product.category||''} ${product.name||''}`));
  status.textContent=source==='live'?'Equipment from the live shop inventory.':'Live inventory is unavailable. Showing the shop’s sample catalogue; confirm pricing and availability.';
  grid.innerHTML=equipment.map(product=>`<article class="spec"><img src="${esc(productImage(product.image))}" alt="${esc(product.name)}" loading="lazy" width="320" height="200" style="width:100%;height:200px;object-fit:contain"><span class="status">${esc(product.category)}</span><h3>${esc(product.name)}</h3><div class="price">${Number.isFinite(Number(product.priceKsh))?money(Number(product.priceKsh)):'Request a quote'}</div><p>${esc(product.description)}</p><a class="btn" href="shop.html?product=${encodeURIComponent(product.id)}">View in shop</a></article>`).join('')||'<p>No networking equipment is currently listed. <a href="shop.html">Browse the shop</a> or contact us for a quote.</p>';
  grid.querySelectorAll('img').forEach(image=>image.addEventListener('error',()=>{image.src='assets/images/services/wifi.jpg'},{once:true}));
}catch(error){status.textContent=error.message;grid.replaceChildren();}
