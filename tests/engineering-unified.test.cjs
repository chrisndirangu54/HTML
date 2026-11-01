const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('engineering.html'),nav=read('assets/js/nav-responsive.js'),old=read('engineering-fabrication.html');
test('one Engineering menu entry and all tools on the unified page',()=>{
 assert.equal((nav.match(/label: 'Engineering & Prototyping', href: 'engineering.html'/g)||[]).length,1);
 assert.doesNotMatch(nav,/label: 'Engineering Fabrication'/);
 for(const id of ['eng-workspace','eng-calculators','eng-cad','eng-simulators','eng-ai','fab-account','fab-ai','fab-tripo','fab-design','fab-sculpt-workbench','fab-operator']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 }
 for(const js of ['engineering-studio.js','engineering-simulator.js','engineering-cad-viewer.js','engineering-workspace.js','engineering-fabrication.js','engineering-fabrication-config.js','commerce-config.js']){
  assert.ok(html.includes(js),js);
 }
 assert.match(html,/id="eng-send-fabrication" href="#fab-design"/);
});
test('shared CAD dimensions feed fabrication with no repeated input fields',()=>{
 const part=html.split('<div id="fab-parametric"')[1].split('<div id="fab-upload-area"')[0];
 for(const name of ['length','width','thickness','hole','offset'])assert.ok(part.includes('type="hidden" name="'+name+'"'));
 assert.doesNotMatch(part,/type="number"/);
 const bridge=read('assets/js/engineering-workspace.js');
 assert.match(bridge,/M\.mountingPlate\(d\)/);
 assert.match(bridge,/studio\.addEventListener\('input',sync\)/);
 assert.match(bridge,/quote\.dispatchEvent\(new Event\('input'/);
 assert.match(bridge,/eng:plate-from-fabrication/);
 assert.doesNotMatch(bridge,/fetch\(|httpsCallable|uploadBytes/);
 assert.match(read('assets/js/engineering-fabrication.js'),/eng:plate-from-fabrication/);
 assert.match(read('assets/js/engineering-studio.js'),/href='#fab-design'/);
});
test('old fabrication path preserves referral dimensions and section links',()=>{
 assert.match(old,/location\.replace\('engineering\.html'\+location\.search\+anchor\)/);
 assert.match(old,/fab-open-source/);
 assert.match(old,/rel="canonical" href="https:\/\/tekntandao\.com\/engineering\.html"/);
});
test('one open-source directory retains unique offerings',()=>{
 for(const name of ['OpenCascade / replicad','ToubkalCAD','MeshRight','OpenFOAM'])assert.ok(html.includes(name),name);
 assert.equal((html.match(/<h3>FreeCAD<\/h3>/g)||[]).length,1);
 assert.equal((html.match(/<h3>OpenSCAD<\/h3>/g)||[]).length,1);
});
