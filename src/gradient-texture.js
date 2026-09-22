import * as THREE from 'three';
import {LinearToSRGB} from 'three/src/math/ColorManagement.js';
export function gradientTexture(size){
 const data=new Uint16Array(size*size*4),texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat,THREE.HalfFloatType);
 texture.colorSpace=THREE.LinearSRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;
 texture.userData.reliefGradient=true;return texture;
}
export function setGradientPixel(texture,index,r,g,b){
 const data=texture.image.data,toHalf=THREE.DataUtils.toHalfFloat;
 data[index]=toHalf(r);data[index+1]=toHalf(g);data[index+2]=toHalf(b);data[index+3]=toHalf(1);
}
// Keep the atlas precise without the half-float array sampling failure seen in
// the embedded browser. Source maps can stay half float; the shared atlas uses
// full float so dark gradients remain continuous instead of reverting to 8-bit.
export function usePreciseGradientAtlas(tracer){
 const atlas=tracer._pathTracer.material.textures;
 atlas.type=THREE.FloatType;atlas.needsUpdate=true;
 // Generated maps are 512²; avoid quadrupling their atlas memory by upscaling.
 tracer.textureSize.set(512,512);
}
// glTF embeds 8-bit PNGs. Quantize once, in sRGB, with sub-LSB neutral dithering.
export function exportGradientTexture(source){
 const {width,height,data}=source.image,out=new Uint8Array(width*height*4);
 for(let i=0;i<out.length;i+=4){let hash=Math.imul(i/4+1,0x45d9f3b);hash=Math.imul(hash^(hash>>>16),0x45d9f3b);const noise=((hash^(hash>>>16))>>>0)/4294967296-.5;
  for(let c=0;c<3;c++)out[i+c]=Math.max(0,Math.min(255,Math.round(LinearToSRGB(THREE.DataUtils.fromHalfFloat(data[i+c]))*255+noise)));
  out[i+3]=255;
 }
 const texture=new THREE.DataTexture(out,width,height,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
export function modelForGLTF(model){
 const copy=model.clone(true),materials=[],textures=new Map();
 copy.traverse(mesh=>{if(!mesh.isMesh)return;mesh.material=mesh.material.clone();materials.push(mesh.material);
  const map=mesh.material.map;if(map?.userData.reliefGradient){if(!textures.has(map))textures.set(map,exportGradientTexture(map));mesh.material.map=textures.get(map);}
 });
 return {model:copy,dispose(){materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
