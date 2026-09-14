import {apiFetch,getSession,requireUser,signOutCurrent} from './auth-client.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=n=>new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:0}).format(n||0);
const mode=document.body.dataset.dashboard;
let session=null,staff=[],products=[],orders=[];
const allStatuses=['pending','payment_init_failed','payment_failed','paid','processing','ready_for_delivery','out_for_delivery','delivered','cancelled'];
function setError(message=''){const box=$('#dashboard-error');box.innerHTML=message?`<p class="status danger">${esc(message)}</p>`:''}
function metric(label,value){return `<article class="metric-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`}
function orderItems(order){return (order.items||[]).map(x=>`${x.quantity}× ${esc(x.name)}`).join('<br>')}
function staffOptions(role,selected){return `<option value="">Unassigned</option>${staff.filter(u=>u.role===role||u.role==='admin').map(u=>`<option value="${esc(u.uid)}" ${u.uid===selected?'selected':''}>${esc(u.displayName||u.email||u.uid)}</option>`).join('')}`}
function statusActions(order){
  if(mode==='attendant'){
    if(order.status==='paid')return `<button class="btn btn-primary" data-status="processing" data-order="${esc(order.id)}">Start processing</button>`;
    if(order.status==='processing')return `<button class="btn btn-primary" data-status="ready_for_delivery" data-order="${esc(order.id)}">Mark ready</button>`;
    return '<span class="muted">Ready</span>';
  }
  if(mode==='delivery'){
    if(order.status==='ready_for_delivery')return `<button class="btn btn-primary" data-status="out_for_delivery" data-order="${esc(order.id)}">Start delivery</button>`;
    if(order.status==='out_for_delivery')return `<button class="btn btn-primary" data-status="delivered" data-order="${esc(order.id)}">Mark delivered</button>`;
    return `<span class="muted">${esc(order.status)}</span>`;
  }
  return `<div class="inline-controls"><select data-status-select="${esc(order.id)}">${allStatuses.map(s=>`<option value="${s}" ${s===order.status?'selected':''}>${s}</option>`).join('')}</select><button class="btn btn-ghost" data-admin-status="${esc(order.id)}">Update</button></div>`;
}
function renderOrders(){
  const target=$('#staff-orders');if(!target)return;
  if(!orders.length){target.innerHTML='<p>No orders in this queue.</p>';return}
  const adminCols=mode==='admin'?'<th>Assignments</th>':'';
  target.innerHTML=`<table class="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th>${adminCols}<th>Action</th></tr></thead><tbody>${orders.map(o=>`<tr><td><b>${esc(o.id)}</b><br><small>${esc((o.createdAt||'').slice(0,16).replace('T',' '))}</small></td><td>${esc(o.customer?.name||'')}<br><small>${esc(o.customer?.phone||'')}</small><br><small>${esc(o.customer?.address||'')}</small></td><td>${orderItems(o)}</td><td>${money(o.totalKsh)}</td><td><span class="status-pill">${esc(o.status)}</span></td>${mode==='admin'?`<td><select data-attendant="${esc(o.id)}">${staffOptions('attendant',o.assignedAttendantUid)}</select><select data-delivery="${esc(o.id)}">${staffOptions('delivery',o.assignedDeliveryUid)}</select><button class="btn btn-ghost" data-assign="${esc(o.id)}">Save assignment</button></td>`:''}<td>${statusActions(o)}</td></tr>`).join('')}</tbody></table>`;
}
function renderMetrics(){const box=$('#dashboard-metrics');if(!box)return;const counts={};orders.forEach(o=>counts[o.status]=(counts[o.status]||0)+1);box.innerHTML=[metric('Orders',orders.length),metric('Paid',counts.paid||0),metric('Processing',counts.processing||0),metric('Ready',counts.ready_for_delivery||0),metric('Out for delivery',counts.out_for_delivery||0),metric('Delivered',counts.delivered||0)].join('')}
function renderStaff(){const box=$('#staff-users');if(!box)return;box.innerHTML=`<table class="data-table"><thead><tr><th>User</th><th>Verified</th><th>Role</th><th>Action</th></tr></thead><tbody>${staff.map(u=>`<tr><td>${esc(u.displayName||'')}<br><small>${esc(u.email||u.uid)}</small></td><td>${u.emailVerified?'Yes':'No'}</td><td><select data-role-select="${esc(u.uid)}">${['customer','attendant','delivery','admin'].map(r=>`<option value="${r}" ${r===u.role?'selected':''}>${r}</option>`).join('')}</select></td><td><button class="btn btn-ghost" data-role-save="${esc(u.uid)}">Save role</button></td></tr>`).join('')}</tbody></table>`}
function renderProducts(){const box=$('#admin-products');if(!box)return;box.innerHTML=`<table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Active</th><th></th></tr></thead><tbody>${products.map(p=>`<tr><td>${esc(p.name)}<br><small>${esc(p.id)}</small></td><td>${esc(p.category)}</td><td>${money(p.priceKsh)}</td><td>${esc(p.stock)}</td><td>${p.active!==false?'Yes':'No'}</td><td><button class="btn btn-ghost" data-edit-product="${esc(p.id)}">Edit</button></td></tr>`).join('')}</tbody></table>`}
async function loadStaffOrders(){const data=await apiFetch('getStaffOrders');orders=data.orders||[];renderOrders();renderMetrics()}
async function loadAdmin(){const [orderData,staffData,productData]=await Promise.all([apiFetch('getStaffOrders'),apiFetch('adminListStaff'),apiFetch('adminListProducts')]);orders=orderData.orders||[];staff=staffData.users||[];products=productData.products||[];renderOrders();renderMetrics();renderStaff();renderProducts();$('#admin-panels').hidden=false}
async function load(){
  await requireUser(location.pathname.split('/').pop());session=await getSession(true);$('#dashboard-session').textContent=`${session.email} · ${session.role}`;
  if(mode==='admin'&&session.role!=='admin'){
    if(session.adminBootstrapAvailable){const button=$('#bootstrap-admin');button.hidden=false;button.onclick=async()=>{try{button.disabled=true;button.textContent='Activating…';await apiFetch('bootstrapAdmin',{method:'POST'});await (await requireUser()).getIdToken(true);location.reload()}catch(e){setError(e.message);button.disabled=false;button.textContent='Activate configured admin'}};setError('This verified email is configured to bootstrap administrator access.');return}
    throw new Error('Administrator access required.');
  }
  if(mode==='attendant'&&!['attendant','admin'].includes(session.role))throw new Error('Attendant access required.');
  if(mode==='delivery'&&!['delivery','admin'].includes(session.role))throw new Error('Delivery access required.');
  if(mode==='admin')await loadAdmin();else{await loadStaffOrders();$('#staff-panels').hidden=false}
}

document.addEventListener('click',async e=>{
  const statusBtn=e.target.closest('[data-status]');if(statusBtn){try{statusBtn.disabled=true;await apiFetch('updateOrderStatus',{method:'POST',body:{orderId:statusBtn.dataset.order,status:statusBtn.dataset.status}});await loadStaffOrders()}catch(err){setError(err.message)}return}
  const adminStatus=e.target.closest('[data-admin-status]');if(adminStatus){try{const orderId=adminStatus.dataset.adminStatus;const status=document.querySelector(`[data-status-select="${CSS.escape(orderId)}"]`).value;await apiFetch('updateOrderStatus',{method:'POST',body:{orderId,status}});await loadAdmin()}catch(err){setError(err.message)}return}
  const assign=e.target.closest('[data-assign]');if(assign){try{const orderId=assign.dataset.assign;const attendantUid=document.querySelector(`[data-attendant="${CSS.escape(orderId)}"]`).value;const deliveryUid=document.querySelector(`[data-delivery="${CSS.escape(orderId)}"]`).value;await apiFetch('adminAssignOrder',{method:'POST',body:{orderId,attendantUid,deliveryUid}});await loadAdmin()}catch(err){setError(err.message)}return}
  const role=e.target.closest('[data-role-save]');if(role){try{const uid=role.dataset.roleSave;const selected=document.querySelector(`[data-role-select="${CSS.escape(uid)}"]`).value;await apiFetch('adminSetStaffRole',{method:'POST',body:{uid,role:selected}});await loadAdmin()}catch(err){setError(err.message)}return}
  const edit=e.target.closest('[data-edit-product]');if(edit){const p=products.find(x=>x.id===edit.dataset.editProduct);if(!p)return;const f=$('#product-form');for(const key of ['id','name','category','priceKsh','stock','image','referenceUrl','marketReference','description'])if(f.elements[key])f.elements[key].value=p[key]??'';f.elements.active.checked=p.active!==false;f.scrollIntoView({behavior:'smooth'});}
});

$('#product-form')?.addEventListener('submit',async e=>{e.preventDefault();try{const f=new FormData(e.currentTarget);const product={id:f.get('id'),name:f.get('name'),category:f.get('category'),priceKsh:Number(f.get('priceKsh')),stock:Number(f.get('stock')),image:f.get('image'),referenceUrl:f.get('referenceUrl'),marketReference:f.get('marketReference'),description:f.get('description'),active:f.get('active')==='on'};await apiFetch('adminSaveProduct',{method:'POST',body:{product}});e.currentTarget.reset();e.currentTarget.elements.active.checked=true;await loadAdmin()}catch(err){setError(err.message)}});
$('#sign-out').onclick=signOutCurrent;
load().catch(e=>setError(e.message));
