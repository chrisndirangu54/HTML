const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const vm=require('node:vm');
const scope={};
vm.runInNewContext(read('assets/js/engineering-models.js'),{globalThis:scope});
const models=scope.TeknEngineeringModels;
assert.ok(models && typeof models.dcSeries==='function');
const approx=(actual,expected,tol=1e-9)=>assert.ok(Math.abs(actual-expected)<tol,actual+' differs from '+expected);

test('DC series circuit obeys Ohm law and power conservation',()=>{
 const r=models.dcSeries({volts:'12',r1:'220',r2:'330'});
 approx(r.resistanceOhm,550);
 approx(r.currentAmp,12/550);
 approx(r.r1DropVolt+r.r2DropVolt,12);
 approx(r.r1PowerWatt+r.r2PowerWatt,r.totalPowerWatt);
 assert.throws(()=>models.dcSeries({volts:12,r1:0,r2:10}));
 assert.throws(()=>models.dcSeries({volts:12,r1:Infinity,r2:10}));
});

test('battery runtime and solar yield use proper Wh units',()=>{
 const r=models.batteryEnergy({volts:12,ampHours:20,watts:15,usable:.8,efficiency:.85,solarWatts:100,sunHours:4});
 approx(r.nominalWh,240);
 approx(r.usableWh,163.2);
 approx(r.runtimeHours,10.88);
 approx(r.dailySolarWh,340);
 approx(r.dailyLoadWh,360);
 assert.throws(()=>models.batteryEnergy({volts:12,ampHours:20,watts:0,usable:.8,efficiency:.8,solarWatts:10,sunHours:4}));
 assert.throws(()=>models.batteryEnergy({volts:12,ampHours:20,watts:10,usable:1.2,efficiency:.8,solarWatts:10,sunHours:4}));
});

test('cantilever beam implements EI and root moment equations with SI conversions',()=>{
 const v={lengthMm:200,widthMm:20,heightMm:6,modulusGpa:69,force:10};
 const r=models.cantilever(v);
 const I=(.02*Math.pow(.006,3))/12;
 approx(r.momentInertiaM4,I,1e-18);
 approx(r.tipDeflectionMm,10*Math.pow(.2,3)/(3*69e9*I)*1000,1e-9);
 approx(r.rootStressMpa,6*10*.2/(.02*.006*.006)/1e6,1e-9);
 assert.equal(r.largeDeflectionWarning,false);
 assert.throws(()=>models.cantilever({...v,modulusGpa:0}));
});

test('differential-drive kinematics include straight travel and turning',()=>{
 const v={leftRpm:120,rightRpm:120,ratio:1,diameterMm:70,trackMm:180,efficiency:.9};
 const r=models.robotDrive(v);
 approx(r.forwardMps,Math.PI*.07*2*.9);
 approx(r.angularRadSec,0);
 assert.equal(r.turningRadiusM,null);
 const turn=models.robotDrive({...v,leftRpm:0});
 assert.ok(turn.angularRadSec>0);
 assert.ok(Number.isFinite(turn.turningRadiusM));
 assert.throws(()=>models.robotDrive({...v,trackMm:0}));
});

test('mounting plate produces editable OpenSCAD with four holes and valid dimensions',()=>{
 const r=models.mountingPlate({length:100,width:60,thickness:6,hole:5,offset:8});
 assert.match(r.scad,/length_mm = 100;/);
 assert.match(r.scad,/width_mm = 60;/);
 assert.match(r.scad,/thickness_mm = 6;/);
 assert.match(r.scad,/offset_mm = 8;/);
 assert.match(r.scad,/for \(x = \[offset_mm, length_mm-offset_mm\]\)/);
 assert.match(r.scad,/for \(y = \[offset_mm, width_mm-offset_mm\]\)/);
 assert.match(r.scad,/difference\(\)/);
 assert.equal(r.holes,4);
 assert.ok(r.volumeMm3>0);
 assert.throws(()=>models.mountingPlate({length:20,width:20,thickness:6,hole:5,offset:10}));
 assert.throws(()=>models.mountingPlate({length:100,width:60,thickness:6,hole:5,offset:2}));
});

test('design advisor generates domain-specific, rule-based safety and simulation checklists',()=>{
 const base={name:'Bench robot',goal:'Drive a robot with sensors',domain:'robotics',stage:'prototype',power:'battery',environment:'indoor',constraints:'Phone as screen'};
 const r=models.designBrief(base);
 assert.equal(r.domain,'robotics');
 assert.ok(r.tools.includes('Webots'));
 assert.ok(r.risks.some(v=>/stop controls/.test(v)));
 assert.equal(r.estimatedBudget,null);
 assert.equal(r.approvedForManufacture,false);
 assert.equal(r.partsOrderPlaced,false);
 const industrial=models.designBrief({...base,domain:'automation',power:'mains',environment:'industrial'});
 assert.ok(industrial.risks.some(v=>/Mains-voltage/.test(v)));
 assert.ok(industrial.risks.some(v=>/environmental/.test(v)));
 assert.throws(()=>models.designBrief({...base,domain:'secrets'}));
 assert.throws(()=>models.designBrief({...base,goal:''}));
});

test('engineering page offers functional local workflows and clearly distinguished open-source tools',()=>{
 const html=read('engineering.html');
 const js=read('assets/js/engineering-studio.js');
 const css=read('assets/css/engineering-studio.css');
 for(const f of ['assets/css/home-theme-bridge.css','assets/css/service-home-ux.css',
   'assets/css/engineering-studio.css','assets/js/engineering-models.js','assets/js/engineering-studio.js']){
  assert.ok(html.includes(f),f);
 }
 for(const id of ['eng-brief-form','eng-export-brief','eng-calc-result','eng-cad-form','eng-download-scad',
   'eng-circuit-form','eng-battery-form','eng-beam-form','eng-robot-form','eng-load-circuit',
   'eng-circuit-embed','eng-load-ai','eng-ask-ai','eng-ai-output','eng-ai-status']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 for(const tool of ['https://www.falstad.com/circuit/','https://www.kicad.org/discover/spice/',
    'https://github.com/SimulIDE/SimulIDE','https://cyberbotics.com/',
    'https://gazebosim.org/','https://www.freecad.org/','https://openscad.org/',
    'https://openmodelica.org/','https://jupyter.org/try']){
  assert.ok(html.includes(tool),tool);
 }
 assert.match(html,/<strong>not<\/strong> listed as open-source simulator software/);
 assert.match(html,/model download may be large/);
 assert.match(html,/not signed engineering drawings/);
 assert.match(js,/frame\.src='https:\/\/www\.falstad\.com\/circuit\/'/);
 assert.match(js,/confirm\('Load an external open-source WebLLM package/);
 assert.match(js,/engine\.chat\.completions\.create/);
 assert.match(js,/No device control or manufacturing operations/);
 assert.match(css,/@media\(max-width:530px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('navigation, services, shop, and enquiry form include engineering studio',()=>{
 const home=read('index.html'),nav=read('assets/js/nav-responsive.js'),
       shop=read('shop.html'),contact=read('contact_page.html');
 assert.match(home,/Engineering &amp; Prototyping/);
 assert.match(home,/href="engineering\.html"/);
 assert.match(nav,/label: 'Engineering & Prototyping', href: 'engineering\.html'/);
 assert.match(shop,/href="engineering\.html"/);
 assert.match(contact,/<option value="engineering">Engineering & prototyping<\/option>/);
 assert.match(read('engineering.html'),/contact_page\.html\?subject=engineering/);
});

test('browser-only AI does not expose API credentials or claim live backend inference',()=>{
 const js=read('assets/js/engineering-studio.js');
 assert.match(js,/webllm\.CreateMLCEngine/);
 assert.match(js,/const response=await engine\.chat\.completions\.create/);
 assert.doesNotMatch(js,/GEMINI_API_KEY|OPENAI_API_KEY|firebaseSecret|eval\(/);
 assert.doesNotMatch(js,/\/api\/ai|function\('.*gemini|https:\/\/generativelanguage\.googleapis\.com/);
 assert.match(read('engineering.html'),/Optional on-device AI engineering copilot/);
});
