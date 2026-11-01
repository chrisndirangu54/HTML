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

test('public editorial and service pages without pictures gain contextual CC0 imagery',()=>{
 for(const [page,art] of enriched){
   const html=read(page);
   assert.match(html,/assets\/css\/open-visuals\.css/,page);
   assert.ok(html.includes('assets/images/open-art/'+art+'.svg'),page+' lacks assigned illustration');
   assert.match(html,/<img[^>]+alt="[^"]+"/i,page+' image has no alternative');
 }
 const cloud=read('cloud-automation.html');
 assert.match(cloud,/id="microsoft-reseller"/);
 assert.match(cloud,/id="migrate"/);
 const media=read('media-cloud-dashboard.html');
 assert.match(media,/id="mc-export"/);
 assert.match(media,/id="mc-new-campaign"/);
 assert.match(read('login.html'),/id="auth-password"/);
 assert.match(read('newsletter.html'),/id="newsletter-subscribe"/);
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
 assert.match(read('engineering.html'),/assets\/images\/open-art\/nft-robot\.svg/);
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
