/* Deterministic engineering prototype models.
 * UMD export is usable in browsers and Node unit tests without dependencies.
 * These are preliminary screening equations, NOT validated engineering analysis.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TeknEngineeringModels=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const positive=(value,key,max=1e12)=>{
   const n=Number(value);
   if(!Number.isFinite(n)||n<=0||n>max)throw new RangeError(key+' must be a finite positive number');
   return n;
 };
 const bounded=(value,key,min,max)=>{
   const n=Number(value);
   if(!Number.isFinite(n)||n<min||n>max)throw new RangeError(key+' must be between '+min+' and '+max);
   return n;
 };
 const maxLength=(s,max)=>typeof s==='string'?s.trim().slice(0,max):'';
 function dcSeries(v){
   const volts=positive(v.volts,'Voltage',1000);
   const r1=positive(v.r1,'R1',1e9),r2=positive(v.r2,'R2',1e9);
   const resistance=r1+r2,current=volts/resistance;
   return {resistanceOhm:resistance,currentAmp:current,r1DropVolt:current*r1,
     r2DropVolt:current*r2,r1PowerWatt:current**2*r1,r2PowerWatt:current**2*r2,
     totalPowerWatt:volts*current};
 }
 function batteryEnergy(v){
   const volts=positive(v.volts,'Battery voltage',1000),ampHours=positive(v.ampHours,'Battery capacity',1e4),
    watts=positive(v.watts,'Load',1e5),usable=bounded(v.usable,'Usable fraction',.05,1),
    efficiency=bounded(v.efficiency,'Efficiency',.05,1);
   const solarWatts=bounded(v.solarWatts,'Solar rated wattage',0,1e5),sunHours=bounded(v.sunHours,'Peak sun hours',0,24);
   const nominalWh=volts*ampHours,usableWh=nominalWh*usable*efficiency;
   return {nominalWh,usableWh,runtimeHours:usableWh/watts,dailySolarWh:solarWatts*sunHours*efficiency,
     dailyLoadWh:watts*24,solarCoverageRatio:solarWatts*sunHours*efficiency/(watts*24)};
 }
 function cantilever(v){
   const lengthMm=positive(v.lengthMm,'Length',1e4),widthMm=positive(v.widthMm,'Width',1000),
     heightMm=positive(v.heightMm,'Height',1000),modulusGpa=positive(v.modulusGpa,'Young modulus',1200),
     force=bounded(v.force,'Tip force',0,1e6);
   const length=lengthMm/1000,width=widthMm/1000,height=heightMm/1000,
     modulusPa=modulusGpa*1e9,momentInertia=width*height**3/12;
   const deltaM=force*length**3/(3*modulusPa*momentInertia);
   const maxStressPa=6*force*length/(width*height*height);
   return {momentInertiaM4:momentInertia,tipDeflectionMm:deltaM*1000,rootStressMpa:maxStressPa/1e6,
     largeDeflectionWarning:deltaM/length>.05};
 }
 function robotDrive(v){
   const leftRpm=bounded(v.leftRpm,'Left RPM',-1e4,1e4),rightRpm=bounded(v.rightRpm,'Right RPM',-1e4,1e4),
     ratio=positive(v.ratio,'Gear ratio',1e4),diameterMm=positive(v.diameterMm,'Wheel diameter',1e3),
     trackMm=positive(v.trackMm,'Track width',5e3),efficiency=bounded(v.efficiency,'Drive efficiency',.05,1);
   const diameterM=diameterMm/1000,trackM=trackMm/1000;
   const vLeft=Math.PI*diameterM*leftRpm*efficiency/(60*ratio),vRight=Math.PI*diameterM*rightRpm*efficiency/(60*ratio);
   return {leftMps:vLeft,rightMps:vRight,forwardMps:(vLeft+vRight)/2,
     angularRadSec:(vRight-vLeft)/trackM,turningRadiusM:Math.abs(vRight-vLeft)>1e-10?trackM*(vRight+vLeft)/(2*(vRight-vLeft)):null};
 }
 function mountingPlate(p){
   const length=positive(p.length,'Length',1000),width=positive(p.width,'Width',1000),
     thickness=positive(p.thickness,'Thickness',100),hole=positive(p.hole,'Hole diameter',50),
     offset=positive(p.offset,'Offset',100);
   if(length<20||width<20||thickness<.5||hole<1||offset<2)throw new RangeError('Dimensions are below the supported minimum');
   if(offset<=hole/2||offset>=Math.min(length,width)/2||hole>=Math.min(length,width)/2||
      length-2*offset<=hole||width-2*offset<=hole)
      throw new RangeError('Hole centers must clear the plate edges and holes must not overlap');
   const scad=`// TeknTandao concept prototype — verify material, fits and tolerances
$fn = 72;
length_mm = ${length};
width_mm = ${width};
thickness_mm = ${thickness};
hole_diameter_mm = ${hole};
offset_mm = ${offset};
difference() {
    cube([length_mm, width_mm, thickness_mm], center=false);
    for (x = [offset_mm, length_mm-offset_mm])
        for (y = [offset_mm, width_mm-offset_mm])
            translate([x,y,-0.1])
                cylinder(h=thickness_mm+0.2, d=hole_diameter_mm);
}
`;
   return {scad,volumeMm3:length*width*thickness-4*Math.PI*(hole/2)**2*thickness,
     holes:4,material:'User-specified; not assumed'};
 }
 const catalog={
  robotics:{
   subsystems:['Controller and power distribution','Motor drivers, motors and encoders','Sensors and safety stops','Chassis, bearings and mechanisms','Software, firmware and telemetry'],
   tests:['Bench-test each motor under current limits','Measure stall current and battery sag','Test failsafe, watchdog and safe stop','Check drivetrain slip and operating temperature'],
   tools:['Webots','Gazebo Sim','FreeCAD','KiCad/ngspice']},
  electronics:{
   subsystems:['Microcontroller and firmware','Power supply, regulation and protection','Sensors, I/O and communications','PCB, connectors and enclosure'],
   tests:['Check voltage and logic compatibility','Simulate worst-case component loads','Prototype on isolated low voltage','Measure temperatures, ripple and brownouts'],
   tools:['KiCad/ngspice','CircuitJS1','SimulIDE','OpenSCAD']},
  mechanical:{
   subsystems:['Functional loads and fastening','Parametric geometry and tolerances','Material and manufacturing process','Inspection and assembly plan'],
   tests:['Check deflection and expected stress','Measure printed or machined tolerance','Test fit and fatigue under expected loads','Document inspection and design revisions'],
   tools:['FreeCAD','OpenSCAD','OpenModelica']},
  energy:{
   subsystems:['Load and duty-cycle model','Energy generation and battery sizing','Protection, switching and wiring','Monitoring and thermal management'],
   tests:['Measure true peak and average load','Validate charging performance and battery chemistry','Test over-current and thermal protections','Check worst-case weather and autonomy'],
   tools:['OpenModelica','CircuitJS1','KiCad/ngspice']},
  automation:{
   subsystems:['Supervised controller and isolated I/O','Sensors and verified state feedback','Actuator interfacing and physical interlocks','Manual override and emergency controls','Logging, commissioning and maintenance'],
   tests:['Validate default-safe state on power loss','Prove obstacle / interlock mechanisms','Test authorization and fail-safe recovery','Commission with competent installers and applicable standards'],
   tools:['SimulIDE','KiCad/ngspice','Webots','OpenModelica']}
 };
 function designBrief(input){
   const domain=input.domain;
   if(!Object.hasOwn(catalog,domain))throw new RangeError('Unsupported engineering discipline');
   const name=maxLength(input.name,100),goal=maxLength(input.goal,1500),constraints=maxLength(input.constraints,1000);
   if(!name||!goal)throw new RangeError('Project name and goal are required');
   const stages=['concept','breadboard','prototype','pilot'],powers=['usb','battery','solar','mains'],
      environments=['indoor','outdoor','industrial'];
   if(!stages.includes(input.stage)||!powers.includes(input.power)||!environments.includes(input.environment))
      throw new RangeError('Unsupported project condition');
   const info=catalog[domain];
   const risks=[];
   if(input.power==='mains')risks.push('Mains-voltage installation requires qualified electrical design, isolation and compliance testing.');
   if(input.environment!=='indoor')risks.push('Verify environmental sealing, UV exposure, temperature and mechanical robustness for field use.');
   if(input.power==='solar'||input.power==='battery')risks.push('Confirm real power budget, battery chemistry, thermal controls and safe charge protection.');
   if(domain==='robotics'||domain==='automation')risks.push('Provide human-accessible stop controls and validate actuation failsafes before enabling any motion.');
   if(domain==='mechanical')risks.push('Simple beam equations do not replace validated FEA, fatigue and material testing.');
   risks.push('No AI recommendation replaces component datasheets, safety standards or qualified sign-off.');
   return {version:1,name,goal,domain,stage:input.stage,power:input.power,environment:input.environment,
    constraints,subsystems:[...info.subsystems],tests:[...info.tests],tools:[...info.tools],
    risks,estimatedBudget:null,partsOrderPlaced:false,approvedForManufacture:false};
 }
 return Object.freeze({dcSeries,batteryEnergy,cantilever,robotDrive,mountingPlate,designBrief});
});
