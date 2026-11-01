/* Explicit interpretation of CAD mesh units. Raw STL/OBJ/GLB coordinates
 * are dimensionless until the user chooses source units; mm is the output basis.
 * No inference from file names or AI-generated geometry. */
export const INPUT_UNITS=Object.freeze({mm:1,cm:10,m:1000,in:25.4});
export const UNIT_LABELS=Object.freeze({mm:'Millimetres',cm:'Centimetres',m:'Metres',in:'Inches'});
export function modelUnitScale(unit){
 if(typeof unit!=='string'||!Object.hasOwn(INPUT_UNITS,unit))
  throw new RangeError('Choose explicit source model units before conversion');
 return INPUT_UNITS[unit];
}
export function convertedBounds(bounds,unit){
 if(!Array.isArray(bounds)||bounds.length!==3||bounds.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0))
  throw new TypeError('Model dimensions must be finite, nonnegative X/Y/Z lengths');
 const scale=modelUnitScale(unit);
 const result=bounds.map(n=>n*scale);
 if(result.some(n=>!Number.isFinite(n)||n>1e7))throw new RangeError('Converted part dimensions exceed safe browser limits');
 return result;
}
export function modelVerificationStatus(source,unit){
 const native=source==='parametric'||source==='primitive';
 const isSelected=Object.hasOwn(INPUT_UNITS,unit);
 return Object.freeze({unitsVerified:native||isSelected,units:native?'mm':isSelected?'mm':null,
  originalUnits:native?'mm':isSelected?unit:null,
  needsExplicitUnitSelection:!native&&!isSelected});
}