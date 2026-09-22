import * as THREE from 'three';
const SIZE=1024,SCALE=SIZE/304;
function drawLoops(ctx,loops){
 ctx.beginPath();
 for(const loop of loops){loop.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.X/1000*SCALE,p.Y/1000*SCALE));ctx.closePath();}
 ctx.fill('nonzero');
}
function mask(loops){const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;const ctx=canvas.getContext('2d');ctx.fillStyle='#000';drawLoops(ctx,loops);return canvas;}
function texture(canvas){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;}
function softStamp(ctx,image,x,y,blur,opacity){
 ctx.save();ctx.globalAlpha=Math.min(1,opacity);ctx.filter=`blur(${Math.max(.01,blur*SCALE)}px)`;ctx.drawImage(image,x*SCALE,y*SCALE);ctx.restore();
}
export function createStylizedTextures(asset,settings,overrides){
 const rims=asset.regions.filter(r=>(overrides[r.id]?.role||r.role)==='rim').flatMap(r=>r.loops);
 const rimMask=mask(rims),surface=document.createElement('canvas');surface.width=surface.height=SIZE;
 const ctx=surface.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,SIZE,SIZE);
 const strength=settings.pseudoShadows?settings.shadowStrength:0,blur=settings.shadowSoftness;
 if(strength>0){
  // Fixed occlusion beneath the united metal contour, independent of studio lights.
  softStamp(ctx,rimMask,0,.35,blur*.45,.28*strength);
  softStamp(ctx,rimMask,1.2,2.5,blur,.48*strength);
  softStamp(ctx,rimMask,.15,.55,.35,.65*strength);
 }
 const shadow=document.createElement('canvas');shadow.width=shadow.height=SIZE;
 if(strength>0){
  const sc=shadow.getContext('2d');
  // Fill regions individually so overlaps do not cancel their silhouettes.
  const silhouette=document.createElement('canvas');silhouette.width=silhouette.height=SIZE;const m=silhouette.getContext('2d');m.fillStyle='#000';
  for(const r of asset.regions)drawLoops(m,r.loops);
  softStamp(sc,silhouette,1.8,3,blur+2,.42*strength);
 }
 return{surface:texture(surface),shadow:texture(shadow),dispose(){this.surface.dispose();this.shadow.dispose();}};
}
export function applyStylizedSurface(model,maps){
 const fixedLight=new THREE.Vector3(-.35,.55,1).normalize();
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const role=mesh.userData.role;
  if(role==='rim'||role==='pin')return;
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
  if(!g.attributes.reliefColor){
   const uv=new Float32Array(p.count*2),colors=new Float32Array(p.count*3);
   for(let i=0;i<p.count;i++){
    uv[i*2]=(p.getX(i)+152)/304;uv[i*2+1]=(p.getY(i)+152)/304;
    const dot=n.getX(i)*fixedLight.x+n.getY(i)*fixedLight.y+n.getZ(i)*fixedLight.z;
    const vertical=.91+.10*(p.getY(i)+152)/304;
    const brightness=THREE.MathUtils.clamp((.63+.4*Math.max(0,dot))*vertical,.45,1);
    colors.set([brightness,brightness,brightness],i*3);
   }
   g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('reliefColor',new THREE.BufferAttribute(colors,3));
  }
  g.setAttribute('color',g.attributes.reliefColor);
  mesh.material.vertexColors=true;mesh.material.map=maps.surface;mesh.material.needsUpdate=true;
 });
}
