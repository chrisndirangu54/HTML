const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('engineering.html'),js=read('assets/js/engineering-dashboard.js'),css=read('assets/css/engineering-dashboard.css');
test('one responsive engineering dashboard includes every tool and overview',()=>{
 for(const id of ['eng-dashboard','eng-dash-panels','eng-dashboard-overview','eng-dash-credit-count','eng-dash-project-count','eng-dash-account-state','eng-dash-plate-size'])assert.ok(html.includes('id="'+id+'"'),id);
 for(const view of ['overview','analysis','cad','ai','sculpt','fabrication','projects'])assert.match(html,new RegExp('data-eng-view="'+view+'"'));
 assert.match(html,/assets\/css\/engineering-dashboard\.css/);
 assert.match(html,/assets\/js\/engineering-dashboard\.js/);
});
test('original engineering controls are relocated into dashboard panels and never cloned',()=>{
 for(const id of ['eng-workspace','eng-calculators','eng-simulators','eng-cad','eng-ai','fab-ai','fab-tripo','fab-design','fab-account','fab-operator'])assert.ok(js.includes("'"+id+"'"),id);
 assert.match(js,/sculpt\.append\(previewCard\)/);
 assert.match(js,/historyPanel\.append\(jobs,refresh\)/);
 assert.match(js,/panels\[name\]\.append\(section\)/);
 assert.match(js,/panel\.hidden=key!==name/);
 assert.match(js,/window\.addEventListener\('hashchange'/);
 assert.match(js,/window\.dispatchEvent\(new Event\('resize'\)\)/);
});
test('live dashboard summary observes authenticated credit and project UI',()=>{
 for(const source of ["$('fab-balance')","$('fab-jobs')","$('fab-user')","$('fab-plate-reference')"])assert.ok(js.includes(source),source);
 assert.match(js,/MutationObserver\(syncSummary\)/);
 assert.match(js,/querySelectorAll\('\.eng-fab-job'\)/);
 assert.doesNotMatch(js,/httpsCallable|fetch\(|localStorage|fakeCredit/);
});
test('free mesh imports and direct Tripo sculpt editing retain explicit upload distinction',()=>{
 assert.match(js,/file\.size>15\*1024\*1024/);
 assert.match(js,/original\.files=fileInput\.files/);
 assert.match(js,/original\.dispatchEvent\(new Event\('change'/);
 assert.match(js,/fab:edited-stl-ready/);
 assert.match(read('assets/js/engineering-tripo.js'),/eng:open-view/);
 assert.match(css,/\.eng-dash-sidebar/);
 assert.match(css,/@media\(max-width:750px\)/);
 assert.match(css,/\[hidden\]\{display:none!important\}/);
});