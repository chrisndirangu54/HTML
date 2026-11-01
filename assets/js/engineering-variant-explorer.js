/* Local mass–deflection variant explorer: compares seven bounded plate options. */
import {explorePlate} from './engineering-variant-core.mjs';
const form=document.getElementById('eng-cad-form'),quote=document.getElementById('fab-project-form');
const M=window.TeknEngineeringModels,host=document.getElementById('eng-preflight');
if(form&&quote&&M&&host){
 const box=document.createElement('section');box.className='eng-panel eng-intel-explore';box.id='eng-design-space';
 const title=document.createElement('h3');title.textContent='Design-space explorer · mass vs deflection';
 const intro=document.createElement('p');intro.textContent='Evaluate up to seven thickness candidates with the current load and illustrative material. This is a beam-model sensitivity study, not certified FEA or automated manufacturing approval.';
 const controls=document.createElement('div');controls.className='eng-intel-space-controls';
 const field=(id,label,value,min,max)=>{
  const wrap=document.createElement('label');wrap.textContent=label;
  const input=document.createElement('input');input.type='number';input.id=id;input.min=String(min);input.max=String(max);
  input.step='any';input.value=String(value);wrap.append(input);controls.append(wrap);return input;
 };
 const limit=field('eng-design-limit-deflection','Maximum nominal tip deflection (mm)',.5,.001,1000);
 const margin=field('eng-design-limit-margin','Minimum nominal yield margin',1.5,1,20);
 const run=document.createElement('button');run.type='button';run.className='tt-svc-button primary';run.id='eng-design-explore';run.textContent='Explore thicknesses';controls.append(run);
 const status=document.createElement('p');status.id='eng-design-explore-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='Choose a nonzero load to evaluate nominal stress margins.';
 const tableWrap=document.createElement('div');tableWrap.className='eng-intel-table-wrap';
 const table=document.createElement('table');table.id='eng-design-results';table.className='eng-intel-table';
 const head=document.createElement('thead'),headRow=document.createElement('tr');
 for(const label of ['Thickness','Mass','Tip deflection','Nominal yield margin','Screen','Action']){
  const th=document.createElement('th');th.scope='col';th.textContent=label;headRow.append(th);
 }
 head.append(headRow);const body=document.createElement('tbody');table.append(head,body);tableWrap.append(table);
 const disclaimer=document.createElement('p');disclaimer.className='eng-fine';disclaimer.textContent='No global optimum, finite-element analysis or engineering sign-off is produced. Clearance, load paths, actual material properties, print orientation and fatigue require human review.';
 box.append(title,intro,controls,status,tableWrap,disclaimer);host.append(box);
 run.addEventListener('click',()=>{
  body.replaceChildren();
  try{
   const geometry=Object.fromEntries(['length','width','thickness','hole','offset'].map(k=>[k,Number(form.elements.namedItem(k).value)]));
   const scenario={geometry,process:quote.elements.namedItem('process').value,
    material:quote.elements.namedItem('material').value,modelMaterial:document.getElementById('eng-sim-material').value,
    forceN:Number(document.getElementById('eng-sim-load-number').value)};
   const report=explorePlate(scenario,args=>M.plateSimulation(args),{maxDeflectionMm:Number(limit.value),minMargin:Number(margin.value)});
   for(const result of report.results){
    const row=document.createElement('tr');
    for(const value of [result.thicknessMm.toFixed(2)+' mm',result.massGrams.toFixed(2)+' g',
     result.nominalDeflectionMm.toFixed(3)+' mm',result.nominalMargin==null?'n/a':result.nominalMargin.toFixed(2)+'×',
     result.withinNominalFilters?'Within nominal filters':'Outside nominal filters']){
      const td=document.createElement('td');td.textContent=value;row.append(td);
    }
    const last=document.createElement('td'),apply=document.createElement('button');
    apply.type='button';apply.className='tt-svc-button';apply.textContent='Apply';
    apply.addEventListener('click',()=>{
     try{const proposal={...geometry,thickness:result.thicknessMm};M.mountingPlate(proposal);
      form.elements.namedItem('thickness').value=String(result.thicknessMm);
      form.dispatchEvent(new Event('input',{bubbles:true}));
      status.textContent='Applied '+result.thicknessMm+' mm to CAD, simulation and quotation draft. Human engineering review is still required.';
     }catch(e){status.textContent='Could not apply geometry: '+e.message;}
    });last.append(apply);row.append(last);body.append(row);
   }
   status.textContent=report.lightestScreened?
    'Lightest examined candidate meeting selected nominal filters: '+report.lightestScreened.thicknessMm+' mm. Not a certified design.':
    'No examined candidate meets both nominal targets, or no nonzero load is specified.';
  }catch(e){status.textContent='Cannot evaluate options: '+e.message;}
 });
}