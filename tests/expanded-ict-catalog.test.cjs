const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const products=JSON.parse(read('data/products.json'));
const byId=id=>products.find(p=>p.id===id);

const newCategories={
  'Podcast Production':6,
  'Video & YouTube':6,
  'Robotics':7,
  'Drones':4,
  'Automation':3,
  'Smart Home':3,
  'Smart Cameras':3,
  'Smart Gates':4,
  'Gate Power & Safety':5
};
const legacyCount=20;
const newListings=products.filter(p=>p.imageKind==='illustration'||(p.imageKind==='model-photo'&&p.quoteOnly===true));
test('shop expansion covers all nine requested equipment departments',()=>{
  assert.equal(products.length,legacyCount+41);
  assert.equal(newListings.length,41);
  assert.equal(new Set(products.map(p=>p.id)).size,products.length);
  for(const [category,newCount] of Object.entries(newCategories)){
    const entries=newListings.filter(p=>p.category===category);
    assert.equal(entries.length,newCount,category);
    for(const item of entries){
      assert.equal(item.quoteOnly,true,item.id);
      assert.equal(item.priceKes,null,item.id);
      assert.equal(item.compareAtKes,null,item.id);
      assert.equal(item.stock,0,item.id);
      assert.equal(item.active,true,item.id);
      assert.ok(item.description.length>=20,item.id);
      assert.match(item.imageUrl,/^https:\/\//,item.id);
      assert.match(item.sourcePriceUrl,/^https:\/\//,item.id);
      assert.ok(item.imageCredit,item.id);
    }
  }
});
test('gate equipment includes safe commissioning and independent power supply options',()=>{
  const ids=['nice-robus-400-gate-motor','came-bx74-gate-operator','bft-deimos-ultra-bt-a600','gate-photocell-safety-beams','gate-backup-battery-24v','solar-gate-power-kit-24v','gate-emergency-release-accessory'];
  for(const id of ids)assert.ok(byId(id),id);
  assert.match(byId('solar-gate-power-kit-24v').description,/solar|panel/i);
  assert.match(byId('gate-photocell-safety-beams').description,/safety|obstruction/i);
  assert.match(read('shop.html'),/professional installation, safety testing and emergency release/);
});
test('all original category artworks are version-controlled and clearly labeled',()=>{
  const artwork=new Set(['podcast','video','robotics','drone','automation','camera','gate','power','home']);
  for(const key of artwork){
    const p='assets/images/shop/'+key+'.svg';
    const svg=read(p);
    assert.match(svg,/<svg/);
    assert.match(svg,/Illustrative equipment image/);
  }
  for(const product of newListings.filter(x=>x.imageKind==='illustration')){
    const expected=product.imageUrl.replace('https://tekntandao.com/','');
    assert.ok(fs.existsSync(path.join(root,expected)),product.id+' artwork is missing');
  }
  const code=read('assets/js/commerce.js');
  assert.match(code,/Illustrative image/);
  assert.match(code,/product\.imageKind === 'illustration'/);
  assert.match(code,/quoteOnly === true/);
  assert.match(code,/quoteById\.get\(product\.id\) \|\| product/);
});
test('shop category links and selected category UI are wired together',()=>{
  const html=read('shop.html');
  const code=read('assets/js/commerce.js');
  const css=read('assets/css/shop-expansion.css');
  assert.match(html,/class="tt-shop-dept-grid"/);
  assert.match(html,/assets\/css\/shop-expansion\.css/);
  for(const category of Object.keys(newCategories)){
    const url='shop.html?category='+encodeURIComponent(category);
    assert.ok(html.includes('href="'+url+'"'),'Missing department link '+category);
  }
  assert.match(code,/new URLSearchParams\(location\.search\)\.get\('category'\)/);
  assert.match(code,/select\.value = state\.category/);
  assert.match(code,/highlightDepartment\(\)/);
  assert.match(css,/@media\(max-width:550px\)/);
  assert.match(html,/id="tt-commerce-store"/);
});
test('Microsoft brand is present in partners with accurate reseller description, not false certification',()=>{
  const home=read('index.html'),styles=read('assets/css/style.css');
  assert.match(home,/class="partner-microsoft-link"/);
  assert.match(home,/Microsoft_logo\.svg/);
  assert.match(home,/Reseller solutions/);
  assert.match(home,/microsoft-products\.html/);
  assert.doesNotMatch(home,/Microsoft Gold Partner|Microsoft Solutions Partner|Microsoft-certified reseller/);
  assert.match(styles,/partner-microsoft-link/);
});
