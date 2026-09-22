import * as THREE from 'three';
import {createRenderDenoiser} from '../src/denoise.js';
const out=document.querySelector('#status');
const renderer=new THREE.WebGLRenderer({alpha:true,preserveDrawingBuffer:true});renderer.setSize(64,64,false);renderer.toneMapping=THREE.LinearToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;document.querySelector('#output').append(renderer.domElement);
const denoiser=createRenderDenoiser(renderer),data=new Float32Array(64*64*4);
const results=[];
for(const alpha of [0,.25,.5,1]){
 for(let i=0;i<64*64;i++)data.set([.25,.1,.02,alpha],i*4);
 const texture=new THREE.DataTexture(data,64,64,THREE.RGBAFormat,THREE.FloatType);texture.needsUpdate=true;
 denoiser.draw({texture});
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);const pixel=Array.from(ctx.getImageData(32,32,1,1).data);
 const expected=new THREE.Color(.25,.1,.02).convertLinearToSRGB().toArray().map(n=>Math.round(n*255));
 const passed=Math.abs(pixel[3]-Math.round(alpha*255))<=1&&(alpha===0||pixel.slice(0,3).every((n,i)=>Math.abs(n-expected[i])<=3));
 results.push({alpha,pixel,expected,passed});texture.dispose();
}
out.textContent=JSON.stringify(results);denoiser.dispose();
