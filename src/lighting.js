import * as THREE from 'three';
export const LIGHT_LIMITS={softness:[.3,4],azimuth:[-180,180],elevation:[10,90],power:[0,3],surfaceInfluence:[0,1],contourInfluence:[0,1]};
export const LIGHT_DEFAULTS={softness:2.2,azimuth:-28,elevation:42.5,power:1,surfaceInfluence:1,contourInfluence:1};
export function normalizeLights(value,fallback={}){
 const sources=Array.isArray(value)&&value.length?value.slice(0,8):[{...fallback,name:'Основной свет'}];
 return sources.map((source,i)=>{
  const s={kind:source.kind==='dark'?'dark':'light',id:'light-'+i,name:typeof source.name==='string'?source.name.slice(0,40):'Свет '+(i+1),enabled:source.enabled!==false,color:/^#[0-9a-f]{6}$/i.test(source.color)?source.color:'#fffbf3'};
  s.shape=source.shape==='strip'&&s.kind==='light'?'strip':'area';
  for(const [key,[min,max]] of Object.entries(LIGHT_LIMITS))s[key]=Number.isFinite(source[key])?THREE.MathUtils.clamp(source[key],min,max):LIGHT_DEFAULTS[key];
  if(s.kind==='dark'){s.blendMode=source.blendMode==='neutral'?'neutral':'multiply';s.richness=Number.isFinite(source.richness)?THREE.MathUtils.clamp(source.richness,0,1):.2;}
  if(s.kind==='light'){s.blendMode=source.blendMode==='none'?'none':'screen';s.richness=Number.isFinite(source.richness)?THREE.MathUtils.clamp(source.richness,0,1):.15;}
  s.distance=Number.isFinite(source.distance)?THREE.MathUtils.clamp(source.distance,.3,30):Math.hypot(3.5,3.2);
  return s;
 });
}
export function syncLightRig(scene,objects,sources){
 const ids=new Set(sources.map(s=>s.id));
 for(const [id,light] of objects)if(!ids.has(id)){scene.remove(light);light.dispose?.();objects.delete(id);}

 for(const source of sources){
  let light=objects.get(source.id);
  if(!light){light=source.kind==='dark'?new THREE.Object3D():new THREE.RectAreaLight();objects.set(source.id,light);scene.add(light);}
  light.name=source.name;if(light.isRectAreaLight)light.color.set(source.color);
  const strip=source.shape==='strip';
  light.width=source.softness*(strip?.12:1);light.height=source.softness*(strip?2:.76);
  const distance=source.distance??Math.hypot(3.5,3.2);
  const a=THREE.MathUtils.degToRad(source.azimuth),e=THREE.MathUtils.degToRad(source.elevation),radius=distance*Math.cos(e);
  light.position.set(Math.sin(a)*radius,Math.cos(a)*radius,distance*Math.sin(e));
  light.lookAt(0,0,.05);light.visible=source.enabled;
  // Preserve emitted power as the area changes, so softness controls the penumbra.
  // The shared physical contribution is the part requested by both material
  // groups. Role-specific directional textures add the remaining light.
  const sharedInfluence=Math.min(source.surfaceInfluence??1,source.contourInfluence??1);
  light.intensity=source.enabled?14*source.power*sharedInfluence*(2.2*2.2*.76)/(light.width*light.height):0;
  light.updateMatrixWorld();
 }
 scene.updateMatrixWorld(true);
}

// Drag in the camera plane at the source's initial depth. This works in front
// and rotated views and leaves the other sources and object camera untouched.
export function moveLightOnScreen(source,camera,ndcX,ndcY,depth){
 const point=new THREE.Vector3(ndcX,ndcY,depth).unproject(camera);
 const radius=Math.hypot(point.x,point.y);
 point.z=Math.max(.3,radius*Math.tan(THREE.MathUtils.degToRad(10)),point.z);
 source.azimuth=THREE.MathUtils.radToDeg(Math.atan2(point.x,point.y));
 source.elevation=THREE.MathUtils.radToDeg(Math.atan2(point.z,radius));
 source.distance=THREE.MathUtils.clamp(point.length(),.3,30);
}

export function highlightSource(){return {kind:'light',shape:'strip',name:'Свет для бликов',enabled:true,color:'#ffffff',power:.25,softness:1.6,azimuth:65,elevation:30,distance:Math.hypot(3.5,3.2),blendMode:'none',richness:0,surfaceInfluence:1,contourInfluence:1};}
