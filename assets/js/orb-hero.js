(() => {
  'use strict';

  const HOME_SELECTOR = '#home';
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
  const CONFIG_URL = 'assets/js/site-config.js';
  const CSS_URL = 'assets/css/orb-hero.css';
  const money = n => new Intl.NumberFormat('en-KE', {style:'currency',currency:'KES',maximumFractionDigits:0}).format(Number(n)||0);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const safeUrl = value => { try { const u = new URL(String(value || ''), location.href); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch (_) { return ''; } };

  function loadCss(href) {
    if ([...document.styleSheets].some(s => s.href && s.href.includes(href))) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const absolute = new URL(src, location.href).href;
      const existing = [...document.scripts].find(s => s.src === absolute);
      if (existing) {
        if (src.includes('three') && window.THREE) return resolve();
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', resolve, {once:true});
        existing.addEventListener('error', reject, {once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = src; script.async = true;
      script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function buildMarkup(home) {
    if (document.getElementById('tt-orb-assistant')) return document.getElementById('tt-orb-assistant');
    const root = document.createElement('div');
    root.id = 'tt-orb-assistant';
    root.className = 'tt-orb-assistant';
    root.innerHTML = `
      <div class="tt-orb-stage" id="tt-orb-stage" role="button" tabindex="0" aria-label="TeknTandao AI assistant. Click for a product recommendation.">
        <div class="tt-orb-fallback" aria-hidden="true"></div>
        <canvas class="tt-orb-canvas" id="tt-orb-canvas" aria-hidden="true"></canvas>
        <div class="tt-orb-aura" aria-hidden="true"></div>
        <div class="tt-orb-pulse" aria-hidden="true"></div>
        <div class="tt-orb-face" aria-hidden="true">
          <span class="tt-orb-eye"></span><span class="tt-orb-eye"></span>
        </div>
        <span class="tt-orb-hint">AI • click me</span>
        <button class="tt-orb-shop-core" id="tt-orb-shop-core" type="button" aria-label="Open TeknTandao Shop"><i class="las la-shopping-bag"></i></button>
      </div>
      <aside class="tt-orb-bubble" id="tt-orb-bubble" aria-live="polite">
        <div class="tt-orb-kicker">TeknTandao AI</div>
        <p class="tt-orb-copy" id="tt-orb-copy">Hi. Move your mouse and I’ll follow. Tap me and I’ll suggest something useful from the ICT shop.</p>
        <div id="tt-orb-product-slot"></div>
        <div class="tt-orb-actions">
          <a class="primary" id="tt-orb-shop-link" href="shop.html">Open shop</a>
          <button id="tt-orb-next" type="button">Another pick</button>
          <a href="https://wa.me/254702258870?text=Hi%20TeknTandao%2C%20I%20need%20help%20choosing%20ICT%20equipment." target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </aside>`;
    home.appendChild(root);
    return root;
  }

  async function ensureConfig() {
    if (window.TEKNTANDAO_CONFIG) return window.TEKNTANDAO_CONFIG;
    try { await loadScript(CONFIG_URL); } catch (_) {}
    return window.TEKNTANDAO_CONFIG || {};
  }

  async function liveProducts() {
    const cfg = await ensureConfig();
    if (!cfg.firebase?.projectId) throw new Error('Firebase not configured');
    const [{initializeApp,getApps,getApp},{getFirestore,collection,getDocs,query,where,limit}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js')
    ]);
    const app = getApps().length ? getApp() : initializeApp(cfg.firebase);
    const db = getFirestore(app);
    const snap = await getDocs(query(collection(db,'products'), where('active','==',true), limit(24)));
    const rows = snap.docs.map(d => ({id:d.id,...d.data()}));
    if (!rows.length) throw new Error('No live products');
    return rows;
  }

  async function fallbackProducts() {
    const response = await fetch('data/products.seed.json', {cache:'no-cache'});
    if (!response.ok) throw new Error('Seed catalogue unavailable');
    return response.json();
  }

  function rankRecommendations(products) {
    return [...products]
      .filter(p => p && p.active !== false && (!Number.isFinite(Number(p.stock)) || Number(p.stock) > 0))
      .sort((a,b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Number(b.stock||0) - Number(a.stock||0))
      .slice(0, 8);
  }

  async function getRecommendations() {
    try { return rankRecommendations(await liveProducts()); }
    catch (_) { try { return rankRecommendations(await fallbackProducts()); } catch (_) { return []; } }
  }

  function initThree(canvas, root, stage) {
    if (!window.THREE) return null;
    const THREE = window.THREE;
    const mobile = matchMedia('(max-width: 640px)').matches;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34,1,.1,100);
    camera.position.set(0,0,6.2);
    const rig = new THREE.Group(); scene.add(rig);
    const orb = new THREE.Group(); rig.add(orb);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.46, mobile ? 36 : 56, mobile ? 24 : 40),
      new THREE.MeshPhysicalMaterial({color:0xf3f7fa,metalness:.72,roughness:.16,clearcoat:1,clearcoatRoughness:.06,emissive:0x061b25,emissiveIntensity:.16})
    );
    orb.add(sphere);

    const glass = new THREE.Mesh(
      new THREE.SphereGeometry(1.505, mobile ? 30 : 48, mobile ? 20 : 34),
      new THREE.MeshPhysicalMaterial({color:0xcafaff,transparent:true,opacity:.08,metalness:.2,roughness:.08,transmission:.3,depthWrite:false})
    );
    orb.add(glass);

    const cyanMat = new THREE.MeshStandardMaterial({color:0xc7fbff,metalness:1,roughness:.16,emissive:0x00c9ff,emissiveIntensity:1.1});
    const violetMat = new THREE.MeshStandardMaterial({color:0xb8b4ca,metalness:1,roughness:.18,emissive:0x7a22ff,emissiveIntensity:.5});
    const darkMat = new THREE.MeshStandardMaterial({color:0x26313b,metalness:1,roughness:.2,emissive:0x07111c,emissiveIntensity:.25});
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.88,.055,14,90), cyanMat); ringA.rotation.x = Math.PI*.38; orb.add(ringA);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.76,.035,12,80), violetMat); ringB.rotation.y = Math.PI*.5; ringB.rotation.z = Math.PI*.14; orb.add(ringB);
    const ringC = new THREE.Mesh(new THREE.TorusGeometry(1.61,.024,10,70), darkMat); ringC.rotation.x = Math.PI*.72; ringC.rotation.y = Math.PI*.22; orb.add(ringC);

    const shardGeo = new THREE.BoxGeometry(.12,.5,.075);
    const shards = [];
    for (let i=0;i<12;i++) {
      const shard = new THREE.Mesh(shardGeo, i%3===0 ? cyanMat : i%2 ? darkMat : violetMat);
      const a = (i/12)*Math.PI*2;
      const radius = 1.94 + (i%2)*.13;
      shard.position.set(Math.cos(a)*radius, Math.sin(a*1.7)*.46, Math.sin(a)*.52);
      shard.lookAt(0,0,0); shard.rotation.z += i*.21; orb.add(shard); shards.push(shard);
    }

    scene.add(new THREE.HemisphereLight(0xffffff,0x091225,1.7));
    const cyan = new THREE.PointLight(0x4feaff,18,20,2); cyan.position.set(3.1,2.6,4.2); scene.add(cyan);
    const violet = new THREE.PointLight(0xa74fff,13,18,2); violet.position.set(-3.3,-1.5,3.4); scene.add(violet);
    const white = new THREE.PointLight(0xffffff,8,16,2); white.position.set(0,2,-2.8); scene.add(white);

    let mx=0,my=0,cx=0,cy=0,burst=0,visible=true;
    const clock = new THREE.Clock();
    const eyes = root.querySelectorAll('.tt-orb-eye');

    const pointer = e => {
      mx=(e.clientX/innerWidth)*2-1; my=(e.clientY/innerHeight)*2-1;
      root.style.setProperty('--orb-mouse-x-px',`${(mx*10).toFixed(1)}px`);
      root.style.setProperty('--orb-mouse-y-px',`${(my*8).toFixed(1)}px`);
      eyes.forEach(el=>{
        el.style.setProperty('--eye-x-px',`${(mx*4).toFixed(1)}px`);
        el.style.setProperty('--eye-y-px',`${(my*2.7).toFixed(1)}px`);
      });
    };
    window.addEventListener('pointermove',pointer,{passive:true});

    const resize = () => { const r=canvas.getBoundingClientRect(); if(!r.width||!r.height)return; renderer.setSize(r.width,r.height,false); camera.aspect=r.width/r.height; camera.updateProjectionMatrix(); };
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize',resize,{passive:true});
    resize();

    const hero = document.querySelector(HOME_SELECTOR);
    const updateScroll = () => {
      if (!hero || reduced || innerWidth <= 1180) { root.style.setProperty('--orb-scroll-x','0px'); return; }
      const r=hero.getBoundingClientRect(), vh=innerHeight||1;
      const progress=Math.max(0,Math.min(1,(vh-r.top)/(vh+r.height)));
      const travel=Math.min(innerWidth*.24,270);
      root.style.setProperty('--orb-scroll-x',`${((progress-.5)*travel).toFixed(1)}px`);
      rig.rotation.y = (progress-.5)*.9;
    };
    window.addEventListener('scroll',updateScroll,{passive:true}); updateScroll();
    document.addEventListener('visibilitychange',()=>{visible=!document.hidden;});

    function react(){ burst=1; root.classList.remove('is-reacting'); void root.offsetWidth; root.classList.add('is-reacting'); setTimeout(()=>root.classList.remove('is-reacting'),780); }

    function frame(){ requestAnimationFrame(frame); if(!visible)return; const t=clock.getElapsedTime(); cx+=(mx-cx)*.045;cy+=(my-cy)*.045; rig.position.y=reduced?0:Math.sin(t*1.22)*.11; orb.rotation.x=-cy*.12+Math.sin(t*.6)*.025; orb.rotation.y+=reduced?0:.0025; orb.rotation.z=cx*.065; const pulse=.7+Math.sin(t*2.5)*.24+burst*.8; cyan.intensity=15+pulse*8; violet.intensity=11+pulse*5; cyanMat.emissiveIntensity=.8+pulse*.7; ringA.rotation.z += reduced?0:.003+burst*.016; ringB.rotation.x += reduced?0:.002+burst*.011; ringC.rotation.y -= reduced?0:.0018+burst*.007; shards.forEach((s,i)=>{s.rotation.z+=reduced?0:(.0012+(i%3)*.0004);}); if(burst>.002){orb.scale.setScalar(1+burst*.065);burst*=.9}else{orb.scale.lerp(new THREE.Vector3(1,1,1),.12);burst=0} renderer.render(scene,camera); }
    frame();
    return {react};
  }

  async function start() {
    const home = document.querySelector(HOME_SELECTOR); if (!home) return;
    loadCss(CSS_URL);
    const root = buildMarkup(home), stage = root.querySelector('#tt-orb-stage'), bubble = root.querySelector('#tt-orb-bubble'), copy = root.querySelector('#tt-orb-copy'), slot = root.querySelector('#tt-orb-product-slot'), shopLink = root.querySelector('#tt-orb-shop-link');
    let recommendations = [], index = -1, three = null;

    const renderRecommendation = () => {
      if (!recommendations.length) { slot.innerHTML=''; copy.textContent='I can take you straight to the TeknTandao ICT shop. Live recommendations will appear here as soon as the catalogue is available.'; shopLink.href='shop.html'; return; }
      index=(index+1)%recommendations.length; const p=recommendations[index]; const img=safeUrl(p.image||p.imageUrl); const productHref=`shop.html?product=${encodeURIComponent(p.id||'')}`; copy.textContent='Here’s one useful pick from the live TeknTandao catalogue:';
      slot.innerHTML=`<a class="tt-orb-product" href="${esc(productHref)}"><img src="${esc(img||'assets/images/tekntandao-favicon.png')}" alt="" loading="lazy"><span><b>${esc(p.name||'ICT product')}</b><span>${esc(money(p.priceKsh))}</span></span></a>`;
      shopLink.href=productHref;
    };

    const interact = () => { bubble.classList.add('is-open'); three?.react(); renderRecommendation(); };
    stage.addEventListener('click', e => { if(e.target.closest('#tt-orb-shop-core'))return; interact(); });
    stage.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();interact();} });
    root.querySelector('#tt-orb-next').addEventListener('click',()=>{three?.react();renderRecommendation();});
    root.querySelector('#tt-orb-shop-core').addEventListener('click',e=>{e.stopPropagation();three?.react();setTimeout(()=>{location.href='shop.html';},180);});

    recommendations = await getRecommendations();
    try { await loadScript(THREE_URL); three = initThree(root.querySelector('#tt-orb-canvas'),root,stage); root.querySelector('.tt-orb-fallback')?.remove(); }
    catch (_) { root.classList.add('tt-orb-no-webgl'); }

    setTimeout(()=>{ if(!bubble.classList.contains('is-open')) bubble.classList.add('is-open'); },2400);
  }

  function lazyStart() {
    const home=document.querySelector(HOME_SELECTOR); if(!home)return;
    if(!('IntersectionObserver' in window)){start();return;}
    const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){io.disconnect();start();}},{rootMargin:'300px'}); io.observe(home);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',lazyStart,{once:true}); else lazyStart();
})();
