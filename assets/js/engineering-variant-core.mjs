import {normalizeScenario} from './engineering-design-intelligence-core.mjs';
/* Seven locally evaluated thickness alternatives; NOT FEA or global optimization. */
export function explorePlate(input,simulate,{maxDeflectionMm=.5,minMargin=1.5}={}){
 const scenario=normalizeScenario(input);
 if(typeof simulate!=='function')throw new TypeError('Simulation engine missing');
 if(!Number.isFinite(maxDeflectionMm)||maxDeflectionMm<=0||maxDeflectionMm>1000||
  !Number.isFinite(minMargin)||minMargin<1||minMargin>20)throw new RangeError('Invalid nominal screening constraints');
 const results=[];
 const seen=new Set();
 for(const multiplier of [.6,.75,.9,1,1.1,1.25,1.5]){
  const thickness=Math.round(scenario.geometry.thickness*multiplier*100)/100;
  if(thickness<.5||thickness>100||seen.has(thickness))continue;
  seen.add(thickness);
  const sim=simulate({...scenario.geometry,thickness,material:scenario.modelMaterial,forceN:scenario.forceN});
  if(!sim||!Number.isFinite(sim.tipDeflectionMm)||!Number.isFinite(sim.massKg)||
   !Number.isFinite(sim.nominalMaximumMpa)||sim.massKg<=0)throw new TypeError('Invalid simulation result');
  const margin=sim.nominalYieldMargin;
  results.push({thicknessMm:thickness,massGrams:sim.massKg*1000,nominalDeflectionMm:sim.tipDeflectionMm,
   nominalMargin:margin,withinNominalFilters:scenario.forceN>0&&Number.isFinite(margin)&&
    margin>=minMargin&&sim.tipDeflectionMm<=maxDeflectionMm,approved:false});
 }
 results.sort((a,b)=>a.massGrams-b.massGrams);
 return {results,lightestScreened:results.find(x=>x.withinNominalFilters)||null,
  limitations:'Screening uses a simplified beam surrogate; holes do not alter bending stiffness. No strength, manufacturing or safety approval is implied.'};
}