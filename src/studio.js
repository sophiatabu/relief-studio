import {highlightSource} from './lighting.js';
// Canonical default recipe, tuned against the robot-hand reference.
// Runtime settings are editable normalized copies of this object.
export const STUDIO=Object.freeze({
 version:'robot-reference-v3',name:'По умолчанию',fill:.48,exposure:1.05,
 appearance:Object.freeze({height:9,bevel:1.5,dome:1,roughness:.52,gloss:.38,enamelSaturation:1.25,enamelBrightness:1.15,rimHighlight:.65,rimHighlightWidth:.25,metalShadeGain:2.2}),
 contour:Object.freeze({enabled:true,facet:true,facetWidth:.72,facetStrength:.58,highlight:true,highlightAngle:0,highlightWidth:.3,highlightStrength:.72,highlightSoftness:.42,shadow:true,shadowAngle:225,shadowOffset:.8,shadowSoftness:1.35,shadowStrength:.58}),
 sources:Object.freeze([
  Object.freeze({id:'key',name:'Основной свет',kind:'light',enabled:true,color:'#ffffff',power:.92,softness:2.8,azimuth:-25,elevation:42.5,distance:Math.hypot(3.5,3.2),blendMode:'screen',richness:.12,surfaceInfluence:1,contourInfluence:.72}),
  Object.freeze({id:'shade',name:'Мягкое затемнение',kind:'dark',enabled:true,color:'#36313f',power:.27,blendMode:'multiply',richness:.32,softness:2.4,azimuth:180,elevation:25,distance:1.8,surfaceInfluence:1,contourInfluence:.18}),
  Object.freeze({...highlightSource(),id:'edge'})
 ])
});

// Apply the new default colour balance once. Keep positions and weaker darkness;
// subsequent edits survive reloads without being forced back to the preset.
export function migrateColourBalance(saved){
 if(!saved||saved.profile===STUDIO.version)return saved;
 const materialDefaults=source=>source.kind==='dark'&&source.power===.27&&source.softness===2.4&&source.azimuth===180?{...source,surfaceInfluence:1,contourInfluence:.18}:source.kind==='light'&&source.shape!=='strip'&&source.power===.92&&source.softness===2.8&&source.azimuth===-25?{...source,surfaceInfluence:1,contourInfluence:.72}:source;
 if(saved.profile==='robot-reference-v2')return {...saved,profile:STUDIO.version,sources:saved.sources?.map(materialDefaults)};
 if(saved.profile==='robot-reference-v1')return {...saved,profile:STUDIO.version,fill:saved.fill===.65?STUDIO.fill:saved.fill,exposure:saved.exposure===1.2?STUDIO.exposure:saved.exposure,sources:saved.sources?.map(source=>materialDefaults(source.kind==='dark'&&source.power===.34?{...source,power:.27,richness:.32}:source.kind==='light'&&source.shape!=='strip'&&source.power===1.15?{...source,power:.92,richness:.12}:source))};
 if(saved.profile==='soft-enamel-v3')return {...saved,profile:STUDIO.version};
 if(saved.profile==='soft-enamel-v2'){const untouched=saved.sources?.length===2&&saved.sources.some(s=>s.kind==='dark'&&s.power===.26&&s.softness===2.4&&s.azimuth===180)&&saved.sources.some(s=>s.kind==='light'&&s.power===1.15&&s.azimuth===-25);return {...saved,profile:STUDIO.version,sources:untouched?[...saved.sources,highlightSource()]:saved.sources};}
 if(saved.profile==='soft-enamel-v1')return {...saved,profile:STUDIO.version,sources:saved.sources?.map(source=>source.kind==='dark'&&source.power===.22&&source.softness===3&&source.azimuth===-135?{...source,power:.26,softness:2.4,azimuth:180}:source)};
 if(saved.profile==='vivid-colour-v2')return {...saved,profile:STUDIO.version,fill:saved.fill===.8?STUDIO.fill:saved.fill,exposure:saved.exposure===1.4?STUDIO.exposure:saved.exposure,sources:saved.sources?.map(source=>{
  if(source.kind==='dark')return {...source,power:source.power===.3?.22:source.power};
  return {...source,power:source.power===1.2?1.15:source.power,softness:source.softness===2.2?2.8:source.softness,azimuth:source.azimuth===35?-25:source.azimuth};
 })};
 if(saved.profile==='clean-colour-v1')return {...saved,profile:STUDIO.version,fill:saved.fill===.65?STUDIO.fill:saved.fill,exposure:saved.exposure===1.15?STUDIO.exposure:saved.exposure};
 let keySeen=false;
 return {...saved,profile:STUDIO.version,fill:Math.max(saved.fill??0,STUDIO.fill),exposure:Math.max(saved.exposure??0,STUDIO.exposure),sources:saved.sources?.map(source=>{
  if(source.kind==='dark')return {...source,power:Math.min(source.power??.3,.3),blendMode:'multiply',richness:Math.max(source.richness??0,.35)};
  if(!keySeen){keySeen=true;return {...source,power:Math.max(source.power??1,1.2),color:'#ffffff'};}
  return {...source};
 })};
}

export function migrateAppearance(saved){
 const firstRobot={height:9,bevel:1.5,dome:1,roughness:.6,gloss:.45,rimHighlight:.8,rimHighlightWidth:.25,metalShadeGain:2.4};
 if(saved&&Object.entries(firstRobot).every(([key,value])=>saved[key]===value))return {...saved,...STUDIO.appearance};
 const previous={height:9,bevel:1.5,dome:1,roughness:.44,gloss:.45,rimHighlight:.7,rimHighlightWidth:.35,metalShadeGain:1.8};
 if(saved&&Object.entries(previous).every(([key,value])=>saved[key]===value))return {...saved,...STUDIO.appearance};
 return saved;
}
