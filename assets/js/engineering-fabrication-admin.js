/* Authorized operator-only controls. Permission is independently enforced on server. */
export async function enableOperator(call){
 const section=document.getElementById('fab-operator');
 if(!section)return;
 section.hidden=false;
 const list=document.getElementById('fab-admin-list'),status=document.getElementById('fab-admin-status');
 const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const refresh=async()=>{
  status.textContent='Loading private review queue…';
  try{
   const result=await call('engineeringAdminListProjects',{});
   list.replaceChildren();
   for(const project of result.projects||[]){
    const card=make('article');card.className='eng-fab-admin-card';
    const h=make('h3',project.title+' — '+project.status),summary=make('p',
     project.contactEmail+' · '+project.process+' · '+project.material+' · Quantity '+project.quantity);
    const desc=make('p',project.notes||'No additional notes supplied.');
    card.append(h,summary,desc);
    if(project.dimensions)card.append(make('pre','Dimensions (mm): '+JSON.stringify(project.dimensions)));
    if(project.file){
     const fileBtn=make('button','View submitted file (10-min private link)');
     fileBtn.type='button';fileBtn.className='tt-svc-button';
     fileBtn.addEventListener('click',async()=>{
      fileBtn.disabled=true;
      try{
       const reply=await call('engineeringAdminFileLink',{projectId:project.id});
       const u=new URL(reply.url);
       if(u.protocol!=='https:')throw Error('Unexpected file link');
       window.open(u.href,'_blank','noopener,noreferrer');
      }catch(e){status.textContent='Private file retrieval: '+e.message;}
      finally{fileBtn.disabled=false;}
     });
     card.append(fileBtn,make('p','Unscanned uploaded file: '+project.file.ext+' · '+Math.round(project.file.size/1024)+' KiB'));
    }
    const label=make('label','Quotation amount (KES)');
    const amount=make('input');amount.type='number';amount.min='1';amount.max='100000000';amount.step='1';
    amount.value=project.quoteKes||'';label.append(amount);
    const notes=make('textarea');notes.placeholder='Human review notes / design changes requested';notes.rows=3;
    notes.maxLength=2000;notes.value=project.operatorNote||'';
    const actions=make('div');actions.className='eng-fab-actions';
    for(const [id,title] of [['quoted','Issue quotation'],['needs_revision','Request revision'],['declined','Decline']]){
     const button=make('button',title);button.type='button';button.className='tt-svc-button';
     button.addEventListener('click',async()=>{
      const quoteKes=Number(amount.value);
      if(id==='quoted'&&(!Number.isSafeInteger(quoteKes)||quoteKes<=0)){status.textContent='Enter a positive whole-KES quote.';return;}
      if(!confirm('Confirm operator review action: '+title+'? No fabrication order or payment will be initiated.'))return;
      button.disabled=true;
      try{
       await call('engineeringAdminReviewProject',{projectId:project.id,status:id,
        quoteKes:id==='quoted'?quoteKes:null,note:notes.value});
       status.textContent='Updated project '+project.id+'.';await refresh();
      }catch(e){status.textContent='Review update failed: '+e.message;button.disabled=false;}
     });
     actions.append(button);
    }
    card.append(label,notes,actions);
    list.append(card);
   }
   if(!list.children.length)list.textContent='No queued projects needing operator review.';
   status.textContent='Operator queue loaded.';
  }catch(e){status.textContent='Could not load operator queue: '+e.message;}
 };
 document.getElementById('fab-admin-refresh').addEventListener('click',refresh);
 await refresh();
}