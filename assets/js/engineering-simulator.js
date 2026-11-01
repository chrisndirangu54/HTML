/* Local analytical plate simulator; numeric tools remain usable without WebGL. */
(() => {
  'use strict';
  const M=window.TeknEngineeringModels,$=id=>document.getElementById(id);
  const form=$('eng-cad-form'),material=$('eng-sim-material'),force=$('eng-sim-load'),
    numberInput=$('eng-sim-load-number'),scale=$('eng-sim-scale'),overlay=$('eng-sim-view'),
    sweep=$('eng-sim-time'),error=$('eng-sim-error');
  if(!M||!form||!material)return;
  const geoKeys=['length','width','thickness','hole','offset'];
  const dims=()=>Object.fromEntries(geoKeys.map(name=>[name,Number(form.elements.namedItem(name).value)]));
  const fmt=(v,d=3)=>Number.isFinite(v)?Number(v.toPrecision(d)).toLocaleString(undefined,{maximumFractionDigits:6}):'—';
  let playing=false,frameId=0,lastTick=0;
  const offsetField=$('eng-cad-offset');
  const setError=msg=>{error.textContent=msg;error.hidden=!msg;};
  const updateOffsetHint=()=>{
    const {length,width,hole,offset}=dims();
    if(!Number.isFinite(length+width+hole))return;
    const low=Math.max(2,hole/2+.1),high=Math.min((length-hole)/2,(width-hole)/2)-.1;
    const max=Math.floor(high*10)/10,min=Math.ceil(low*10)/10;
    offsetField.min=String(min);offsetField.max=String(Math.max(min,max));
    const valid=Number.isFinite(offset)&&offset>=min&&offset<=max;
    $('eng-offset-help').textContent=max>=min
      ?'Valid hole-center offset: '+min+'–'+max+' mm. '+(valid?'Current offset is valid.':'Your '+offset+' mm offset is outside this range; try 8 mm or restore defaults.')
      :'Dimensions do not leave enough room for four separate mounting holes.';
    $('eng-offset-help').classList.toggle('is-invalid',!valid);
  };
  const paintMetrics=result=>{
    const items=[
      ['Tip deflection',fmt(result.tipDeflectionMm,4)+' mm'],
      ['Nominal peak stress',fmt(result.nominalMaximumMpa,4)+' MPa'],
      ['Nominal margin to yield',result.nominalYieldMargin===null?'No load':fmt(result.nominalYieldMargin,3)+'×'],
      ['Estimated mass',fmt(result.massKg*1000,4)+' g']
    ];
    const root=$('eng-sim-kpis');root.replaceChildren();
    for(const [label,value] of items){
      const wrap=document.createElement('div'),small=document.createElement('span'),strong=document.createElement('strong');
      small.textContent=label;strong.textContent=value;wrap.append(small,strong);root.append(wrap);
    }
    const list=$('eng-sim-warnings');list.replaceChildren();
    for(const warning of result.warnings){
      const li=document.createElement('li');li.textContent=warning;list.append(li);
    }
  };
  const paintPlot=result=>{
    const target=$('eng-sim-plot'),ns='http://www.w3.org/2000/svg';target.replaceChildren();
    const x0=54,y0=14,w=525,h=128,max=Math.max(result.tipDeflectionMm,1e-9);
    const draw=(tag,attrs,label)=>{
      const el=document.createElementNS(ns,tag);
      for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));
      if(label!==undefined)el.textContent=label;
      target.append(el);
    };
    for(const t of [0,.25,.5,.75,1]){
      const y=y0+h-h*t;
      draw('line',{x1:x0,y1:y,x2:x0+w,y2:y,stroke:'#28584c','stroke-width':1});
      draw('text',{x:x0-7,y:y+4,'text-anchor':'end',fill:'#aed7c2','font-size':12},fmt(max*t));
    }
    draw('line',{x1:x0,y1:y0+h,x2:x0+w,y2:y0+h,stroke:'#93f6c7','stroke-width':2});
    draw('text',{x:x0+w/2,y:176,'text-anchor':'middle',fill:'#aed7c2','font-size':12},'Distance from fixed edge (mm)');
    const points=result.profile.map(p=>[x0+w*p.xMm/result.inputs.length,y0+h-h*p.deflectionMm/max]);
    draw('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#49f3b9','stroke-width':3,'stroke-linejoin':'round'});
    const tip=points[points.length-1];
    draw('circle',{cx:tip[0],cy:tip[1],r:5,fill:'#ffb95b'});
  };
  const compute=()=>{
    updateOffsetHint();
    const values=dims(),maxForce=Number(numberInput.value),phase=Number(sweep.value)/100;
    if(!Number.isFinite(maxForce)||maxForce<0||maxForce>5000){
      setError('Tip load must be between 0 and 5000 N.');return;
    }
    try{
      const result=M.plateSimulation({...values,material:material.value,forceN:maxForce*phase});
      const state={values,simulation:result,exaggeration:Number(scale.value),overlay:overlay.value,phase,targetForceN:maxForce};
      window.TeknPlateSimulationSnapshot=state;
      paintMetrics(result);paintPlot(result);
      $('eng-sim-time-value').textContent=Math.round(phase*100)+'%';
      $('eng-sim-scale-value').textContent=scale.value+'×';
      setError('');
      window.dispatchEvent(new CustomEvent('eng:plate-simulation',{detail:state}));
    }catch(e){
      setError('Simulation not updated: '+e.message+'. Restore the default plate or correct the inputs.');
      window.TeknPlateSimulationSnapshot=null;
      window.dispatchEvent(new CustomEvent('eng:plate-simulation-invalid',{detail:{message:e.message}}));
    }
  };
  const stop=()=>{playing=false;if(frameId)cancelAnimationFrame(frameId);frameId=0;$('eng-sim-play').textContent='Play load sweep';};
  const syncForce=el=>{
    let v=Number(el.value);if(!Number.isFinite(v))v=0;
    v=Math.min(5000,Math.max(0,v));numberInput.value=String(v);
    force.max=String(Math.max(500,Math.ceil(v/50)*50));force.value=String(v);
    stop();sweep.value='100';compute();
  };
  force.addEventListener('input',()=>syncForce(force));
  numberInput.addEventListener('change',()=>syncForce(numberInput));
  [material,scale,overlay].forEach(el=>el.addEventListener('input',compute));
  sweep.addEventListener('input',()=>{stop();compute();});
  form.addEventListener('input',()=>{stop();compute();});
  form.addEventListener('submit',()=>{stop();compute();});
  $('eng-cad-reset').addEventListener('click',()=>{
    stop();
    for(const [key,value] of Object.entries({length:100,width:60,thickness:6,hole:5,offset:8}))
      form.elements.namedItem(key).value=String(value);
    form.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const presets={light:5,working:25,high:220};
  document.querySelectorAll('[data-eng-scenario]').forEach(btn=>btn.addEventListener('click',()=>{
    const v=presets[btn.dataset.engScenario];if(v===undefined)return;
    material.value='aluminum';numberInput.value=String(v);syncForce(numberInput);
  }));
  $('eng-sim-play').addEventListener('click',()=>{
    if(playing){stop();return;}
    if(!window.TeknPlateSimulationSnapshot){compute();if(!window.TeknPlateSimulationSnapshot)return;}
    playing=true;lastTick=0;$('eng-sim-play').textContent='Pause sweep';
    const frame=t=>{
      if(!playing)return;
      if(document.hidden){stop();return;}
      if(!lastTick)lastTick=t;
      const elapsed=Math.min(100,t-lastTick);lastTick=t;
      const next=Number(sweep.value)+elapsed*.045;
      sweep.value=String(next>100?0:next);compute();
      frameId=requestAnimationFrame(frame);
    };
    frameId=requestAnimationFrame(frame);
  });
  $('eng-sim-stop').addEventListener('click',()=>{stop();sweep.value='100';compute();});
  $('eng-sim-export').addEventListener('click',()=>{
    const state=window.TeknPlateSimulationSnapshot;
    if(!state)return;
    const report={version:1,createdAt:new Date().toISOString(),geometry:state.values,
      peakLoadN:state.targetForceN,loadFraction:state.phase,
      material:state.simulation.material,visualExaggeration:state.exaggeration,
      values:state.simulation,limitations:'Simplified beam model; not FEA or manufacturing verification'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='tekntandao-plate-screening-results.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1400);
  });
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    $('eng-sim-play').disabled=true;
    $('eng-sim-play').title='Animation disabled by your motion preference; use the sweep slider.';
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  compute();
})();