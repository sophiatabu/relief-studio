import * as THREE from 'three';
import {WebGLPathTracer} from 'three-gpu-pathtracer';
import {createRenderDenoiser} from './denoise.js';
import {createContourEffects} from './contour-effects.js';
import {usePreciseGradientAtlas} from './gradient-texture.js';
import {createRenderHealthCheck} from './render-health.js';
import {MAX_EXPORT_SAMPLES} from './export-quality.js';
import {PNG_EXPORT_SIZE,PNG_EXPORT_PADDING,squareExportCamera} from './export-presets.js';

export function createExportDialog(get,onBusy,download){
 let task=null,serial=0;
 const status=document.getElementById('status'),progress=document.querySelector('.progress i');
 function stop(){
  serial++;
  if(task){cancelAnimationFrame(task.frame);if(task.fence)task.renderer.getContext().deleteSync(task.fence);task.effects?.dispose();task.denoiser?.dispose();task.tracer?.dispose();task.renderer?.dispose();task.renderer?.forceContextLoss();task=null;}
  onBusy(false);
 }
 function run(){
  if(task)return;
  const source=get();if(!source.model)return;
  const token=++serial,size=PNG_EXPORT_SIZE,padding=PNG_EXPORT_PADDING,inner=size-padding*2,samples=MAX_EXPORT_SAMPLES,transparent=true;
  task={frame:0};onBusy(true);status.textContent='Готовим PNG 1024 × 1024…';progress.style.width='0%';
  function fail(error){if(token!==serial)return;stop();status.textContent='Не удалось создать PNG: '+error.message;}
  try{
   const renderer=task.renderer=new THREE.WebGLRenderer({alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
   if(size>renderer.capabilities.maxTextureSize/2)throw Error('Недостаточно памяти для изображения 1024 × 1024.');
   renderer.setSize(size,size,false);renderer.setPixelRatio(1);renderer.toneMapping=THREE.LinearToneMapping;renderer.toneMappingExposure=source.exposure;renderer.outputColorSpace=THREE.SRGBColorSpace;
   renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();if(token===serial)fail(Error('Браузер прервал работу с видеокартой.'));});
   const scene=source.scene.clone(true),camera=squareExportCamera(source.camera);scene.background=null;
   const badge=scene.children[source.scene.children.indexOf(source.model)];badge.svgEffectLayer=source.model.svgEffectLayer;
   const tracer=task.tracer=new WebGLPathTracer(renderer);usePreciseGradientAtlas(tracer);tracer.bounces=6;tracer.filterGlossyFactor=.45;tracer.tiles.set(2,2);tracer.renderToCanvas=false;tracer.minSamples=1;tracer.renderDelay=0;tracer.fadeDuration=0;tracer.dynamicLowRes=false;
   task.denoiser=createRenderDenoiser(renderer);task.denoiser.attach(tracer);task.effects=createContourEffects(renderer);task.effects.attach(tracer,()=>({model:badge,settings:source.contour}));tracer.setScene(scene,camera);tracer.reset();const healthy=createRenderHealthCheck(),gl=renderer.getContext();
   function fence(){task.fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();}
   function frame(){
    if(token!==serial)return;
    try{
     if(task.fence){const state=gl.clientWaitSync(task.fence,0,0);if(state===gl.TIMEOUT_EXPIRED){task.frame=requestAnimationFrame(frame);return;}gl.deleteSync(task.fence);task.fence=null;if(state===gl.WAIT_FAILED)throw Error('Видеокарта не завершила расчёт.');}
     if(tracer.samples<samples){tracer.renderSample();fence();progress.style.width=Math.min(100,tracer.samples/samples*100)+'%';status.textContent=tracer.isCompiling?'Готовим освещение…':`PNG 1024 × 1024 · ${Math.min(samples,Math.floor(tracer.samples))} / ${samples}`;task.frame=requestAnimationFrame(frame);return;}
     if(!task.finalized){tracer.renderToCanvas=true;tracer.renderSample();task.finalized=true;fence();task.frame=requestAnimationFrame(frame);return;}
     if(gl.getError()!==gl.NO_ERROR)throw Error('Недостаточно видеопамяти.');
     if(!healthy(renderer.domElement))throw Error('Вместо значка получился чёрный силуэт.');
     const output=document.createElement('canvas');output.width=output.height=size;const context=output.getContext('2d',{alpha:true});
     if(!transparent){context.fillStyle='#5e5e5e';context.fillRect(0,0,size,size);}
     context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(renderer.domElement,padding,padding,inner,inner);
     output.toBlob(blob=>{if(token!==serial)return;if(!blob){fail(Error('Браузер не смог сохранить изображение.'));return;}download(blob,source.name+'-1024x1024.png');stop();progress.style.width='100%';status.textContent='Скачивание начато · PNG 1024 × 1024';},'image/png');
    }catch(error){fail(error);}
   }
   task.frame=requestAnimationFrame(frame);
  }catch(error){fail(error);}
 }
 return {open:run,get active(){return Boolean(task);}};
}
