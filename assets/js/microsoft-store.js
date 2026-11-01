/* Microsoft storefront: informational discovery only.
 * A buyer authorizes the actual quote and sales steps in Workspace.
 * No PII or payments are sent in URLs, and no vendor APIs are called here.
 */
(() => {
 'use strict';
 const form=document.getElementById('ms-buy-form');
 const choices=[...document.querySelectorAll('input[name="family"]')];
 const needs=[...document.querySelectorAll('input[name="need"]')];
 const seat=document.getElementById('ms-seat-count');
 const result=document.getElementById('ms-recommendation');
 const cta=document.getElementById('ms-continue');
 const allowed=['m365','azure','dynamics','power','security','windows365','server','education','marketplace'];
 const mapping={collaboration:'m365',email:'m365',cloud:'azure',crm:'dynamics',erp:'dynamics',analytics:'power',
  automation:'power',security:'security',devices:'windows365',education:'education',developer:'server'};
 const names={m365:'Microsoft 365 and Office 365',azure:'Microsoft Azure',dynamics:'Dynamics 365',power:'Power Platform',
  security:'Microsoft Security',windows365:'Windows 365',server:'Server & developer software',
  education:'Microsoft Education',marketplace:'Eligible Marketplace offers'};
 const escapeText=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const base='https://tekntandaoworkspace.web.app/';
 const preset=new URLSearchParams(location.search);
 const initial=preset.get('family');
 if(allowed.includes(initial)){const hit=choices.find(c=>c.value===initial);if(hit)hit.checked=true;}
 const validated=()=>{
   const count=Number(seat.value);
   const families=choices.filter(e=>e.checked).map(e=>e.value);
   const selected=needs.filter(e=>e.checked).map(e=>e.value);
   if(!Number.isSafeInteger(count)||count<1||count>100000||!families.length||!selected.length)
     return {error:'Choose at least one product, a business need, and a seat count between 1 and 100,000.'};
   return {count,families,selected};
 };
 const render=(event)=>{
   if(event)event.preventDefault();
   const values=validated();
   if(values.error){result.textContent=values.error;cta.href=base+'?module=microsoft-marketplace&seller=tekntandao';return;}
   const suggested=[...new Set(values.selected.map(n=>mapping[n]).filter(Boolean))];
   const direct=[...new Set([...values.families,...suggested])];
   const summary=['Your selected families:',...values.families.map(x=>'• '+names[x]),
     'Suggested areas based on your needs:',...suggested.map(x=>'• '+names[x]),
     'Indicative quantity: '+values.count+' seats',
     'Eligibility, SKU selection and prices are reviewed separately by your reseller.'];
   result.textContent=summary.join('\n');
   const params=new URLSearchParams({module:'microsoft-marketplace',seller:'tekntandao',seats:String(values.count),
    families:direct.join(','),needs:values.selected.join(',')});
   cta.href=base+'?'+params.toString();
 };
 form.addEventListener('submit',render);
 choices.forEach(x=>x.addEventListener('change',()=>{if(choices.some(x=>x.checked))render();}));
 needs.forEach(x=>x.addEventListener('change',()=>{if(needs.some(x=>x.checked))render();}));
 seat.addEventListener('input',()=>{if(choices.some(x=>x.checked))render();});
 if(choices.some(x=>x.checked))render();
})();
