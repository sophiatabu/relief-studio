import {compileDetailAssignments} from './detail-document.js';
import * as THREE from 'three';
import { EXTRUDE_DEFAULTS, batchByColor, disposeRenderPipeline } from './render-pipeline.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import ClipperLib from 'clipper-lib';
import {cleanEnamelColour} from './enamel-colour.js';
import { widenRim } from './rim-width.js';
import { roundedRimGeometry } from './rim.js';
import { readSVG, filledPath, polygonBoolean } from './svg.js';

const S=1000;
const clipType=ClipperLib.ClipType, fillType=ClipperLib.PolyFillType;
function clip(subject,cutters=[],difference=false){const c=new ClipperLib.Clipper();c.AddPaths(subject,ClipperLib.PolyType.ptSubject,true);if(cutters.length)c.AddPaths(cutters,ClipperLib.PolyType.ptClip,true);const tree=new ClipperLib.PolyTree();c.Execute(difference?clipType.ctDifference:clipType.ctUnion,tree,fillType.pftNonZero,fillType.pftNonZero);return ClipperLib.Clipper.PolyTreeToPaths(tree);}
// Limit the deviation from a vector curve, rather than giving every curve
// the same small number of straight edges (which makes large circles faceted).
function flattenPath(path,tolerance=.035){
 const points=[],append=p=>{if(!points.length||points.at(-1).distanceToSquared(p)>1e-18)points.push(p);};
 const distanceToSegment=(p,a,b)=>{
  const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
  const t=length2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length2)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
 };
 for(const curve of path.curves){
  const subdivide=(t0,a,t1,b,depth)=>{
   const span=t1-t0,mid=curve.getPoint(t0+span*.5);
   const deviation=Math.max(...[curve.getPoint(t0+span*.25),mid,curve.getPoint(t0+span*.75)].map(p=>distanceToSegment(p,a,b)));
   if(deviation>tolerance&&depth<14){subdivide(t0,a,t0+span*.5,mid,depth+1);subdivide(t0+span*.5,mid,t1,b,depth+1);}
   else append(b);
  };
  const a=curve.getPoint(0),b=curve.getPoint(1);append(a);subdivide(0,a,1,b,0);
 }
 if(path.autoClose&&points.length)append(points[0].clone());
 return points;
}
function loopsOfShapes(shapes){
 const loops=[];
 for(const shape of shapes)for(const [i,path] of [shape,...shape.holes].entries()){
  const loop=[];
  for(const p of flattenPath(path)){
   const q={X:Math.round(p.x*S),Y:Math.round(p.y*S)};
   if(!loop.length||loop.at(-1).X!==q.X||loop.at(-1).Y!==q.Y)loop.push(q);
  }
  if(loop.length>3&&loop[0].X===loop.at(-1).X&&loop[0].Y===loop.at(-1).Y)loop.pop();
  if(ClipperLib.Clipper.Orientation(loop)!==(i===0))loop.reverse();
  if(loop.length>2)loops.push(loop);
 }
 return loops;
}
function shapesOfLoops(loops){if(!loops.length)return[];const c=new ClipperLib.Clipper();c.AddPaths(loops,ClipperLib.PolyType.ptSubject,true);const tree=new ClipperLib.PolyTree();c.Execute(clipType.ctUnion,tree,fillType.pftNonZero,fillType.pftNonZero);const result=[];function visit(node){for(const child of node.Childs()){if(!child.IsHole()){const pts=child.Contour().map(p=>new THREE.Vector2(p.X/S-152,152-p.Y/S));const s=new THREE.Shape(pts);for(const hole of child.Childs())if(hole.IsHole())s.holes.push(new THREE.Path(hole.Contour().map(p=>new THREE.Vector2(p.X/S-152,152-p.Y/S))));result.push(s);}visit(child);}}visit(tree);return result;}
function regionLoops(region){if(region.loops)return region.loops;const transform=(region.matrix||[1,0,0,1,0,0]).join(' ');const svg='<svg xmlns="http://www.w3.org/2000/svg"><g transform="matrix('+transform+')">'+region.paths.map(p=>'<path fill="#888" fill-rule="'+(p.rule==='EVENODD'?'evenodd':'nonzero')+'" d="'+p.d+'"/>').join('')+'</g></svg>';return clip(new SVGLoader().parse(svg).paths.flatMap(p=>filledPath(p,flattenPath)));}
export function prepareAsset(asset){if(asset.sourceSVG){const parsed={...importSVG(asset.sourceSVG,asset.name),key:asset.key,sourceSVG:asset.sourceSVG};return asset.detailAssignments?compileDetailAssignments(parsed,asset.detailAssignments):parsed;}const result=structuredClone(asset);result.regions=result.regions.map(r=>({...r,loops:regionLoops(r)}));return result;}
export function mergeMetalRegions(regions,overrides={}){
 const output=[],groups=new Map();
 for(const original of regions){
  const o=overrides[original.id]||{},role=o.role||original.role;
  if(role==='hidden')continue;
  if(role!=='rim'){output.push(original);continue;}
  const key=JSON.stringify([o.color||original.overrideColor||null,o.lift||0]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(original);
 }
 for(const metal of groups.values()){
  const primary=metal.find(r=>r.id==='svg-rim')||metal[0];
  output.push({...primary,role:'rim',loops:clip(metal.flatMap(r=>r.loops)),renderLoops:clip(metal.flatMap(r=>r.renderLoops||r.loops)),mergedRegionIds:metal.map(r=>r.id)});
 }
 return output;
}

// A membrane with zero-height boundaries: solve a Poisson surface, rather than paint a gradient.
const membraneCache=new Map();
function membrane(shape){const ext=shape.extractPoints(1),cacheKey=JSON.stringify(ext);if(membraneCache.has(cacheKey))return membraneCache.get(cacheKey);const all=[...ext.shape,...ext.holes.flat()];const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x)),minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y));const step=Math.max(.4,Math.max(maxX-minX,maxY-minY)/88);const nx=Math.ceil((maxX-minX)/step)+5,ny=Math.ceil((maxY-minY)/step)+5;const ox=minX-step*2,oy=minY-step*2;const canvas=document.createElement('canvas');canvas.width=nx;canvas.height=ny;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.beginPath();for(const loop of [ext.shape,...ext.holes]){loop.forEach((p,i)=>ctx[i?'lineTo':'moveTo']((p.x-ox)/step,(p.y-oy)/step));ctx.closePath();}ctx.fill('evenodd');const rgba=ctx.getImageData(0,0,nx,ny).data,mask=new Uint8Array(nx*ny),u=new Float32Array(nx*ny);for(let i=0;i<mask.length;i++)mask[i]=rgba[i*4+3]>180?1:0;for(let k=0;k<180;k++){for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){const i=y*nx+x;if(mask[i])u[i]+=(.25*(u[i-1]+u[i+1]+u[i-nx]+u[i+nx]+1)-u[i])*1.72;}}
let max=0;for(const v of u)max=Math.max(max,v);max=Math.max(max,.001);const field=(x,y)=>{const gx=(x-ox)/step-.5,gy=(y-oy)/step-.5,ix=Math.floor(gx),iy=Math.floor(gy);if(ix<0||iy<0||ix>=nx-1||iy>=ny-1)return 0;const fx=gx-ix,fy=gy-iy,i=iy*nx+ix;const v=u[i]*(1-fx)*(1-fy)+u[i+1]*fx*(1-fy)+u[i+nx]*(1-fx)*fy+u[i+nx+1]*fx*fy;return Math.pow(Math.max(0,v/max),.62);};if(membraneCache.size>=32)membraneCache.delete(membraneCache.keys().next().value);membraneCache.set(cacheKey,field);return field;}
function domeGeometry(shape,base,rise,sharedField){const flat=new THREE.ShapeGeometry(shape,1),p=flat.attributes.position,indices=flat.index.array,field=sharedField||membrane(shape),out=[];const add=(a,b,c,depth)=>{const ab=a.distanceToSquared(b),bc=b.distanceToSquared(c),ca=c.distanceToSquared(a);if(Math.max(ab,bc,ca)>36&&depth<16){if(ab>=bc&&ab>=ca){const m=a.clone().add(b).multiplyScalar(.5);add(a,m,c,depth+1);add(m,b,c,depth+1);}else if(bc>=ca){const m=b.clone().add(c).multiplyScalar(.5);add(a,b,m,depth+1);add(a,m,c,depth+1);}else{const m=c.clone().add(a).multiplyScalar(.5);add(a,b,m,depth+1);add(m,b,c,depth+1);}}else for(const v of [a,b,c])out.push(v.x,v.y,base+rise*field(v.x,v.y));};for(let i=0;i<indices.length;i+=3)add(new THREE.Vector2(p.getX(indices[i]),p.getY(indices[i])),new THREE.Vector2(p.getX(indices[i+1]),p.getY(indices[i+1])),new THREE.Vector2(p.getX(indices[i+2]),p.getY(indices[i+2])),0);flat.dispose();const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.Float32BufferAttribute(out,3));let geom=mergeVertices(raw,.001);raw.dispose();geom.computeVertexNormals();
 {const positions=geom.attributes.position,normals=geom.attributes.normal,e=.08;for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),normal=new THREE.Vector3(-rise*(field(x+e,y)-field(x-e,y))/(2*e),-rise*(field(x,y+e)-field(x,y-e))/(2*e),1).normalize();normals.setXYZ(i,normal.x,normal.y,normal.z);}}
 return geom;}
function extrusion(shapes,depth,bevel=0,bevelHeight=bevel){return new THREE.ExtrudeGeometry(shapes,{depth:Math.max(.1,depth),...EXTRUDE_DEFAULTS,bevelEnabled:bevel>0,bevelSize:bevel,bevelOffset:-bevel,bevelThickness:bevelHeight});}
function colorOf(r){return new THREE.Color().setRGB(r.color.r,r.color.g,r.color.b,THREE.SRGBColorSpace);}
export function makeMaterial(region,settings){
 const role=region.role;
 const color=/^#[0-9a-f]{6}$/i.test(region.overrideColor)?region.overrideColor:role==='rim'?0xb5b6b2:role==='pin'?0xeaece7:role==='metal-plate'?0x9c9e9a:role==='dark-metal'?0x686a68:role==='light'?0xfafbf7:colorOf(region);
 if(role==='rim')return new THREE.MeshPhysicalMaterial({color,metalness:.25,roughness:settings.roughness,clearcoat:.08,clearcoatRoughness:.3,...(region.surface==='rim-cap'?{vertexColors:true}:{})});
 if(role==='pin')return new THREE.MeshPhysicalMaterial({color,metalness:.32,roughness:.24,clearcoat:.22,clearcoatRoughness:.25});
 if(role==='metal-plate'||role==='dark-metal')return new THREE.MeshPhysicalMaterial({color,metalness:.28,roughness:.48});
 const pigment=cleanEnamelColour(color instanceof THREE.Color?color:new THREE.Color(color),settings.enamelSaturation??1).multiplyScalar(THREE.MathUtils.clamp(settings.enamelBrightness??1,.5,1.5));
 return new THREE.MeshPhysicalMaterial({color:pigment,metalness:0,specularIntensity:.045,roughness:.25+(1-settings.gloss)*.25,clearcoat:settings.gloss*.06,clearcoatRoughness:.23});
}
function shapeSourceLoops(shape){return clip(loopsOfShapes([shape]).map(loop=>loop.map(p=>({X:p.X+152*S,Y:152*S-p.Y}))));}
function sharedEnamelFields(asset,settings,overrides){
 const groups=new Map(),fields=new Map();
 for(const r of asset.regions){const o=overrides[r.id]||{},role=o.role||r.role;if(role!=='enamel'&&role!=='light')continue;const lift=Math.max(-2,Math.min(15,Number(o.lift)||0)),key=role+'|'+lift;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const metal=asset.regions.filter(r=>(overrides[r.id]?.role||r.role)==='rim').flatMap(r=>widenRim(settings.sourceGeometry?r.loops:(r.renderLoops||r.loops),asset.strokeWidth,settings.rimWidthGain));
 for(const regions of groups.values()){
  if(regions.length<2)continue;
  const surface=clip(regions.flatMap(r=>r.loops),metal,true),shapes=shapesOfLoops(surface);
  for(const shape of shapes){
   const loops=shapeSourceLoops(shape);
   const neighbours=regions.filter(r=>polygonBoolean(r.loops,loops,clipType.ctIntersection).length);
   if(neighbours.length<2)continue;
   const patch={loops,box:new THREE.Box2().setFromPoints(shape.getPoints()),field:membrane(shape)};
   for(const r of neighbours){if(!fields.has(r.id))fields.set(r.id,[]);fields.get(r.id).push(patch);}
  }
 }
 return (id,shape)=>{
  const patches=fields.get(id);if(!patches)return undefined;
  const loops=shapeSourceLoops(shape),active=patches.filter(p=>polygonBoolean(loops,p.loops,clipType.ctIntersection).length);
  if(!active.length)return undefined;
  return(x,y)=>{let h=0;for(const p of active)if(x>=p.box.min.x&&x<=p.box.max.x&&y>=p.box.min.y&&y<=p.box.max.y)h=Math.max(h,p.field(x,y));return h;};
 };
}
export function buildBadge(asset,settings,overrides={}){const enamelFields=sharedEnamelFields(asset,settings,overrides);const model=new THREE.Group();model.name=asset.name;const allLoops=clip(asset.regions.flatMap(r=>r.loops));const backing=shapesOfLoops(allLoops);const baseMat=new THREE.MeshPhysicalMaterial({color:0x757973,metalness:.45,roughness:.42});const baseMesh=new THREE.Mesh(extrusion(backing,1.8,.65),baseMat);baseMesh.position.z=-1.9;model.add(baseMesh);const metrics={triangles:0,parts:0};
for(const original of mergeMetalRegions(asset.regions,overrides)){const override=overrides[original.id]||{},region={...original,role:override.role||original.role,overrideColor:override.color||original.overrideColor};const shapes=shapesOfLoops(region.role==='rim'?widenRim(settings.sourceGeometry?region.loops:(region.renderLoops||region.loops),asset.strokeWidth,settings.rimWidthGain):region.loops);if(!shapes.length)continue;const mat=makeMaterial(region,settings);const shift=Math.max(-2,Math.min(15,Number(override.lift)||0));let base=region.role==='rim'?settings.height:region.role==='pin'?settings.height-1:region.role==='metal-plate'?2.8:region.role==='dark-metal'?1.4:4.1;let rise=region.role==='pin'?3.7:region.role==='enamel'?settings.dome:region.role==='light'?settings.dome*.65:0;base+=shift;const meshes=[];if(region.role==='rim'){meshes.push(new THREE.Mesh(extrusion(shapes,base,0),mat));if(settings.bevel>0)meshes.push(new THREE.Mesh(roundedRimGeometry(shapes,base,settings.bevel),makeMaterial({...region,surface:'rim-cap'},settings)));}else{for(const shape of shapes){const under=new THREE.Mesh(extrusion([shape],base,0),mat);meshes.push(under);if(rise>0)meshes.push(new THREE.Mesh(domeGeometry(shape,base+.006,rise,enamelFields(region.id,shape)),mat));}}for(const m of meshes){m.name=region.role;m.userData={regionId:region.id,role:region.role,surface:region.role==='rim'&&m.geometry.type==='BufferGeometry'?'rim-cap':undefined};m.castShadow=true;m.receiveShadow=true;model.add(m);metrics.triangles+=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3;}metrics.parts++;}
model.userData.baseDepth=Math.max(.1,settings.height);metrics.drawCalls=batchByColor(model);metrics.triangles=model.children.reduce((total,m)=>total+m.geometry.attributes.position.count/3,0);model.scale.setScalar(.01);model.updateMatrixWorld(true);return{model,metrics};}
export const disposeModel=disposeRenderPipeline;

export function importSVG(text,name='Мой SVG'){return readSVG(text,name,flattenPath);}
