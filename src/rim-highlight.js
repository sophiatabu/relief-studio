import * as THREE from 'three';
const applied=new WeakMap();
// An explicit, bounded stripe on the existing rounded edge. Its width is in
// bevel coordinates, independent of light-source size or overall metal roughness.
export function edgeHighlight(u,nx,ny,strength,width,directions){
 if(u<=0||u>=1||strength<=0)return 0;
 const sigma=.04+.30*THREE.MathUtils.clamp(width,0,1);
 const stripe=Math.exp(-.5*((u-.38)/sigma)**2)*THREE.MathUtils.smoothstep(u,0,.12)*(1-THREE.MathUtils.smoothstep(u,.82,1));
 let facing=0;
 for(const d of directions)facing=Math.max(facing,d.power*THREE.MathUtils.smoothstep(nx*d.x+ny*d.y,-.15,.7));
 return THREE.MathUtils.clamp(strength,0,1)*stripe*THREE.MathUtils.clamp(facing,0,1);
}
export function updateRimHighlight(model,settings,sources){
 if(!model)return false;
 const directions=(settings.rimHighlight??.55)<=0?[]:sources.filter(s=>s.kind!=='dark'&&s.enabled&&s.power>0&&(s.contourInfluence??1)>0).map(s=>({x:Math.sin(s.azimuth*Math.PI/180),y:Math.cos(s.azimuth*Math.PI/180),power:Math.min(1,s.power*(s.contourInfluence??1))}));
 const materials=[];model.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.surface==='rim-cap')materials.push(mesh.material.uuid);});
 const signature=JSON.stringify([directions,settings.rimHighlight,settings.rimHighlightWidth,materials]);
 if(applied.get(model)===signature)return false;
 model.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData.surface!=='rim-cap')return;
  const g=mesh.geometry,profile=g.attributes.rimProfile;if(!profile)return;
  const m=mesh.material;
  if(!m.userData.rimBaseColour)m.userData.rimBaseColour=m.color.clone();
  const base=m.userData.rimBaseColour;
  // Use RGBA like the tracer’s generated attributes: its mixed RGB/RGBA
  // merge path leaves zero colours on these meshes. Alpha must stay opaque.
  let colour=g.attributes.color;if(!colour){colour=new THREE.Float32BufferAttribute(new Float32Array(profile.count*4),4);g.setAttribute('color',colour);}
  for(let i=0;i<profile.count;i++){
   const a=edgeHighlight(profile.getX(i),profile.getY(i),profile.getZ(i),settings.rimHighlight??.55,settings.rimHighlightWidth??.35,directions);
   colour.setXYZW(i,base.r+(1-base.r)*a,base.g+(1-base.g)*a,base.b+(1-base.b)*a,1);
  }
  colour.needsUpdate=true;m.color.set(0xffffff);m.vertexColors=true;
 });
 applied.set(model,signature);return true;
}
