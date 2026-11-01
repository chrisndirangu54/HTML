const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const artDir='assets/images/open-art/';
const original=['cloud','media','microsoft','seo','training','contact','blog','events','gallery','podcasts','awards','newsletter','commerce','lab','nft-robot','nft-planet','nft-dream'];
const enriched=[
 ['cloud-automation.html','cloud'],
 ['media-cloud.html','media'],
 ['microsoft-products.html','microsoft'],
 ['seo-cloud.html','seo'],
 ['training.html','training'],
 ['contact_page.html','contact'],
 ['blog.html','blog'],
 ['events.html','events'],
 ['gallery.html','gallery'],
 ['podcasts.html','podcasts'],
 ['awards.html','awards'],
 ['newsletter.html','newsletter'],
 ['shop.html','commerce'],
 ['blog-post.html','blog'],
 ['login.html','lab'],
 ['isp-customer.html','commerce'],
 ['media-cloud-dashboard.html','media']
];

test('CC0 Nouns source is self-hosted and contains real pixel art',()=>{
 const art=read(artDir+'nouns-sdk-sample.svg');
 assert.match(art,/viewBox="0 0 320 320"/);
 assert.match(art,/shape-rendering="crispEdges"/);
 assert.match(art,/fill="#d5d7e1"/);
 assert.ok((art.match(/<rect /g)||[]).length>80);
 assert.doesNotMatch(art,/<script|<foreignObject|onload=/i);
 const source=read(artDir+'LICENSE-AND-SOURCES.md');
 assert.match(source,/nounsDAO\/nouns-monorepo\/blob\/master\/packages\/nouns-sdk\/test\/lib\/data\/expected-noun.svg/);
 assert.match(source,/CC0/);
 assert.match(source,/not evidence of ownership/);
});

test('all original vector illustrations are unique, self-contained and openly licensed',()=>{
 const seen=new Set(),license=read(artDir+'LICENSE-AND-SOURCES.md');
 assert.match(license,/CC0 1\.0/);
 for(const name of original){
   const filename=artDir+name+'.svg';
   assert.ok(fs.existsSync(path.join(root,filename)),filename+' missing');
   const svg=read(filename);
   assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
   assert.match(svg,/<\/svg>$/);
   assert.match(svg,/viewBox="0 0 1024 650"/);
   assert.doesNotMatch(svg,/<script|<foreignObject|<image|onload=|<use /i);
   assert.ok(svg.length>1200,name+' image is too small');
   assert.equal(seen.has(svg),false,name+' duplicates another image');
   seen.add(svg);
 }
});

test('non-Web3 public pages use real credited photographs, never NFT-style artwork',()=>{
 const pages=[
  'cloud-automation.html','media-cloud.html','microsoft-products.html',
  'seo-cloud.html','training.html','contact_page.html','blog.html','events.html',
  'gallery.html','podcasts.html','awards.html','newsletter.html','shop.html',
  'blog-post.html','login.html','isp-customer.html','media-cloud-dashboard.html',
  'engineering.html'
 ];
 const manifest=read('docs/real-photo-sources.md');
 assert.match(manifest,/Unsplash License/);
 assert.match(manifest,/representative stock photographs/);
 for(const page of pages){
  const html=read(page);
  assert.match(html,/assets\/css\/real-photography\.css/,page+' missing neutral image style');
  assert.match(html,/https:\/\/images\.unsplash\.com\/photo-[\d]+-[a-z0-9]+/,page+' has no real image');
  assert.match(html,/<img[^>]*alt="[^"]+"/i,page+' has no meaningful alt');
  assert.match(html,/unsplash\.com\/photos\//,page+' lacks photographic source credit');
  assert.doesNotMatch(html,/assets\/css\/open-visuals\.css|assets\/images\/open-art\/|tt-os-|tt-os-vivid|open-nft-art/i,page+' still includes NFT artwork or styles');
 }
 assert.match(read('cloud-automation.html'),/id="microsoft-reseller"/);
 assert.match(read('cloud-automation.html'),/id="migrate"/);
 assert.match(read('media-cloud-dashboard.html'),/id="mc-export"/);
 assert.match(read('media-cloud-dashboard.html'),/id="mc-new-campaign"/);
 assert.match(read('login.html'),/id="auth-password"/);
 assert.match(read('newsletter.html'),/id="newsletter-subscribe"/);
 assert.match(read('engineering.html'),/id="eng-cad-viewport"/);
 assert.match(read('engineering.html'),/id="eng-calculators"/);
});

test('photographic sources are documented and no awards/events are misrepresented',()=>{
 const manifest=read('docs/real-photo-sources.md');
 assert.match(manifest,/not photographs of TeknTandao employees/);
 assert.match(manifest,/images\.unsplash\.com/);
 const awards=read('awards.html'),events=read('events.html'),podcast=read('podcasts.html');
 assert.match(awards,/not documentation of a TeknTandao award/);
 assert.match(events,/not documentation of a TeknTandao event/);
 assert.match(podcast,/not documentation of a TeknTandao recording/);
 const style=read('assets/css/real-photography.css');
 assert.match(style,/\.tt-photo-panel/);
 assert.match(style,/@media\(max-width:520px\)/);
 assert.doesNotMatch(style,/@keyframes|tt-os-nft|ovFrame|ovFloat|tt-os-vivid/);
});

test('Web3 NFT art gallery uses real CC0 Nouns sample and labels original non-minted concepts',()=>{
 for(const page of ['web3.html','web3-studio.html']){
   const html=read(page);
   assert.match(html,/id="open-nft-art"/);
   assert.match(html,/assets\/css\/open-visuals\.css/);
   for(const name of ['nouns-sdk-sample','nft-robot','nft-planet','nft-dream']){
     assert.ok(html.includes('assets/images/open-art/'+name+'.svg'),page+' missing '+name);
   }
   assert.match(html,/not tokens for sale, minting opportunities, proof of NFT ownership/);
   assert.match(html,/Nouns is not affiliated with or endorsing TeknTandao/);
   assert.match(html,/LICENSE-AND-SOURCES\.md/);
   assert.equal((html.match(/class="tt-os-nft-card"/g)||[]).length,4);
 }
 assert.doesNotMatch(read('engineering.html'),/nft-robot|tt-os-nft|assets\/images\/open-art\//i);
 assert.match(read('web3-studio.html'),/id="w3-explorer"/);
 assert.match(read('web3-studio.html'),/id="w3-security"/);
 assert.match(read('engineering.html'),/id="eng-calculators"/);
});

test('NFT-style CSS animation is colorful, responsible and progressively accessible',()=>{
 const css=read('assets/css/open-visuals.css');
 for(const color of ['#ff59c8','#8e65ff','#31ceff','#52f9c8','#ffe578']){
   assert.ok(css.includes(color),color);
 }
 for(const name of ['ovFrame','ovFloat','ovRotate','ovSweep','ovDrift','ovBreathe','ovHueShift'])
    assert.match(css,new RegExp('@keyframes '+name));
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/animation:none!important/);
 assert.match(css,/\.tt-os-nft-grid/);
 assert.match(css,/\.tt-os-nft-card:hover/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.doesNotMatch(css,/#cyber-nav-links|\.cyber-nav/);
});

test('no NFT mint, wallet signing or invented asset ownership is introduced',()=>{
 const content=read('web3.html')+read('web3-studio.html');
 assert.doesNotMatch(content,/window\.ethereum\.request\(|mintNFT\(|eth_sendTransaction|signTypedData/);
 assert.match(content,/Original CC0 concept/);
 assert.match(read(artDir+'LICENSE-AND-SOURCES.md'),/not evidence of ownership, purchase/);
});
