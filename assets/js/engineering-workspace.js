/* Unified CAD: shared dimensions, local only; fabrication submission remains explicit. */
(()=>{'use strict';
const studio=document.getElementById('eng-cad-form'),quote=document.getElementById('fab-project-form');
const link=document.getElementById('eng-send-fabrication'),label=document.getElementById('fab-plate-reference'),M=window.TeknEngineeringModels;
if(!studio||!quote||!link||!label||!M)return;
const keys=['length','width','thickness','hole','offset'];
const dims=()=>Object.fromEntries(keys.map(k=>[k,Number(studio.elements.namedItem(k).value)]));
const sync=()=>{
 const d=dims();
 try{
  M.mountingPlate(d);
  for(const k of keys)quote.elements.namedItem(k).value=String(d[k]);
  label.textContent=d.length+' × '+d.width+' × '+d.thickness+' mm; four '+d.hole+' mm holes; '+d.offset+' mm edge offset.';
  link.removeAttribute('aria-disabled');
  quote.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
 }catch(err){label.textContent='Invalid plate dimensions: '+err.message;link.setAttribute('aria-disabled','true');return false;}
};
studio.addEventListener('input',sync);
document.addEventListener('eng:plate-from-fabrication',event=>{
 const d=event.detail?.dimensions;if(!d)return;
 try{M.mountingPlate(d);for(const k of keys)studio.elements.namedItem(k).value=String(d[k]);
 studio.dispatchEvent(new Event('input',{bubbles:true}));}
 catch(_){label.textContent='AI or referral plate dimensions need correction in the CAD editor.';}
});
link.addEventListener('click',event=>{
 if(!sync()){event.preventDefault();studio.scrollIntoView({behavior:'smooth',block:'start'});return;}
 const choice=quote.querySelector('input[name="kind"][value="generated"]');choice.checked=true;choice.dispatchEvent(new Event('change',{bubbles:true}));
});
sync();
})();
