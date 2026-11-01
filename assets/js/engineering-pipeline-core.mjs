/* Engineering pipeline provenance and stage transitions. Pure, testable, local-only. */
export const STAGES=Object.freeze(['brief','model','refine','analyze','deliver']);
export const SOURCES=Object.freeze(['parametric','primitive','imported','ai','sculpted-parametric','sculpted-primitive','sculpted-imported','sculpted-ai']);
export function validStage(value){return STAGES.includes(value)?value:'model';}
export function validSource(value){return SOURCES.includes(value)?value:'parametric';}
export function isExactParametric(source){return source==='parametric';}
export function canUseBeamSurrogate(source){return isExactParametric(source);}
export function transitionModel(state,event){
 const before=validSource(state?.source),type=String(event?.type||'');
 let source=before;
 if(type==='parametric-created')source='parametric';
 else if(type==='primitive-created')source='primitive';
 else if(type==='file-imported')source='imported';
 else if(type==='ai-generated')source='ai';
 else if(type==='mesh-edited'){
  const base=before.startsWith('sculpted-')?before.slice('sculpted-'.length):before;
  source='sculpted-'+base;
 }else throw new RangeError('Unsupported geometry transition');
 const generation=Number.isSafeInteger(state?.generation)&&state.generation>=0?state.generation:0;
 return Object.freeze({source,generation:generation+1,
  beamSurrogateAvailable:canUseBeamSurrogate(source),
  requiresExplicitMeshSelection:!canUseBeamSurrogate(source)});
}
export function stageForHash(hash){
 const id=String(hash||'').replace(/^#/,'');
 if(['eng-workspace','eng-brief-form'].includes(id))return 'brief';
 if(['eng-cad','eng-cad-form','eng-scad-preview','eng-cad-viewport'].includes(id))return 'model';
 if(['eng-ai','fab-ai','fab-tripo','eng-sculpt','fab-sculpt-workbench','fab-preview'].includes(id))return 'refine';
 if(['eng-calculators','eng-simulators','eng-preflight','eng-sim-controls','eng-sim-results','eng-design-space'].includes(id))return 'analyze';
 if(['fab-design','fab-project-form','fab-upload-area','fab-upload-summary'].includes(id))return 'deliver';
 return null;
}