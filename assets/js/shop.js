import {collection,getDocs,query,where} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import {apiFetch,auth,config,db,firebaseReady,getSession,requireUser} from './auth-client.js';

const money=n=>new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:0}).format(n||0);
let products=[];let cart=JSON.parse(localStorage.getItem('tekntandao-cart')||'{}');
const $=s=>document.querySelector(s);

async function loadProducts(){
  try{
    if(!firebaseReady||!db)throw new Error('Firebase config missing');
    const snap=await getDocs(query(collection(db,'products'),where('active','==',true)));
    products=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(!products.length)throw new Error('No Firestore products');
    $('#shop-status').textContent='Live Firebase inventory.';
  }catch(e){
    const r=await fetch('data/products.seed.json');products=await r.json();
    $('#shop-status').textContent='Showing seeded catalogue. Add Firebase config to load live Firestore inventory.';
  }
  render();
}
function filtered(){const q=($('#search')?.value||'').toLowerCase();const c=$('#category')?.value||'All';return products.filter(p=>(c==='All'||p.category===c)&&(`${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q)))}
function render(){
  const selected=$('#category')?.value||'All';const cats=['All',...new Set(products.map(p=>p.category))];$('#category').innerHTML=cats.map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join('');
  $('#products').innerHTML=filtered().map(p=>`<article class="product-card"><img src="${p.image}" alt="${p.name}" loading="lazy"><div class="product-body"><span class="badge">${p.category}</span><h3>${p.name}</h3><p>${p.description||''}</p><div class="price">${money(p.priceKsh)}</div><button class="btn btn-primary" data-add="${p.id}">Add to cart</button></div></article>`).join('');
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>add(b.dataset.add));renderCart();
}
function add(id){cart[id]=(cart[id]||0)+1;persist()}
function persist(){localStorage.setItem('tekntandao-cart',JSON.stringify(cart));renderCart()}
function cartRows(){return Object.entries(cart).map(([id,qty])=>({product:products.find(p=>p.id===id),qty})).filter(x=>x.product)}
function renderCart(){const rows=cartRows();const count=rows.reduce((a,x)=>a+x.qty,0);$('#cart-count').textContent=count;$('#cart-lines').innerHTML=rows.map(({product:p,qty})=>`<div class="cart-line"><div><b>${p.name}</b><br><small>${money(p.priceKsh)} × ${qty}</small></div><div><button class="btn btn-ghost" data-dec="${p.id}">−</button> ${qty} <button class="btn btn-ghost" data-inc="${p.id}">+</button></div></div>`).join('')||'<p>Your cart is empty.</p>';$('#cart-total').textContent=money(rows.reduce((a,x)=>a+x.product.priceKsh*x.qty,0));document.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>add(b.dataset.inc));document.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{cart[b.dataset.dec]-=1;if(cart[b.dataset.dec]<=0)delete cart[b.dataset.dec];persist()})}
async function checkout(method){
  await requireUser('shop.html');const items=cartRows().map(x=>({productId:x.product.id,quantity:x.qty}));if(!items.length)return alert('Your cart is empty.');
  const phone=$('#phone').value.trim(),email=$('#email').value.trim(),name=$('#customer-name').value.trim(),address=$('#delivery-address').value.trim();if(!address)throw new Error('Enter a delivery address or collection instructions.');
  const endpoint=method==='mpesa'?'createMpesaCheckout':'createPaystackCheckout';$('#checkout-status').textContent='Creating secure checkout…';
  const data=await apiFetch(endpoint,{method:'POST',body:{items,phone,email,name,address,origin:location.origin}});
  if(data.authorizationUrl)location.href=data.authorizationUrl;else $('#checkout-status').textContent=data.message||'M-Pesa prompt sent. Complete payment on your phone.';
}
async function authNav(){
  const link=$('#auth-link');if(!link)return;if(!auth){link.textContent='Sign in';link.href='login.html?next=shop.html';return}
  onAuthStateChanged(auth,async user=>{if(!user){link.textContent='Sign in';link.href='login.html?next=shop.html';return}link.textContent='My account';link.href='account.html';try{const s=await getSession(true);if(s.role!=='customer')link.textContent=`${s.role[0].toUpperCase()+s.role.slice(1)} dashboard`}catch{}})
}
$('#search').addEventListener('input',render);$('#category').addEventListener('change',render);$('#cart-button').onclick=()=>$('#cart').toggleAttribute('hidden');$('#close-cart').onclick=()=>$('#cart').setAttribute('hidden','');$('#pay-mpesa').onclick=()=>checkout('mpesa').catch(e=>$('#checkout-status').textContent=e.message);$('#pay-paystack').onclick=()=>checkout('paystack').catch(e=>$('#checkout-status').textContent=e.message);$('#whatsapp').href=`https://wa.me/${config.whatsappNumber||'254702258870'}?text=${encodeURIComponent('Hi TeknTandao, I need help with an ICT product or installation.')}`;
authNav();loadProducts();
