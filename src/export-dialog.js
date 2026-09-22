import * as THREE from 'three';
import {WebGLPathTracer} from 'three-gpu-pathtracer';
import {createRenderDenoiser} from './denoise.js';
import {createContourEffects} from './contour-effects.js';
import {usePreciseGradientAtlas} from './gradient-texture.js';
import {createRenderHealthCheck} from './render-health.js';
import {DEFAULT_EXPORT_SAMPLES,MAX_EXPORT_SAMPLES,exportQualityOptions} from './export-quality.js';
import {PNG_EXPORT_PRESETS,exportInset,squareExportCamera} from './export-presets.js';
export function createExportDialog(get,onBusy,download){
 const presets=PNG_EXPORT_PRESETS.map((preset,index)=>`<label class="export-preset"><input type="radio" name="pngPreset" value="${preset.id}"${index?'':' checked'}><strong>${preset.label}</strong><span>${preset.note}</span></label>`).join('');
 const dialog=document.createElement('dialog');dialog.className='export-dialog';dialog.setAttribute('aria-label','Экспорт PNG');dialog.innerHTML=`<div class="dialog-heading"><h2>Экспорт PNG</h2><button type="button" aria-label="Закрыть экспорт">×</button></div><fieldset class="export-presets"><legend>Формат</legend>${presets}</fieldset><details class="export-advanced"><summary>Дополнительные настройки</summary><label>Размер, px<input id="pngSize" type="number" min="32" max="2048" step="1" value="304"></label><label>Поля, px<input id="pngPadding" type="number" min="0" max="151" step="0.1" value="16"></label><label>Качество<select id="pngQuality">${exportQualityOptions()}</select></label><p class="export-recommendation"><strong>Максимальное качество</strong><span>${MAX_EXPORT_SAMPLES} сэмпла уменьшают зернистость, но требуют больше времени.</span></p><label class="inline-check"><input id="pngTransparent" type="checkbox" checked> Прозрачный фон</label><p class="export-help">Серый фон редактора не добавляется в прозрачный PNG.</p></details><progress max="1" value="0" hidden></progress><p class="export-message" role="status"></p><div class="export-actions"><button class="export-cancel">Закрыть</button><button class="primary export-start">Скачать PNG</button></div>`;document.body.append(dialog);
 const message=dialog.querySelector('.export-message'),progress=dialog.querySelector('progress'),start=dialog.querySelector('.export-start'),cancel=dialog.querySelector('.export-cancel');let task=null,serial=0;
 const sizeInput=dialog.querySelector('#pngSize'),paddingInput=dialog.querySelector('#pngPadding');
 function selectPreset(id){const preset=PNG_EXPORT_PRESETS.find(item=>item.id===id)||PNG_EXPORT_PRESETS[0];sizeInput.value=String(preset.size);paddingInput.value=String(Math.round(preset.padding*10)/10);}
 for(const radio of dialog.querySelectorAll('[name="pngPreset"]'))radio.onchange=()=>selectPreset(radio.value);
 for(const input of [sizeInput,paddingInput])input.addEventListener('input',()=>{for(const radio of dialog.querySelectorAll('[name="pngPreset"]'))radio.checked=false;});
 function stop(){serial++;if(task){cancelAnimationFrame(task.frame);if(task.fence)task.renderer.getContext().deleteSync(task.fence);task.effects?.dispose();task.denoiser?.dispose();task.tracer?.dispose();task.renderer?.dispose();task.renderer?.forceContextLoss();task=null;}onBusy(false);start.disabled=false;for(const el of dialog.querySelectorAll('select,input'))el.disabled=false;cancel.textContent='Закрыть';}
 function close(){stop();dialog.close();}
 cancel.onclick=()=>{if(task){stop();message.textContent='Экспорт отменён';progress.hidden=true;}else close();};dialog.querySelector('[aria-label="Закрыть экспорт"]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 start.onclick=()=>{
  if(task)return;const source=get();if(!source.model)return;const token=++serial,{size,padding,inner}=exportInset(sizeInput.value,paddingInput.value),samples=Number(dialog.querySelector('#pngQuality').value),transparent=dialog.querySelector('#pngTransparent').checked;
  message.textContent='Готовлю PNG…';progress.hidden=false;progress.value=0;start.disabled=true;cancel.textContent='Отменить';for(const el of dialog.querySelectorAll('select,input'))el.disabled=true;onBusy(true);
  task={frame:0};
  function fail(e){stop();message.textContent='Не удалось создать PNG. Попробуйте меньший размер. '+e.message;progress.hidden=true;}
  try{
   const renderer=task.renderer=new THREE.WebGLRenderer({alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(size>renderer.capabilities.maxTextureSize/2)throw Error('Недостаточно памяти для выбранного размера.');renderer.setSize(size,size,false);renderer.setPixelRatio(1);renderer.toneMapping=THREE.LinearToneMapping;renderer.toneMappingExposure=source.exposure;renderer.outputColorSpace=THREE.SRGBColorSpace;
   renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(token===serial)fail(Error('Браузер прервал работу с видеокартой.'));});
   const scene=source.scene.clone(true),camera=squareExportCamera(source.camera);scene.background=null; // The output canvas adds the optional background after SVG effects.
   // clone() assigns UUIDs; the live badge is identified by its scene index.
   const badge=scene.children[source.scene.children.indexOf(source.model)];
   badge.svgEffectLayer=source.model.svgEffectLayer;
   const tracer=task.tracer=new WebGLPathTracer(renderer);usePreciseGradientAtlas(tracer);tracer.bounces=6;tracer.filterGlossyFactor=.45;tracer.tiles.set(size>1024?4:2,size>1024?4:2);tracer.renderToCanvas=false;tracer.minSamples=1;tracer.renderDelay=0;tracer.fadeDuration=0;tracer.dynamicLowRes=false;
   task.denoiser=createRenderDenoiser(renderer);task.denoiser.attach(tracer);task.effects=createContourEffects(renderer);task.effects.attach(tracer,()=>({model:badge,settings:source.contour}));tracer.setScene(scene,camera);tracer.reset();const healthy=createRenderHealthCheck();
   const gl=renderer.getContext();
   function fence(){task.fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();}
   function frame(){
    if(token!==serial)return;
    try{
     if(task.fence){const status=gl.clientWaitSync(task.fence,0,0);if(status===gl.TIMEOUT_EXPIRED){task.frame=requestAnimationFrame(frame);return;}gl.deleteSync(task.fence);task.fence=null;if(status===gl.WAIT_FAILED)throw Error('Видеокарта не завершила расчёт.');}
     if(tracer.samples<samples){tracer.renderSample();fence();progress.value=tracer.samples/samples;message.textContent=tracer.isCompiling?'Готовлю освещение…':`PNG ${size} × ${size} · ${Math.min(samples,Math.floor(tracer.samples))} / ${samples} сэмплов`;task.frame=requestAnimationFrame(frame);return;}
     // Denoise and composite only the final export, not every tracing tile.
     if(!task.finalized){tracer.renderToCanvas=true;tracer.renderSample();task.finalized=true;fence();task.frame=requestAnimationFrame(frame);return;}
     if(gl.getError()!==gl.NO_ERROR)throw Error('Недостаточно видеопамяти.');
     if(!healthy(renderer.domElement))throw Error('Расчёт завершился ошибкой: вместо значка получился чёрный силуэт.');
     const output=document.createElement('canvas');output.width=output.height=size;const context=output.getContext('2d',{alpha:true});if(!transparent){context.fillStyle='#5e5e5e';context.fillRect(0,0,size,size);}context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(renderer.domElement,padding,padding,inner,inner);
     output.toBlob(blob=>{if(token!==serial)return;if(!blob){fail(Error('Браузер не смог сохранить изображение.'));return;}download(blob,source.name+'-relief-'+size+'.png');stop();progress.value=1;message.textContent=`Скачивание начато · ${size} × ${size} px · поля ${Math.round(padding*10)/10} px`;},'image/png');
    }catch(e){fail(e);}
   }
   task.frame=requestAnimationFrame(frame);
  }catch(e){fail(e);}
 };
 return {open(){if(!get().model)return;const standard=dialog.querySelector('[name="pngPreset"][value="standard"]');standard.checked=true;selectPreset('standard');dialog.querySelector('#pngQuality').value=String(DEFAULT_EXPORT_SAMPLES);dialog.querySelector('#pngTransparent').checked=true;dialog.querySelector('.export-advanced').open=false;message.textContent='';progress.hidden=true;dialog.showModal();},get active(){return Boolean(task);}};
}
