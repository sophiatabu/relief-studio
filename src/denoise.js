import {Color,DoubleSide,MeshNormalMaterial,NearestFilter,WebGLRenderTarget} from 'three';
import {DenoiseMaterial} from 'three-gpu-pathtracer';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

// Filter neighbours only when they belong to the same surface orientation.
// A narrow bevel highlight must not be averaged into the adjacent flat metal.
export function createRenderDenoiser(renderer){
 const material=new DenoiseMaterial({sigma:1.2,kSigma:1.5,threshold:.12,premultipliedAlpha:renderer.getContextAttributes().premultipliedAlpha});
 material.uniforms.normalGuide={value:null};material.uniforms.useNormalGuide={value:false};
 material.fragmentShader=material.fragmentShader
  .replace('uniform sampler2D map;','uniform sampler2D map;\nuniform sampler2D normalGuide;\nuniform bool useNormalGuide;')
  .replace('zBuff += deltaFactor;','if (useNormalGuide) { vec4 deltaNormal = texture2D(normalGuide, uv + d / size) - texture2D(normalGuide, uv); deltaFactor *= exp(-dot(deltaNormal, deltaNormal) * 128.0); }\nzBuff += deltaFactor;')
  .replace('#include <tonemapping_fragment>','gl_FragColor.rgb = gl_FragColor.a > 0.00001 ? gl_FragColor.rgb / gl_FragColor.a : vec3(0.0);\ngl_FragColor.a = texture2D(map, vUv).a;\n#include <tonemapping_fragment>');
 const quad=new FullScreenQuad(material),guide=new WebGLRenderTarget(1,1,{minFilter:NearestFilter,magFilter:NearestFilter}),normalMaterial=new MeshNormalMaterial({side:DoubleSide});
 let lastSample=Infinity,lastScene=null,lastCamera=null;
 function updateGuide(target,scene,camera){
  guide.setSize(target.width,target.height);
  const state={target:renderer.getRenderTarget(),autoClear:renderer.autoClear,clearColor:renderer.getClearColor(new Color()),clearAlpha:renderer.getClearAlpha(),override:scene.overrideMaterial,background:scene.background};
  try{scene.overrideMaterial=normalMaterial;scene.background=null;renderer.autoClear=true;renderer.setClearColor(0,0);renderer.setRenderTarget(guide);renderer.render(scene,camera);}
  finally{scene.overrideMaterial=state.override;scene.background=state.background;renderer.setRenderTarget(state.target);renderer.setClearColor(state.clearColor,state.clearAlpha);renderer.autoClear=state.autoClear;}
  material.uniforms.normalGuide.value=guide.texture;
 }
 return {
  draw(target,scene,camera,refresh=true){
   const guided=Boolean(scene&&camera);if(guided&&refresh)updateGuide(target,scene,camera);
   material.uniforms.useNormalGuide.value=guided;material.map=target.texture;material.opacity=1;
   const autoClear=renderer.autoClear;try{renderer.autoClear=false;quad.render(renderer);}finally{renderer.autoClear=autoClear;}
  },
  attach(tracer){const fallback=tracer.renderToCanvasCallback;tracer.renderToCanvasCallback=(target,r,q)=>{
   if(tracer.samples>=16&&q.material.opacity===1){const refresh=tracer.samples<=lastSample||lastScene!==tracer.scene||lastCamera!==tracer.camera||guide.width!==target.width||guide.height!==target.height;this.draw(target,tracer.scene,tracer.camera,refresh);lastSample=tracer.samples;lastScene=tracer.scene;lastCamera=tracer.camera;}
   else{lastSample=Infinity;fallback(target,r,q);}
  };},
  dispose(){quad.dispose();material.dispose();normalMaterial.dispose();guide.dispose();}
 };
}
