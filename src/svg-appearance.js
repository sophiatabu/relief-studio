import * as THREE from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {SRGBToLinear} from 'three/src/math/ColorManagement.js';
import {svgCanvasBackdrop} from './svg.js';
const cache=new Map();
export const APPEARANCE_SIZE=512;
// Native SVG paint servers retain gradientUnits, transforms, href inheritance,
// stop opacity and filter compositing. Geometry is still built from vector paths.
export function appearanceSVG(asset,assignments=asset.detailAssignments||{}, {filters=true}={}){
 if(!asset.sourceSVG||!asset.sourceBounds)return null;
 const parsed=new SVGLoader().parse(asset.sourceSVG),root=parsed.xml;
 for(const node of root.querySelectorAll('script,foreignObject'))node.remove();
 for(const node of root.querySelectorAll('*'))for(const attr of [...node.attributes])if(/^on/i.test(attr.name)||(/href$/i.test(attr.name)&&!attr.value.startsWith('#')))node.removeAttribute(attr.name);
 const vb=(root.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number);svgCanvasBackdrop(root,vb)?.remove();
 for(const [index,path]of parsed.paths.entries()){
  const node=path.userData.node;if(node.closest('defs,mask,clipPath'))continue;
  for(const [suffix,property]of [['fill','fill'],['rim','stroke']]){
   const edit=assignments[`element-${index}-${suffix}`];if(!edit)continue;
   if(edit.role==='hidden'||edit.role==='cutout'){node.setAttribute(property,'none');node.style.setProperty(property,'none');}
   else if(edit.color){node.setAttribute(property,edit.color);node.style.setProperty(property,edit.color);}
  }
 }
 for(const node of root.querySelectorAll('*')){const value=node.getAttribute('filter')||node.style.filter,id=value?.match(/#([^)'"\s]+)/)?.[1];if(id&&(!filters||assignments['effect:'+id]?.enabled===false)){node.removeAttribute('filter');node.style.filter='none';}}
 const b=asset.sourceBounds,span=Math.max(b.maxX-b.minX,b.maxY-b.minY)*304/240;
 // Preserve the original viewport clip after expanding the framing.
 if(vb.length===4&&vb.every(Number.isFinite)){
  const ns=root.namespaceURI,clip=root.ownerDocument.createElementNS(ns,'clipPath'),rect=root.ownerDocument.createElementNS(ns,'rect'),group=root.ownerDocument.createElementNS(ns,'g');
  let id='relief-paint-viewport';while(root.ownerDocument.getElementById(id))id+='x';clip.id=id;['x','y','width','height'].forEach((k,i)=>rect.setAttribute(k,vb[i]));clip.append(rect);group.setAttribute('clip-path',`url(#${id})`);while(root.firstChild)group.append(root.firstChild);root.append(clip,group);
 }
 root.setAttribute('viewBox',[(b.minX+b.maxX-span)/2,(b.minY+b.maxY-span)/2,span,span].join(' '));root.setAttribute('width',304);root.setAttribute('height',304);
 return new XMLSerializer().serializeToString(root);
}
export async function rasterAppearance(svg,size=APPEARANCE_SIZE){
 const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,size,size);return {canvas,rgba:ctx.getImageData(0,0,size,size).data};}finally{URL.revokeObjectURL(url);}
}
export async function prepareAppearance(asset){
 if(!asset.hasAppearance)return null;
 const svg=appearanceSVG(asset),key=svg;let entry=cache.get(key);if(entry)return entry;
 const {rgba}=await rasterAppearance(svg),pixels=new Float32Array(rgba.length);
 for(let i=0;i<rgba.length;i+=4){for(let c=0;c<3;c++)pixels[i+c]=SRGBToLinear(rgba[i+c]/255);pixels[i+3]=rgba[i+3]/255;}
 let exterior=null;
 if(asset.effects?.some(e=>asset.detailAssignments?.['effect:'+e.id]?.enabled!==false)){
  const plain=await rasterAppearance(appearanceSVG(asset,asset.detailAssignments,{filters:false}));
  const outside=new Uint8Array(rgba.length);let visible=false;
  for(let i=0;i<rgba.length;i+=4)if(plain.rgba[i+3]===0&&rgba[i+3]>0){outside.set(rgba.subarray(i,i+4),i);visible=true;}
  if(visible)exterior=outside;
 }
 entry={key,pixels,exterior};cache.set(key,entry);while(cache.size>4)cache.delete(cache.keys().next().value);return entry;
}

export function attachAppearanceEffects(model,appearance){
 if(!appearance?.exterior)return;
 const n=APPEARANCE_SIZE,data=new Uint8Array(appearance.exterior.length);for(let y=0;y<n;y++)data.set(appearance.exterior.subarray(y*n*4,(y+1)*n*4),(n-1-y)*n*4);
 const map=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);map.colorSpace=THREE.SRGBColorSpace;map.minFilter=map.magFilter=THREE.LinearFilter;map.needsUpdate=true;
 const geometry=new THREE.PlaneGeometry(304,304).toNonIndexed(),count=geometry.attributes.position.count;
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(count*4).fill(1),4));geometry.setAttribute('surfaceRole',new THREE.Float32BufferAttribute(new Float32Array(count),1));geometry.setAttribute('rimProfile',new THREE.Float32BufferAttribute(new Float32Array(count*3),3));
 geometry.translate(0,0,-.01);geometry.userData.badgeUV=true;
 const mesh=new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial({map,transparent:true,depthWrite:false,roughness:1,metalness:0,side:THREE.DoubleSide}));
 mesh.userData={role:'svg-effect',parts:[{role:'svg-effect',regionId:'svg-effect',start:0,count}]};mesh.material.dispose();mesh.material=new THREE.MeshBasicMaterial({map,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.CustomBlending,blendSrc:THREE.OneMinusDstAlphaFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.OneMinusDstAlphaFactor,blendDstAlpha:THREE.OneFactor,premultipliedAlpha:true});mesh.matrixAutoUpdate=false;model.svgEffectLayer=mesh;model.ownedTextures=[map];
}

const effectScene=new THREE.Scene();
export function renderAppearanceEffects(renderer,model,camera){
 const mesh=model?.svgEffectLayer;if(!mesh)return;
 const auto=renderer.autoClear;model.updateMatrixWorld(true);mesh.matrix.copy(model.matrixWorld);effectScene.add(mesh);
 try{renderer.autoClear=false;renderer.render(effectScene,camera);}finally{renderer.autoClear=auto;effectScene.remove(mesh);}
}
