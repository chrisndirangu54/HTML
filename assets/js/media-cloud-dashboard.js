/* Media Cloud local operator dashboard. No external API connections or publication. */
(() => {
  'use strict';
  const KEY = 'tt-media-cloud-local-v1';
  const empty = () => ({version:1,campaigns:[],drafts:[],creators:[],reports:[]});
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const dateText = text => /^\d{4}-\d{2}-\d{2}$/.test(String(text)) ? String(text) : 'Not specified';
  const integer = text => Number.isSafeInteger(Number(text)) && Number(text)>=0 && Number(text)<=1e9 ? Number(text) : null;
  const uuid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()+'-'+Math.random().toString(36).slice(2);
  const validList = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object').slice(0,500) : [];
  let data = empty();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY)||'null');
    if (saved && saved.version===1) {
      data = {version:1,campaigns:validList(saved.campaigns),drafts:validList(saved.drafts),
        creators:validList(saved.creators),reports:validList(saved.reports)};
    }
  } catch (error) { console.warn('Media Cloud local state unavailable:', error); }
  const persist = () => {
    try { localStorage.setItem(KEY,JSON.stringify(data)); return true; }
    catch (error) { notify('Local browser storage is unavailable. Export your work to keep a copy.'); return false; }
  };
  const notify = message => {
    const target = byId('mc-alert');
    target.textContent = message;
  };
  const campaignName = id => data.campaigns.find(item=>item.id===id)?.name||'Campaign deleted';
  const emptyMsg = text => '<p class="mc-empty">'+esc(text)+'</p>';
  const note = value => String(value||'').slice(0,500);
  const safeName = value => String(value||'').trim().slice(0,100);
  const btn = (action,id,label,kind='') => '<button type="button" class="'+esc(kind)+'" data-action="'+esc(action)+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';
  const render = () => {
    byId('mc-total-campaigns').textContent = data.campaigns.length;
    byId('mc-total-drafts').textContent = data.drafts.length;
    byId('mc-ready-drafts').textContent = data.drafts.filter(item=>item.status==='Ready for review').length;
    byId('mc-total-creators').textContent = data.creators.length;
    const campRows = data.campaigns.slice(-4).reverse().map(c => '<div class="mc-list-item"><div><strong>'+esc(c.name)+'</strong><small>'+esc(c.goal)+' · '+dateText(c.start)+' to '+dateText(c.end)+'</small></div><span class="mc-status">'+esc(c.status)+'</span></div>');
    byId('mc-overview-campaigns').innerHTML = campRows.join('')||emptyMsg('Create your first campaign to get started.');
    const draftRows = data.drafts.slice(-4).reverse().map(d=>'<div class="mc-list-item"><div><strong>'+esc(d.title)+'</strong><small>'+esc(d.platform)+' · '+dateText(d.targetDate)+'</small></div><span class="mc-status">'+esc(d.status)+'</span></div>');
    byId('mc-overview-drafts').innerHTML = draftRows.join('')||emptyMsg('No content drafts yet.');
    byId('mc-campaign-list').innerHTML = data.campaigns.slice().reverse().map(c=>`<article class="mc-campaign-card">
      <span class="mc-status ${c.status==='Completed'?'archived':''}">${esc(c.status)}</span>
      <h3>${esc(c.name)}</h3><p><strong>Objective:</strong> ${esc(c.goal)}</p>
      <p>${esc(c.audience || 'No audience description added.')}</p>
      <div class="mc-card-footer"><span class="mc-card-meta">${dateText(c.start)} → ${dateText(c.end)}</span>
      <div class="mc-item-actions">${c.status!=='Completed'?btn('advance-campaign',c.id,c.status==='Planned'?'Activate':'Complete'):''}${btn('delete-campaign',c.id,'Remove','danger')}</div></div></article>`).join('')||emptyMsg('No campaigns. Select New campaign to create one.');
    for (const id of ['mc-draft-campaign','mc-report-campaign']) {
      const select=byId(id);
      const previous=select.value;
      select.replaceChildren();
      const prompt=document.createElement('option');
      prompt.value='';prompt.textContent=data.campaigns.length?'Select campaign':'Create a campaign first';
      select.appendChild(prompt);
      data.campaigns.forEach(c=>{
        const opt=document.createElement('option');opt.value=c.id;opt.textContent=c.name;select.appendChild(opt);
      });
      if (data.campaigns.some(c=>c.id===previous)) select.value=previous;
    }
    byId('mc-drafts').innerHTML=data.drafts.slice().reverse().map(d=>`<div class="mc-list-item">
      <div><strong>${esc(d.title)}</strong>
      <small>${esc(campaignName(d.campaignId))} · ${esc(d.platform)} · ${dateText(d.targetDate)} · ${esc(d.status)}</small>
      <p>${esc(d.caption)}</p></div>
      <div class="mc-item-actions">${d.status!=='Ready for review'?btn('review-draft',d.id,'Mark for review'):btn('reset-draft',d.id,'Reopen')}${btn('delete-draft',d.id,'Remove','danger')}</div></div>`).join('')||emptyMsg('No content drafts saved.');
    byId('mc-creators').innerHTML=data.creators.slice().reverse().map(c=>`<div class="mc-list-item"><div>
      <strong>${esc(c.name)}</strong><small>${esc(c.platform)} · Topic fit: ${esc(c.fit)}</small>
      <p>${esc(c.notes)}</p></div><div class="mc-item-actions">${btn('delete-creator',c.id,'Remove','danger')}</div></div>`).join('')||emptyMsg('Your shortlist is empty.');
    byId('mc-report-list').innerHTML=data.reports.slice().reverse().map(r=>{
      const rate=r.reach?((r.engagements/r.reach)*100).toFixed(2)+'%':'N/A';
      return `<article class="mc-campaign-card"><span class="mc-status">Manually entered</span>
        <h3>${esc(campaignName(r.campaignId))}</h3>
        <p>Reach: ${Number(r.reach).toLocaleString()} · Engagements: ${Number(r.engagements).toLocaleString()}</p>
        <p><strong>Interactions ÷ reach:</strong> ${rate}</p><p>${esc(r.note)}</p>
        <div class="mc-card-footer"><span class="mc-card-meta">${esc(r.createdAt)}</span><div class="mc-item-actions">${btn('delete-report',r.id,'Remove','danger')}</div></div></article>`;
    }).join('')||emptyMsg('No manually entered campaign metrics yet.');
  };
  function showSection(section) {
    document.querySelectorAll('.mc-view').forEach(view=>{
      view.hidden=view.dataset.view!==section;
    });
    document.querySelectorAll('.mc-nav-link').forEach(button=>{
      const selected=button.dataset.section===section;
      button.classList.toggle('active',selected);
      if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    try { history.replaceState(null,'','#'+section); } catch (_) {}
  }
  function openCampaign() {
    const form=byId('mc-campaign-form');form.reset();
    const now=new Date().toISOString().slice(0,10);
    form.elements.start.value=now;form.elements.end.value=now;
    byId('mc-campaign-dialog').showModal();
  }
  const campaignForm=byId('mc-campaign-form');
  campaignForm.addEventListener('submit',event=>{
    event.preventDefault();
    if(!campaignForm.reportValidity())return;
    const form=new FormData(campaignForm);
    const name=safeName(form.get('name'));
    const start=String(form.get('start')),end=String(form.get('end'));
    if(!name||end<start){notify('Check the campaign name and make sure the end date follows the start date.');return;}
    if(data.campaigns.length>=500){notify('The local workspace is full. Export and clear older entries.');return;}
    data.campaigns.push({id:uuid(),name,goal:safeName(form.get('goal')),audience:note(form.get('audience')),start,end,status:'Planned'});
    persist();render();byId('mc-campaign-dialog').close();notify('Campaign saved locally.');showSection('campaigns');
  });
  byId('mc-new-campaign').addEventListener('click',openCampaign);
  byId('mc-close-dialog').addEventListener('click',()=>byId('mc-campaign-dialog').close());
  byId('mc-cancel-campaign').addEventListener('click',()=>byId('mc-campaign-dialog').close());
  byId('mc-draft-form').addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.currentTarget;if(!form.reportValidity())return;
    const p=new FormData(form);const campaignId=String(p.get('campaignId'));
    if(!data.campaigns.some(c=>c.id===campaignId)){notify('Choose an existing campaign.');return;}
    if(data.drafts.length>=500){notify('Draft limit reached. Export and clear older drafts.');return;}
    data.drafts.push({id:uuid(),campaignId,platform:safeName(p.get('platform')),targetDate:String(p.get('targetDate')),
      title:safeName(p.get('title')),caption:String(p.get('caption')||'').slice(0,2000),status:'Draft'});
    persist();form.reset();render();notify('Content draft saved locally — not scheduled or published.');
  });
  byId('mc-creator-form').addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.currentTarget;if(!form.reportValidity())return;
    const p=new FormData(form);if(data.creators.length>=500){notify('Creator limit reached.');return;}
    data.creators.push({id:uuid(),name:safeName(p.get('name')),platform:safeName(p.get('platform')),
      fit:safeName(p.get('fit')),notes:note(p.get('notes'))});
    persist();form.reset();render();notify('Creator shortlisted locally.');
  });
  byId('mc-report-form').addEventListener('submit',event=>{
    event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
    const p=new FormData(form),reach=integer(p.get('reach')),engagements=integer(p.get('engagements'));
    const campaignId=String(p.get('campaignId'));
    if(reach===null||engagements===null||!data.campaigns.some(c=>c.id===campaignId)){notify('Choose a campaign and enter valid non-negative counts.');return;}
    if(data.reports.length>=500){notify('Report limit reached.');return;}
    data.reports.push({id:uuid(),campaignId,reach,engagements,note:note(p.get('note')),createdAt:new Date().toISOString().slice(0,10)});
    persist();form.reset();render();notify('Manual performance measurement saved.');
  });
  document.addEventListener('click',event=>{
    const nav=event.target.closest('[data-section]');if(nav){showSection(nav.dataset.section);return;}
    const next=event.target.closest('[data-go]');if(next){showSection(next.dataset.go);return;}
    const act=event.target.closest('[data-action]');if(!act)return;
    const action=act.dataset.action,id=act.dataset.id;
    if(action==='new-campaign'){openCampaign();return;}
    const containers={'campaign':'campaigns','draft':'drafts','creator':'creators','report':'reports'};
    if(action==='advance-campaign'){
      const item=data.campaigns.find(c=>c.id===id);
      if(item)item.status=item.status==='Planned'?'Active':'Completed';
    }else if(action==='review-draft'||action==='reset-draft'){
      const item=data.drafts.find(d=>d.id===id);
      if(item)item.status=action==='review-draft'?'Ready for review':'Draft';
    }else if(action.startsWith('delete-')){
      const kind=action.slice(7),collection=containers[kind];
      if(!collection)return;
      if(!confirm('Remove this local '+kind+' entry? This cannot be undone.'))return;
      data[collection]=data[collection].filter(item=>item.id!==id);
      if(kind==='campaign'){
        // Linked drafts/reports remain as independent historical local records.
        notify('Campaign removed. Existing drafts and measurements are retained.');
      }
    }else return;
    persist();render();
  });
  byId('mc-export').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),...data},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='media-cloud-local-export.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify('Export prepared from local browser records.');
  });
  byId('mc-clear').addEventListener('click',()=>{
    if(!confirm('Delete all Media Cloud campaigns, drafts, creators and reports saved in this browser? Export first if you need a copy.'))return;
    data=empty();try{localStorage.removeItem(KEY);}catch(_){}
    render();showSection('overview');notify('Local Media Cloud data cleared.');
  });
  render();
  const start=(location.hash||'').slice(1);
  showSection(['overview','campaigns','content','creators','reports'].includes(start)?start:'overview');
})();
