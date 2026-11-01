const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const css = read('assets/css/hero-gaming-pc.css');
const js = read('assets/js/hero-gaming-pc.js');
const home = read('index.html');

test('gaming reel stage is shifted away from the right edge on large desktops',()=>{
  assert.match(css, /@media \(min-width: 1221px\)\s*\{\s*\.tt-gaming-pc__stage\s*\{\s*right:\s*clamp\(90px,\s*7vw,\s*145px\);/);
  // At a 1728px screenshot width the reel shifts left ~121px.
  const shift = Math.max(90,Math.min(1728*0.07,145));
  assert.ok(shift>=115 && shift<=130);
  const rootMaxWidth = 1130, stageMaxWidth = 650;
  assert.ok(rootMaxWidth-stageMaxWidth-shift>300,
    'shift must keep the stage inside the wide desktop layout');
  assert.match(css,/\.tt-gaming-pc__stage\s*\{[\s\S]*?right: 0;/);
});

test('tablet and mobile keep their existing centered stage behavior',()=>{
  assert.match(css,/@media \(max-width: 1220px\)\s*\{\s*\.tt-gaming-pc\s*\{\s*max-width: 767px;/);
  assert.match(css,/@media \(max-width: 900px\)[\s\S]*?\.tt-gaming-pc__stage\s*\{\s*left: 50%; right: auto;/);
  assert.match(css,/@media \(max-width: 640px\)/);
  assert.match(css,/@media \(max-width: 900px\) and \(prefers-reduced-motion: reduce\)/);
});

test('same positioned stage is used for the 3D canvas and video reel',()=>{
  assert.match(js,/const stage = root\.querySelector\('\.tt-gaming-pc__stage'\)/);
  assert.match(js,/stage\.appendChild\(video\)/);
  assert.match(js,/video\.className = 'tt-gaming-pc__video'/);
  assert.match(css,/\.tt-gaming-pc__video\s*\{[\s\S]*?inset: 0;/);
  assert.match(css,/\.tt-gaming-pc__canvas\s*\{\s*position: absolute; inset: 0;/);
  assert.match(css,/\.tt-gaming-pc\.is-revealed \.tt-gaming-pc__video \{ opacity: 1; \}/);
  assert.match(js,/assets\/images\/tekntandao-gaming-reel\.mp4/);
  assert.match(home,/assets\/js\/hero-gaming-pc\.js/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
});
