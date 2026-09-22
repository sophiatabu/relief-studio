import {prepareAppearance,attachAppearanceEffects} from './svg-appearance.js';
import {createDetailEditor} from './detail-editor.js';
import {compileDetailAssignments} from './detail-document.js';
import { disposeRenderPipeline, setModelDepth, refreshBatchMaterials, createRenderScheduler } from './render-pipeline.js';
import {setupPanelWorkspace} from './panel-workspace.js';
import {installHelp} from './help-tooltips.js';
import {createHistory} from './editor-history.js';

import {createExportDialog} from './export-dialog.js';
import {resetButton,inlineReset,showReset} from './reset-button.js';
import {createContourMarkers} from './contour-markers.js';
import {createContourEffects} from './contour-effects.js';
import {normalizeContour,migrateContourDefaults,contourSources,applyContourMaterials} from './contour-settings.js';
import {createContourControls} from './contour-controls.js';
import {createRenderDenoiser} from './denoise.js';
import {createRenderHealthCheck} from './render-health.js';
import {createLightCards} from './light-cards.js';
import {setupReferenceZoom} from './reference-zoom.js';
import {previewBufferDimensions} from './preview-resolution.js';
import {addIcon} from './ui-icons.js';
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { prepareAsset,buildBadge,disposeModel,importSVG,makeMaterial } from './geometry.js';
import {LIGHT_DEFAULTS,highlightSource,normalizeLights,syncLightRig,moveLightOnScreen} from './lighting.js';
import {STUDIO,migrateColourBalance,migrateAppearance} from './studio.js';
import {createDarkness} from './darkness.js';
import {usePreciseGradientAtlas,modelForGLTF} from './gradient-texture.js';
import {validateSVG} from './validate-svg.js';
import {updateRimHighlight} from './rim-highlight.js';
import {showSourcePreview} from './source-preview.js';
async function checkedAsset(raw){const parsed=prepareAsset({...raw,detailAssignments:undefined});if(raw.sourceSVG){await validateSVG(raw.sourceSVG,parsed);parsed.sourceSVG=raw.sourceSVG;}return raw.detailAssignments?compileDetailAssignments(parsed,raw.detailAssignments):parsed;}
const darkness=createDarkness();

const $=id=>document.getElementById(id),defaults={...STUDIO.appearance,...LIGHT_DEFAULTS,fill:STUDIO.fill,exposure:STUDIO.exposure};
const publicAsset=name=>new URL(`${import.meta.env.BASE_URL}assets/${name}`,window.location.href).href;
const freshSettings=()=>({...defaults,renderMode:'physical',showLights:true});
const freshSources=()=>STUDIO.sources.map(source=>({...source}));
let settings=freshSettings(),assetKey='custom',asset=null,model=null,overrides={},busy=false,geometryTimer=null,buildVersion=0,loadVersion=0,exporting=false,desiredSamples=128,view='front';const cache=new Map();
let materialUpdateTimer=null,lightUpdateTimer=null,detailEditing=false;
let history=null,historyAsset=null,selection=null,activeSection="highlight",settingsVisible=true,pointerTransaction=false,keyTransaction=false;
function checkpoint(){queueMicrotask(()=>history?.commit());}
function beginPointerHistory(){if(!asset||exporting||pointerTransaction)return;pointerTransaction=true;history?.begin();}
function endPointerHistory(){if(!pointerTransaction)return;pointerTransaction=false;queueMicrotask(()=>history?.end());}
function sectionChanged(key,open){if(open)activeSection=key;else if(activeSection===key)activeSection=null;updateLightMarkers();}
const appearanceKeys=['height','bevel','dome','roughness','gloss','enamelSaturation','enamelBrightness','rimHighlight','rimHighlightWidth','metalShadeGain'];
try{const saved=migrateAppearance(JSON.parse(localStorage.getItem('relief-appearance-v1')));for(const k of appearanceKeys)if(Number.isFinite(saved?.[k]))settings[k]=Math.min(Number($(k).max),Math.max(Number($(k).min),saved[k]));}catch{}
function saveAppearance(){checkpoint();try{localStorage.setItem('relief-appearance-v1',JSON.stringify(Object.fromEntries(appearanceKeys.map(k=>[k,settings[k]]))));}catch{}}
let savedLighting=null;try{savedLighting=JSON.parse(localStorage.getItem('relief-studio-lighting-v1'));}catch{}
savedLighting=migrateColourBalance(savedLighting);
let sources=normalizeLights(savedLighting?.sources||freshSources()),selectedLight=sources.find(s=>s.kind==='dark')?.id||sources[0].id,lightSerial=sources.length;
const sourceObjects=new Map(),sourceKeys=Object.keys(LIGHT_DEFAULTS),selectedSource=()=>sources.find(s=>s.id===selectedLight)||sources[0];
for(const k of ['fill','exposure'])if(Number.isFinite(savedLighting?.[k]))settings[k]=savedLighting[k];
function saveLighting(){checkpoint();try{localStorage.setItem('relief-studio-lighting-v1',JSON.stringify({profile:STUDIO.version,sources,fill:settings.fill,exposure:settings.exposure}));}catch{}}

let contour;try{const saved=migrateContourDefaults(JSON.parse(localStorage.getItem('relief-contour-v1')));contour=normalizeContour(saved,Boolean(savedLighting)&&!saved);if(saved&&saved.facet===undefined)contour.facet=true;}catch{contour=normalizeContour(null);}
function saveContour(){checkpoint();try{localStorage.setItem('relief-contour-v1',JSON.stringify(contour));}catch{}}
const effectiveSources=()=>contourSources(sources,contour);
const rimSettings=()=>contour.enabled?{...settings,rimHighlight:0}:settings;
saveContour();saveLighting();
const names={robot:'Роборука',meditation:'Медитация',sneaker:'Кроссовок',paw:'Лапка',car:'Машина',seams:'Стык поверхностей'};
const roleNames={enamel:'Поверхность',rim:'Контур',pin:'Поверхность · выпуклая',light:'Поверхность · светлая','metal-plate':'Поверхность · металл','dark-metal':'Поверхность · тёмный металл'};
function error(e){console.error(e);$('error').hidden=false;$('error').textContent='Не получилось завершить действие: '+e.message;busy=false;$('status').textContent='Не удалось выполнить действие';}
window.addEventListener('error',e=>error(e.error||new Error(e.message)));window.addEventListener('unhandledrejection',e=>error(e.reason instanceof Error?e.reason:new Error(String(e.reason))));
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(1);renderer.setSize(448,448,false);renderer.toneMapping=THREE.LinearToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;$('viewport').appendChild(renderer.domElement);const scene=new THREE.Scene();scene.background=null;const camera=new THREE.OrthographicCamera(-1.52,1.52,1.52,-1.52,.01,50);camera.position.set(0,0,7);camera.lookAt(0,0,0);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,.04);controls.enablePan=true;controls.screenSpacePanning=true;controls.mouseButtons.RIGHT=null;controls.minZoom=.55;controls.maxZoom=3;controls.enableDamping=false;controls.minPolarAngle=.12;controls.maxPolarAngle=Math.PI-.12;
RectAreaLightUniformsLib.init();const fill=new THREE.RectAreaLight(0xf3f7ff,3,3,3);fill.position.set(2,-.5,3.5);fill.lookAt(0,0,0);scene.add(fill);const envData=new Float32Array(32*16*4);for(let i=0;i<32*16;i++){const y=Math.floor(i/32)/16,v=.18+.08*(1-y);envData.set([v,v,v,1],i*4);}const env=new THREE.DataTexture(envData,32,16,THREE.RGBAFormat,THREE.FloatType);env.mapping=THREE.EquirectangularReflectionMapping;env.needsUpdate=true;scene.environment=env;scene.environmentIntensity=.85;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x20221f,roughness:1,metalness:0}));ground.position.z=-.034;ground.receiveShadow=true;
let tracer=null;const denoiser=createRenderDenoiser(renderer),contourEffects=createContourEffects(renderer);
const contourControls=createContourControls($('contourControls'),()=>contour,(key,value)=>{contour[key]=value;saveContour();contourControls.update();refreshResetVisibility();updateLightMarkers();if(key==='enabled'){renderLightPicker();light();updatePresentation();if(model&&tracer)tracer.setScene(scene,camera);resetTrace();contourEffects.invalidateGeometry();}else{contourEffects.invalidate();contourEffects.redraw(contour);}},sectionChanged);
contourControls.update();
const physical=()=>true;
function ensureTracer(){
 if(!tracer){tracer=new WebGLPathTracer(renderer);usePreciseGradientAtlas(tracer);tracer.bounces=6;tracer.filterGlossyFactor=.45;tracer.tiles.set(1,1);tracer.minSamples=1;tracer.renderDelay=80;tracer.fadeDuration=150;tracer.dynamicLowRes=true;tracer.lowResScale=.45;denoiser.attach(tracer);contourEffects.attach(tracer,()=>({model,settings:contour}));}
 return tracer;
}
let lightDrag=null;
const markers=document.createElement('div');markers.className='light-markers';$('viewport').append(markers);
const contourMarkers=createContourMarkers($('viewport'),camera,controls,()=>({model,settings:contour,visible:settings.showLights}), (kind,angle)=>{contour[kind+'Angle']=angle;saveContour();contourControls.update();contourMarkers.update();contourEffects.invalidate();contourEffects.redraw(contour);},beginPointerHistory,endPointerHistory);
function updateLightMarkers(){
 contourMarkers.update();
 markers.hidden=!settings.showLights||!model;markers.replaceChildren();
 if(markers.hidden)return;
 camera.updateMatrixWorld();
 effectiveSources().forEach((source,i)=>{
  if(contour.enabled&&source.shape==='strip')return;
  const lamp=sourceObjects.get(source.id);if(!lamp)return;
  const p=lamp.position.clone().project(camera),extent=Math.max(1,Math.abs(p.x)/.70,Math.abs(p.y)/.86);
  const dot=document.createElement('button');dot.className='light-marker'+(source.kind==='dark'?' dark':'')+(source.id===selectedLight?' selected':'')+(source.enabled?'':' off');
  const markerLeft=50+50*p.x/extent,markerTop=Math.max(18,50-50*p.y/extent);
  dot.style.left=markerLeft+'%';dot.style.top=markerTop+'%';dot.style.setProperty('--lamp-color',source.color);
  const isDark=source.kind==='dark',kindLabel=isDark?'Затемнение':source.shape==='strip'?'Блики':'Свет';
  const number=sources.slice(0,i+1).filter(s=>s.kind===source.kind&&(s.shape==='strip')===(source.shape==='strip')).length;
  const icon=document.createElement('span');icon.className='source-icon';icon.textContent=isDark?'◐':source.shape==='strip'?'✦':'☀';icon.setAttribute('aria-hidden','true');
  const caption=document.createElement('span');caption.textContent=kindLabel+(sources.filter(s=>s.kind===source.kind&&(s.shape==='strip')===(source.shape==='strip')).length>1?' '+number:'');
  dot.append(icon,caption);dot.dataset.lightId=source.id;dot.title=source.name+' · перетащите для перемещения'+(extent>1?' · источник за краем кадра':'');dot.setAttribute('aria-label',kindLabel+': '+source.name+'. Перетащите, чтобы переместить');dot.setAttribute('aria-pressed',String(source.id===selectedLight));
  dot.onpointerdown=e=>beginLightDrag(e,source.id);
  dot.onclick=e=>{e.stopPropagation();selectedLight=source.id;renderLightPicker();updateLightMarkers();};markers.append(dot);
 });
}
function beginLightDrag(event,id){
 if(event.button!==0||lightDrag)return;
 event.preventDefault();event.stopPropagation();
 const lamp=sourceObjects.get(id);if(!lamp)return;
 beginPointerHistory();
 camera.updateMatrixWorld();selectedLight=id;
 lightDrag={id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false,depth:lamp.position.clone().project(camera).z,controlsEnabled:controls.enabled};
 controls.enabled=false;
 // Capture on the stable overlay: its marker children are refreshed with the light.
 markers.setPointerCapture(event.pointerId);markers.classList.add('dragging');
 renderLightPicker();updateLightMarkers();
}
function dragLight(event){
 if(!lightDrag||event.pointerId!==lightDrag.pointerId)return;
 event.preventDefault();event.stopPropagation();
 if(!lightDrag.moved&&Math.hypot(event.clientX-lightDrag.startX,event.clientY-lightDrag.startY)<3)return;
 lightDrag.moved=true;
 const source=sources.find(s=>s.id===lightDrag.id);if(!source){endLightDrag();return;}
 const rect=markers.getBoundingClientRect();
 const x=THREE.MathUtils.clamp((event.clientX-rect.left)/rect.width*2-1,-.9,.9);
 const y=THREE.MathUtils.clamp(1-(event.clientY-rect.top)/rect.height*2,-.9,.9);
 moveLightOnScreen(source,camera,x,y,lightDrag.depth);
 mirrorPrimary();updateLightMarkers();scheduleLightRefresh();
}
function endLightDrag(event){
 if(!lightDrag||(event&&event.pointerId!==lightDrag.pointerId))return;
 const previous=lightDrag;lightDrag=null;controls.enabled=previous.controlsEnabled;markers.classList.remove('dragging');
 if(markers.hasPointerCapture(previous.pointerId))markers.releasePointerCapture(previous.pointerId);
 endPointerHistory();
}
markers.addEventListener('pointermove',dragLight);
markers.addEventListener('pointerup',event=>{dragLight(event);flushLightRefresh();endLightDrag(event);});
markers.addEventListener('pointercancel',endLightDrag);
markers.addEventListener('lostpointercapture',endLightDrag);
window.addEventListener('blur',()=>endLightDrag());

function updatePresentation(target=model){
 if(!target)return;
 applyContourMaterials(target,contour);darkness.update(target,effectiveSources(),undefined,settings);updateRimHighlight(target,rimSettings(),effectiveSources());
}
function updateModeUI(){$('showLights').checked=settings.showLights;}
$('showLights').onchange=()=>{settings.showLights=$('showLights').checked;updateLightMarkers();};
function light(){syncLightRig(scene,sourceObjects,effectiveSources());fill.intensity=settings.fill*6;scene.environmentIntensity=.20+settings.fill;renderer.toneMappingExposure=settings.exposure;updateLightMarkers();}
function refreshLight(){saveLighting();light();const rimChanged=updateRimHighlight(model,rimSettings(),effectiveSources());darkness.update(model,effectiveSources(),undefined,settings);if(tracer?.scene===scene){if(rimChanged)tracer.setScene(scene,camera);else{tracer.updateMaterials();tracer.updateLights();tracer.updateEnvironment();}}resetTrace();}
function scheduleLightRefresh(delay=90){clearTimeout(lightUpdateTimer);lightUpdateTimer=setTimeout(()=>{lightUpdateTimer=null;refreshLight();},delay);}
function flushLightRefresh(){if(!lightUpdateTimer)return;clearTimeout(lightUpdateTimer);lightUpdateTimer=null;refreshLight();}
function mirrorPrimary(){for(const k of sourceKeys)settings[k]=sources[0][k];}
function sourceBase(source){return normalizeLights(freshSources()).find(s=>s.kind===source.kind&&s.shape===source.shape)||normalizeLights([highlightSource()])[0];}
function sourceDirty(source,key){const base=sourceBase(source);if(key)return source[key]!==base[key];return ['enabled','power','softness','blendMode','richness','color','azimuth','elevation','distance','surfaceInfluence','contourInfluence'].some(field=>source[field]!==base[field]);}
const lightCards=createLightCards($('lightCards'),{
 reset(source,key){const base=sourceBase(source);if(key)source[key]=base[key];else{const {id,name}=source;Object.assign(source,base,{id,name});}mirrorPrimary();renderLightPicker();refreshLight();},
 dirty:sourceDirty,
 change(source){selectedLight=source.id;mirrorPrimary();displayValues();scheduleLightRefresh();},
 remove(id){if(sources.length===1)return;sources=sources.filter(s=>s.id!==id);if(selectedLight===id)selectedLight=sources[0].id;mirrorPrimary();renderLightPicker();refreshLight();}
});
function renderLightPicker(){
 lightCards.render(contour.enabled?sources.filter(s=>s.shape!=='strip'):sources,selectedLight);
 $('addHighlight').hidden=contour.enabled;for(const id of ['rimHighlight','rimHighlightWidth']){const row=$(id).closest('label');row.hidden=contour.enabled;if(row.nextElementSibling?.classList.contains('reset-control'))row.nextElementSibling.hidden=contour.enabled;}$('legacyHighlightHelp').hidden=contour.enabled;
 $('addHighlight').disabled=sources.length>=8;$('addLight').disabled=sources.length>=8;$('addDarkness').disabled=sources.length>=8;displayValues();
}
$('addLight').onclick=()=>{
 if(sources.length>=8)return;
 const s={...LIGHT_DEFAULTS,id:'added-'+lightSerial,kind:'light',name:'Свет '+(++lightSerial),power:.45,azimuth:130,elevation:35,enabled:true,color:'#f3f7ff'};
 sources.push(s);selectedLight=s.id;renderLightPicker();refreshLight();
};
$('addHighlight').onclick=()=>{if(sources.length>=8)return;const s={...highlightSource(),id:'added-'+lightSerial++};sources.push(s);selectedLight=s.id;renderLightPicker();refreshLight();};
$('addDarkness').onclick=()=>{if(sources.length>=8)return;const s={...LIGHT_DEFAULTS,kind:'dark',blendMode:'multiply',richness:.35,id:'added-'+lightSerial,name:'Затемнение '+(++lightSerial),power:.3,softness:3,azimuth:-135,elevation:25,distance:1.8,enabled:true,color:'#36313f'};sources.push(s);selectedLight=s.id;renderLightPicker();refreshLight();};
let finalCompositeSamples=-1;
function resetTrace(){
 finalCompositeSamples=-1;renderFailed=false;healthChecked=false;$('error').hidden=true;tracer?.reset();$('samples').textContent='0 / '+(exporting?512:desiredSamples);$('progress').style.width='0%';$('status').textContent='Уточняем изображение…';requestRender();
}
controls.addEventListener('change',()=>{if(physical())tracer?.updateCamera();updateLightMarkers();resetTrace();refreshResetVisibility();});
function displayValues(){
 for(const k of Object.keys(defaults)){
  if(sourceKeys.includes(k))continue;
  const value=settings[k];$(k).value=value;
  $(k+'Value').textContent=['height','bevel','dome'].includes(k)?value.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+' ед.':Math.round(value*100)+'%';
 }
 lightCards.update(sources,selectedLight);
 refreshResetVisibility();
}
function cancelGeometryUpdate(){clearTimeout(geometryTimer);geometryTimer=null;}
async function rebuild(){
 if(!asset)return;
 cancelGeometryUpdate();
 const version=++buildVersion,source=asset;
 busy=true;$('status').textContent='Создаём объём из SVG…';if(typeof uploadProgress!=='undefined'&&!uploadProgress.hidden)setUploadProgress(68,'Строим объём…');
 await new Promise(r=>requestAnimationFrame(r));
 if(version!==buildVersion)return;
 let nextModel=null;
 try{
  const previous=model;
  const appearance=await prepareAppearance(source);if(version!==buildVersion)return;
  const built=buildBadge(source,settings,overrides);nextModel=built.model;nextModel.svgAppearance=appearance;attachAppearanceEffects(nextModel,appearance);
  if(previous)scene.remove(previous);
  scene.add(nextModel);
  try{light();updatePresentation(nextModel);scene.updateMatrixWorld(true);if(physical())ensureTracer().setScene(scene,camera);}
  catch(e){scene.remove(nextModel);if(previous)scene.add(previous);throw e;}
  model=nextModel;nextModel=null;if(typeof uploadProgress!=='undefined'&&!uploadProgress.hidden)setUploadProgress(90,'Подготавливаем рендер…');if(historyAsset!==asset){historyAsset=asset;selection?.clear();syncSelectionRows();history?.reset();}else checkpoint();
  document.body.classList.remove('empty-studio');$('uploadPrompt').hidden=true;$('exportButton').disabled=false;const compareButton=$('compareRender');if(compareButton)compareButton.disabled=false;updateLightMarkers();
  if(previous)disposeModel(previous);
  resetTrace();window.reliefMetrics={...built.metrics,key:source.key,studio:STUDIO.version,mode:'physical'};return true;
 }catch(e){if(nextModel)disposeModel(nextModel);error(e);return false;}
 finally{if(version===buildVersion){busy=false;startAnimation();}}
}
let depthUpdateFrame=null;
function updateDepth(){
 if(!setModelDepth(model,settings.height))return;
 checkpoint();contourEffects.invalidateGeometry();
 if(depthUpdateFrame!==null)return;
 depthUpdateFrame=requestAnimationFrame(()=>{depthUpdateFrame=null;if(!model)return;if(tracer)tracer.setScene(scene,camera);resetTrace();});
}
function updateMaterials(){checkpoint();
 if(!model)return;
 const pigments=model.children.map(m=>m.userData.colorKey).join('|');
 const changedGeometry=refreshBatchMaterials(model,(part,old)=>{
  const r=asset.regions.find(r=>r.id===part.regionId);
  if(!r)return old.clone();
  const override=overrides[r.id]||{};
  return makeMaterial({...r,role:override.role||r.role,overrideColor:override.color||r.overrideColor,surface:part.surface},settings);
 });
 updatePresentation();
 if(physical()){if(changedGeometry||pigments!==model.children.map(m=>m.userData.colorKey).join('|'))ensureTracer().setScene(scene,camera);else {ensureTracer().updateMaterials();if(!contour.enabled)ensureTracer().setScene(scene,camera);}}
 resetTrace();refreshResetVisibility();
}
function updateRimHighlights(){
 if(!model)return;
 updateRimHighlight(model,rimSettings(),effectiveSources());
 // Vertex colours must also reach the path tracer's packed attribute texture.
 // Updating only material uniforms cannot change a spatial highlight stripe.
 ensureTracer().setScene(scene,camera);resetTrace();
}
function renderParts(){
 if(!asset)return;
 const rim=asset.regions.find(r=>(overrides[r.id]?.role||r.role)==='rim');
 if(rim){const m=makeMaterial({...rim,overrideColor:overrides[rim.id]?.color},settings);$('rimColor').value='#'+m.color.getHexString();m.dispose();}
 showSourcePreview(asset);const root=$('parts');root.replaceChildren();
 for(const [i,r]of asset.regions.entries()){
  const row=document.createElement('div');row.className='part-row';row.dataset.regionId=String(r.id);row.tabIndex=0;row.onclick=()=>selectPart(r.id,false);row.onkeydown=e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectPart(r.id,false);}};
  const sw=document.createElement('span');sw.className='swatch';sw.style.background=`rgb(${r.color.r*255},${r.color.g*255},${r.color.b*255})`;const label=document.createElement('span');label.textContent=(i+1)+'. '+roleNames[overrides[r.id]?.role||r.role];
  const color=document.createElement('input');color.type='color';color.setAttribute('aria-label','Цвет детали '+(i+1));const preview=makeMaterial({...r,role:overrides[r.id]?.role||r.role,overrideColor:overrides[r.id]?.color},settings);color.value='#'+preview.color.getHexString();preview.dispose();sw.style.background=color.value;color.oninput=()=>{overrides[r.id]={...overrides[r.id],color:color.value};sw.style.background=color.value;updateMaterials();};
  const sel=document.createElement('select');sel.setAttribute('aria-label','Материал детали '+(i+1));for(const[k,name]of Object.entries(roleNames)){const o=document.createElement('option');o.value=k;o.textContent=name;sel.append(o);}sel.value=overrides[r.id]?.role||r.role;sel.onchange=()=>{overrides[r.id]={...overrides[r.id],role:sel.value};renderParts();rebuild();};
  const lift=document.createElement('input');lift.type='number';lift.min='-2';lift.max='15';lift.step='.5';lift.value=overrides[r.id]?.lift||0;lift.title='Сдвиг по высоте относительно исходного положения. Минус — ниже, плюс — выше.';lift.setAttribute('aria-label','Сдвиг по высоте детали '+(i+1));lift.oninput=()=>{if(lift.value==='')return;overrides[r.id]={...overrides[r.id],lift:Math.min(15,Math.max(-2,Number(lift.value)||0))};checkpoint();cancelGeometryUpdate();geometryTimer=setTimeout(rebuild,180);refreshResetVisibility();};
  const colourReset=resetButton('Сбросить цвет детали '+(i+1),()=>{if(overrides[r.id])delete overrides[r.id].color;renderParts();updateMaterials();}),detailReset=resetButton('Сбросить материал и высоту детали '+(i+1),()=>{if(overrides[r.id]){delete overrides[r.id].role;delete overrides[r.id].lift;}renderParts();rebuild();});showReset(colourReset,overrides[r.id]?.color!==undefined);showReset(detailReset,overrides[r.id]?.role!==undefined||overrides[r.id]?.lift!==undefined);
  const detail=document.createElement('details');detail.className='part-details';const summary=document.createElement('summary');summary.textContent='Материал и положение';detail.append(summary,sel,lift,detailReset);row.append(sw,label,color,colourReset,detail);root.append(row);
 }
 syncSelectionRows();refreshResetVisibility();
}
async function loadAsset(keyName){
 const version=++loadVersion,previousAsset=asset,previousKey=assetKey,previousOverrides=overrides;
 cancelGeometryUpdate();++buildVersion;
 busy=true;$('status').textContent='Загружаем SVG…';
 document.querySelectorAll('[data-asset]').forEach(b=>b.classList.toggle('active',b.dataset.asset===keyName));
 try{
  if(!cache.has(keyName)){
   const res=await fetch(publicAsset(keyName+'.json'));
   if(!res.ok)throw Error('Не найден исходный макет');
   cache.set(keyName,await checkedAsset(await res.json()));
  }
  if(version!==loadVersion)return;
  assetKey=keyName;asset={...cache.get(keyName)};overrides={};
  renderParts();if(!await rebuild())throw Error('Не удалось построить макет');
 }catch(e){if(version===loadVersion){asset=previousAsset;assetKey=previousKey;overrides=previousOverrides;renderParts();busy=false;throw e;}}
}
const testSVGDialog=$('testSVGDialog');for(const id of ['chooseTestSVG','startTestSVG'])$(id).onclick=()=>testSVGDialog.showModal();$('closeTestSVG').onclick=()=>testSVGDialog.close();
document.querySelectorAll('[data-asset]').forEach(button=>{button.onclick=()=>{if(exporting)return;testSVGDialog.close();loadAsset(button.dataset.asset).catch(error);};});
$('rimColor').oninput=()=>{for(const r of asset.regions)if((overrides[r.id]?.role||r.role)==='rim')overrides[r.id]={...overrides[r.id],color:$('rimColor').value};updateMaterials();};$('rimColor').onchange=renderParts;
for(const k of Object.keys(defaults).filter(k=>!sourceKeys.includes(k)))$(k).addEventListener('input',()=>{
 if(sourceKeys.includes(k)){selectedSource()[k]=Number($(k).value);mirrorPrimary();}else settings[k]=Number($(k).value);if(appearanceKeys.includes(k))saveAppearance();displayValues();
 if(k==='height'){updateDepth();}else if(['bevel','dome'].includes(k)){
  // Only another geometry change may replace the pending geometry rebuild.
  // Keep rendering the current model while the user moves the control.
  cancelGeometryUpdate();geometryTimer=setTimeout(rebuild,180);
 }else if(['rimHighlight','rimHighlightWidth'].includes(k))updateRimHighlights();else if(['roughness','gloss','enamelSaturation','enamelBrightness'].includes(k))updateMaterials();else refreshLight();
});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el===b));camera.position.set(...(view==='front'?[0,0,7]:[2.5,-2.8,5.8]));camera.up.set(0,1,0);camera.zoom=1;controls.target.set(0,0,.04);camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();syncPreviewZoom();if(physical())tracer?.updateCamera();updateLightMarkers();resetTrace();});
const oldReferences=$('referenceDialog'),referencePanel=document.createElement('section');referencePanel.id='referenceDialog';referencePanel.className='reference-sidebar';referencePanel.setAttribute('aria-label','Примеры ачивок');referencePanel.append(...oldReferences.childNodes);oldReferences.replaceWith(referencePanel);document.querySelector('.viewports').append(referencePanel);
const referenceHeading=referencePanel.querySelector('.pane-label'),referenceZoom=referenceHeading.querySelector('.reference-zoom');referenceHeading.after(referenceZoom);$('closeReferences').removeAttribute('autofocus');
referencePanel.querySelector('.reference-caption').textContent='Колёсико — прокрутка · Ctrl + колёсико — масштаб. Потяните картинку, чтобы переместить.';
const referenceBoard=referencePanel.querySelector('.reference-board'),currentRenderFigure=document.createElement('figure'),currentRenderCanvas=document.createElement('canvas'),currentRenderContext=currentRenderCanvas.getContext('2d',{alpha:true});currentRenderFigure.className='current-render-reference';currentRenderFigure.hidden=true;currentRenderFigure.draggable=true;currentRenderCanvas.width=currentRenderCanvas.height=512;currentRenderCanvas.setAttribute('role','img');currentRenderCanvas.setAttribute('aria-label','Текущий рендер для сравнения. Перетащите, чтобы поставить рядом с нужным примером');currentRenderFigure.append(currentRenderCanvas);referenceBoard.prepend(currentRenderFigure);
const compareRender=document.createElement('button');compareRender.type='button';compareRender.id='compareRender';compareRender.textContent='Посмотреть';compareRender.disabled=true;compareRender.title='Поставить текущий рендер рядом с примерами';compareRender.setAttribute('aria-label','Посмотреть текущий рендер рядом с примерами');document.querySelector('.stage-options').append(compareRender);
document.querySelector('header .head-actions').prepend($('showReferences'));$('showReferences').removeAttribute('aria-haspopup');
function updateComparisonPreview(){if(referencePanel.hidden||!referencePanel.classList.contains('comparison-mode')||!model)return;const source=renderer.domElement,side=Math.min(source.width,source.height),sx=(source.width-side)/2,sy=(source.height-side)/2,padding=32,size=currentRenderCanvas.width;currentRenderContext.clearRect(0,0,size,size);currentRenderContext.drawImage(source,sx,sy,side,side,padding,padding,size-padding*2,size-padding*2);}
function centerComparisonCamera(){const center=new THREE.Vector3(0,0,.04),offset=camera.position.clone().sub(controls.target);controls.target.copy(center);camera.position.copy(center).add(offset);camera.zoom=1;camera.updateProjectionMatrix();controls.update();syncPreviewZoom();if(physical())tracer?.updateCamera();updateLightMarkers();resetTrace();refreshResetVisibility();}
function placeComparisonAt(x,y){const targets=Array.from(referenceBoard.children).filter(node=>node!==currentRenderFigure&&!node.hidden);let target=null,distance=Infinity;for(const node of targets){const r=node.getBoundingClientRect(),d=Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2));if(d<distance){distance=d;target=node;}}if(!target)return;const r=target.getBoundingClientRect(),after=y>r.top+r.height/2||(Math.abs(y-(r.top+r.height/2))<r.height*.35&&x>r.left+r.width/2);referenceBoard.insertBefore(currentRenderFigure,after?target.nextSibling:target);}
let comparisonDrag=null;currentRenderFigure.addEventListener('pointerdown',e=>{if(e.button!==0)return;comparisonDrag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};currentRenderFigure.setPointerCapture(e.pointerId);e.stopPropagation();});currentRenderFigure.addEventListener('pointermove',e=>{if(comparisonDrag?.id!==e.pointerId)return;e.stopPropagation();if(!comparisonDrag.moved&&Math.hypot(e.clientX-comparisonDrag.x,e.clientY-comparisonDrag.y)<=5)return;comparisonDrag.moved=true;currentRenderFigure.classList.add('dragging');placeComparisonAt(e.clientX,e.clientY);});function stopComparisonDrag(e){if(comparisonDrag?.id!==e.pointerId)return;e.stopPropagation();if(comparisonDrag.moved)placeComparisonAt(e.clientX,e.clientY);comparisonDrag=null;currentRenderFigure.classList.remove('dragging');if(currentRenderFigure.hasPointerCapture(e.pointerId))currentRenderFigure.releasePointerCapture(e.pointerId);}for(const event of ['pointerup','pointercancel','lostpointercapture'])currentRenderFigure.addEventListener(event,stopComparisonDrag);
currentRenderFigure.addEventListener('dragstart',e=>{currentRenderFigure.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','current-render');});currentRenderFigure.addEventListener('dragend',()=>currentRenderFigure.classList.remove('dragging'));referenceBoard.addEventListener('dragover',e=>{if(!currentRenderFigure.classList.contains('dragging'))return;e.preventDefault();placeComparisonAt(e.clientX,e.clientY);});referenceBoard.addEventListener('drop',e=>{if(!currentRenderFigure.classList.contains('dragging'))return;e.preventDefault();placeComparisonAt(e.clientX,e.clientY);});
function showReferences(open,compare=false){if(open&&compare&&model){currentRenderFigure.hidden=false;referencePanel.classList.add('comparison-mode');showColours(false);showSettings(true);centerComparisonCamera();requestAnimationFrame(updateComparisonPreview);}else{referencePanel.classList.remove('comparison-mode');if(!compare)currentRenderFigure.hidden=true;}referencePanel.hidden=!open;$('showReferences').setAttribute('aria-expanded',String(open&&!compare));compareRender.setAttribute('aria-expanded',String(open&&compare));if(open&&document.body.classList.contains('compact-workbench')&&!compare)showColours(false);}
$('showReferences').onclick=()=>showReferences(referencePanel.hidden);compareRender.onclick=()=>showReferences(referencePanel.hidden||currentRenderFigure.hidden,true);$('closeReferences').onclick=()=>showReferences(false);showReferences(false);
$('quality').onchange=()=>{desiredSamples=Number($('quality').value);syncPreviewResolution();};
function applyDefaultTemplate(){settings=freshSettings();contour=normalizeContour(null);saveContour();contourControls.update();saveAppearance();overrides={};sources=normalizeLights(freshSources());selectedLight=sources[1].id;saveLighting();updateModeUI();renderLightPicker();renderParts();rebuild();}
$('resetButton').onclick=applyDefaultTemplate;
$('applyRecipe').onclick=applyDefaultTemplate;
const settingResets=new Map();for(const key of [...appearanceKeys,'fill','exposure']){const input=$(key),label=input.closest('label'),button=resetButton('Сбросить '+label.firstChild.textContent.trim(),()=>{input.value=freshSettings()[key];input.dispatchEvent(new Event('input',{bubbles:true}));});settingResets.set(key,button);inlineReset(label,button);}
function resetBlock(keys){const base=freshSettings();for(const key of keys)settings[key]=base[key];saveAppearance();saveLighting();displayValues();rebuild();}
const formReset=resetButton('Сбросить форму значка',()=>resetBlock(['height','bevel','dome']));$('dome').closest('details').append(formReset);
const materialReset=resetButton('Сбросить материалы',()=>resetBlock(['roughness','gloss','enamelSaturation','enamelBrightness','rimHighlight','rimHighlightWidth','metalShadeGain']));$('enamelBrightness').closest('.reset-field').after(materialReset);
const lightingReset=resetButton('Сбросить всё освещение',()=>{sources=normalizeLights(freshSources());selectedLight=sources[0].id;settings.fill=freshSettings().fill;settings.exposure=freshSettings().exposure;renderLightPicker();refreshLight();});$('lightCards').before(lightingReset);
function resetColours(rimsOnly=false){if(!asset)return;for(const r of asset.regions)if(!rimsOnly||(overrides[r.id]?.role||r.role)==='rim'){if(overrides[r.id])delete overrides[r.id].color;}renderParts();updateMaterials();}
$('rimColor').closest('label').after(resetButton('Сбросить цвет всего контура',()=>resetColours(true)));
$('parts').before(resetButton('Сбросить все цвета',()=>resetColours()),resetButton('Сбросить все изменения деталей',()=>{overrides={};renderParts();rebuild();}));
const viewReset=resetButton('Сбросить ракурс и масштаб',()=>document.querySelector('[data-view="front"]').click());document.querySelector('.segmented').append(viewReset);
const oldColourPanel=document.querySelector('.material-editor');const colourPanel=document.createElement('section');colourPanel.className='material-editor colour-panel';oldColourPanel.querySelector('summary').remove();colourPanel.append(...oldColourPanel.childNodes);oldColourPanel.replaceWith(colourPanel);colourPanel.querySelector('p').textContent='Цвета деталей значка';
const colourHeader=document.createElement('div');colourHeader.className='colour-panel-header';colourHeader.innerHTML='<strong>Цвета</strong><button type="button" aria-label="Закрыть панель цветов">×</button>';colourPanel.prepend(colourHeader);document.querySelector('.viewports').append(colourPanel);
const colourToggle=document.createElement('button');colourToggle.type='button';colourToggle.id='showColours';colourToggle.textContent='Цвета';colourToggle.setAttribute('aria-controls','colourPanel');colourPanel.id='colourPanel';
function showColours(open){if(open&&document.body.classList.contains('compact-workbench'))showReferences(false);colourPanel.hidden=!open;if(!open){selection?.clear();syncSelectionRows();}colourToggle.setAttribute('aria-expanded',String(open));}colourToggle.onclick=()=>showColours(colourPanel.hidden);colourHeader.querySelector('button').onclick=()=>showColours(false);document.querySelector('.stage-options').prepend(colourToggle);showColours(false);
const colourActions=document.createElement('div');colourActions.className='colour-panel-actions';colourActions.append('Все цвета');const allColourReset=colourPanel.querySelector('[aria-label="Сбросить все цвета"]'),allDetailReset=colourPanel.querySelector('[aria-label="Сбросить все изменения деталей"]');colourActions.append(allColourReset);const detailActions=document.createElement('div');detailActions.className='colour-panel-actions';detailActions.append('Все детали',allDetailReset);$('parts').before(colourActions,detailActions);
$('rimColor').closest('label').append(colourPanel.querySelector('[aria-label="Сбросить цвет всего контура"]'));
for(const [title,selector]of [['Сбросить всё освещение','.fixed-studio strong'],['Сбросить форму значка','.settings-group summary']]){const button=document.querySelector('[aria-label="'+title+'"]'),heading=document.querySelector(selector);heading.classList.add('reset-section-heading');heading.append(button);}
const materialHeading=Array.from(document.querySelectorAll('aside .eyebrow')).find(n=>n.textContent==='МАТЕРИАЛЫ');materialHeading.classList.add('reset-section-heading');materialHeading.append(document.querySelector('[aria-label="Сбросить материалы"]'));
const fullResetRow=document.createElement('div');fullResetRow.className='reset-section-heading';$('resetButton').before(fullResetRow);fullResetRow.append('Все настройки',$('resetButton'));$('resetButton').textContent='↺';$('resetButton').className='reset-control';$('resetButton').setAttribute('aria-label','Сбросить все настройки');$('resetButton').title='Вернуть начальные настройки значка';
function refreshResetVisibility(){
 const base=freshSettings(),formKeys=['height','bevel','dome'],materialKeys=['roughness','gloss','enamelSaturation','enamelBrightness','rimHighlight','rimHighlightWidth','metalShadeGain'];
 for(const [key,button]of settingResets)showReset(button,settings[key]!==base[key]);
 showReset(formReset,formKeys.some(key=>settings[key]!==base[key]));showReset(materialReset,materialKeys.some(key=>settings[key]!==base[key]));
 const lightDirty=sources.length!==freshSources().length||sources.some(source=>sourceDirty(source))||settings.fill!==base.fill||settings.exposure!==base.exposure;showReset(lightingReset,lightDirty);
 const values=Object.values(overrides),colourDirty=values.some(value=>value.color!==undefined),detailDirty=values.some(value=>value.role!==undefined||value.lift!==undefined);showReset(allColourReset,colourDirty);showReset(allDetailReset,detailDirty);
 const rimColourReset=colourPanel.querySelector('[aria-label="Сбросить цвет всего контура"]'),rimIds=new Set(asset?.regions.filter(region=>(overrides[region.id]?.role||region.role)==='rim').map(region=>String(region.id))||[]);showReset(rimColourReset,Object.entries(overrides).some(([id,value])=>rimIds.has(id)&&value.color!==undefined));
 const contourBase=normalizeContour(null),contourDirty=Object.keys(contourBase).some(key=>contour[key]!==contourBase[key]);showReset($('resetButton'),formKeys.concat(materialKeys,'fill','exposure').some(key=>settings[key]!==base[key])||lightDirty||contourDirty||colourDirty||detailDirty);
 const target=controls.target;showReset(viewReset,view!=='front'||Math.abs(camera.zoom-1)>.001||camera.position.distanceTo(new THREE.Vector3(0,0,7))>.001||target.distanceTo(new THREE.Vector3(0,0,.04))>.001);
}


const settingsPanel=document.querySelector('aside');settingsPanel.classList.add('settings-panel');settingsPanel.id='settingsPanel';
const projectBar=document.createElement('div');projectBar.className='project-bar';
const sourcePreview=$('sourcePreview');sourcePreview.open=false;
const recipe=document.querySelector('.recipe-card');
recipe.querySelector('.eyebrow').textContent='ШАБЛОН ПО УМОЛЧАНИЮ';
recipe.querySelector('h2').textContent='По умолчанию';
recipe.querySelector('p').textContent='Сочные поверхности, светлый металлический контур и мягкие контактные тени. Эти настройки открываются по умолчанию и возвращаются кнопками сброса.';
recipe.querySelector('button').textContent='Вернуть настройки по умолчанию';
const recipeFold=document.createElement('details');recipeFold.className='recipe-fold';const recipeSummary=document.createElement('summary');recipeSummary.textContent='Шаблон · По умолчанию';recipeFold.append(recipeSummary,recipe);
recipeFold.hidden=true;projectBar.append($('chooseTestSVG'),sourcePreview);document.querySelector('header .head-actions').before(projectBar);document.querySelector('header .tag').remove();document.querySelector('.manual-settings>.light-help').textContent='Настройте свет и материалы значка.';
settingsPanel.querySelector(':scope > .eyebrow').remove();settingsPanel.querySelector(':scope > .divider').remove();
const settingsHeader=document.createElement('div');settingsHeader.className='colour-panel-header';settingsHeader.innerHTML='<strong>Настройки</strong><button type="button" aria-label="Закрыть настройки">×</button>';settingsPanel.prepend(settingsHeader);document.querySelector('.viewports').prepend(settingsPanel);
const settingsToggle=document.createElement('button');settingsToggle.id='showSettings';settingsToggle.textContent='Настройки';settingsToggle.setAttribute('aria-controls','settingsPanel');document.querySelector('.stage-options').prepend(settingsToggle);
function showSettings(open){settingsVisible=open;updateLightMarkers();settingsPanel.hidden=!open;settingsToggle.setAttribute('aria-expanded',String(open));}settingsToggle.onclick=()=>showSettings(settingsPanel.hidden);settingsHeader.querySelector('button').onclick=()=>showSettings(false);showSettings(true);
const compactWorkbench=matchMedia('(max-width:1100px), (max-height:620px)');function adaptWorkbench(){document.body.classList.toggle('compact-workbench',compactWorkbench.matches);if(compactWorkbench.matches){showSettings(false);showColours(false);showReferences(false);}}compactWorkbench.addEventListener('change',adaptWorkbench);adaptWorkbench();

$('loadRecipe').onclick=()=>$('fileInput').click();
const download=(data,name)=>{const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);};
$('saveSettings').onclick=()=>download(new Blob([JSON.stringify({format:'relief-style-v1',name:STUDIO.name,profile:STUDIO.version,settings,lights:sources,contour},null,2)],{type:'application/json'}),'relief-settings.json');
$('exportModel').onclick=async()=>{try{const exported=modelForGLTF(model);try{const result=await new GLTFExporter().parseAsync(exported.model,{binary:true});download(new Blob([result],{type:'model/gltf-binary'}),assetKey+'-relief.glb');}finally{exported.dispose();}}catch(e){error(e);}};
$('startUpload').onclick=()=>$('fileInput').click();$('importButton').onclick=()=>$('fileInput').click();$('uploadOwnSVG').onclick=()=>$('fileInput').click();
const startContact=document.createElement('a');startContact.className='start-contact';startContact.href='mailto:staburova@inno.tech';startContact.textContent='staburova@inno.tech';$('uploadPrompt').append(startContact);
const uploadProgress=document.createElement('div');uploadProgress.className='upload-progress';uploadProgress.hidden=true;uploadProgress.innerHTML='<span>Читаем SVG…</span><progress max="100" value="0"></progress>';$('viewport').append(uploadProgress);
function setUploadProgress(value,label){uploadProgress.hidden=false;uploadProgress.querySelector('span').textContent=label;uploadProgress.querySelector('progress').value=value;$('viewport').classList.add('loading');}
function finishUploadProgress(ok){setUploadProgress(ok?100:0,ok?'SVG готов':'Не удалось загрузить SVG');setTimeout(()=>{uploadProgress.hidden=true;$('viewport').classList.remove('loading');},ok?650:1800);}
function readFileWithProgress(file){setUploadProgress(2,'Читаем SVG…');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onprogress=e=>{if(e.lengthComputable)setUploadProgress(2+e.loaded/e.total*33,'Читаем SVG…');};reader.onerror=()=>reject(reader.error||Error('Не удалось прочитать файл'));reader.onload=()=>resolve(String(reader.result));reader.readAsText(file);});}
for(const zone of [$('sourcePreview'),$('viewport')]){zone.addEventListener('dragover',e=>{if(!Array.from(e.dataTransfer.types).includes('Files'))return;e.preventDefault();e.dataTransfer.dropEffect='copy';zone.classList.add('svg-drop-active');});zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('svg-drop-active');});zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('svg-drop-active');if(!e.dataTransfer.files.length)return;$('fileInput').files=e.dataTransfer.files;$('fileInput').dispatchEvent(new Event('change',{bubbles:true}));});}
$('fileInput').onchange=async e=>{const previousAsset=asset,previousKey=assetKey,previousOverrides=overrides,previousState=readState();let uploadFailed=false;history?.begin();try{const file=e.target.files[0];if(!file)return;const text=await readFileWithProgress(file);setUploadProgress(42,"Проверяем файл…");if(file.name.endsWith('.json')){const d=JSON.parse(text);if(d.format==='relief-style-v1'){if(!asset)throw Error('Сначала загрузите SVG, затем файл настроек.');for(const k of Object.keys(defaults)){if(sourceKeys.includes(k)||!Number.isFinite(d.settings?.[k]))continue;const control=$(k);settings[k]=Math.min(Number(control.max),Math.max(Number(control.min),d.settings[k]));}settings.renderMode='physical';contour=normalizeContour(d.contour,!d.contour);saveContour();contourControls.update();if(d.lights)sources=normalizeLights(d.lights,settings);selectedLight=sources[0]?.id;saveAppearance();saveLighting();renderLightPicker();displayValues();if(!await rebuild())throw Error('Не удалось построить макет');}else if(d.format==='relief-recipe-v1'){if(!d.asset&&!names[d.assetKey])throw Error('В файле настроек нет исходного SVG. Сначала загрузите SVG.');if(names[d.assetKey]){if(!cache.has(d.assetKey)){const response=await fetch(publicAsset(d.assetKey+'.json'));if(!response.ok)throw Error('Не найден исходный макет');cache.set(d.assetKey,await checkedAsset(await response.json()));}asset={...cache.get(d.assetKey)};assetKey=d.assetKey;}else if(d.asset){asset=await checkedAsset(d.asset);assetKey='custom';}for(const k of Object.keys(defaults))if(!sourceKeys.includes(k)&&Number.isFinite(d.settings?.[k])){const control=$(k);settings[k]=Math.min(Number(control.max),Math.max(Number(control.min),d.settings[k]));}settings.renderMode='physical';contour=normalizeContour(d.contour,!d.contour);saveContour();contourControls.update();saveAppearance();if(d.lights)sources=normalizeLights(d.lights,settings);selectedLight=sources[0].id;saveLighting();renderLightPicker();settings.showLights=d.settings?.showLights!==false;updateModeUI();overrides=d.overrides||{};displayValues();renderParts();if(!await rebuild())throw Error('Не удалось построить макет');}else if(d.regions&&d.viewBox){asset=await checkedAsset(d);assetKey=d.key||'custom';overrides={};renderParts();if(!await rebuild())throw Error('Не удалось построить макет');}else throw Error('Этот JSON-файл не поддерживается. Выберите SVG или файл настроек Relief.');}else{asset=await checkedAsset({key:'custom',name:file.name.replace(/\.svg$/i,''),sourceSVG:text});assetKey='custom';overrides={};document.querySelectorAll('[data-asset]').forEach(b=>b.classList.remove('active'));renderParts();if(!await rebuild())throw Error('Не удалось построить макет');}}catch(e){uploadFailed=true;asset=previousAsset;assetKey=previousKey;overrides=previousOverrides;Object.assign(settings,previousState.settings);sources=previousState.sources;contour=previousState.contour;saveAppearance();saveLighting();saveContour();displayValues();contourControls.update();renderLightPicker();renderParts();busy=false;error(e);}finally{finishUploadProgress(!uploadFailed);$('fileInput').value='';history?.end();}};
const transparentLabel=document.createElement('label');transparentLabel.style.cssText='font-size:10px;color:#a6ae9c;display:flex;align-items:center;gap:6px';transparentLabel.innerHTML='<input type="checkbox" id="transparent" checked> Без фона';document.querySelector('.bottom-bar').prepend(transparentLabel);$('transparent').onchange=()=>{if($('transparent').checked)scene.remove(ground);else scene.add(ground);scene.background=$('transparent').checked?null:new THREE.Color(0x20221f);if(physical())ensureTracer().setScene(scene,camera);resetTrace();};
transparentLabel.hidden=true;
const exportDialog=createExportDialog(()=>({scene,camera,model,contour:structuredClone(contour),exposure:settings.exposure,name:assetKey}),value=>{exporting=value;controls.enabled=!value;document.querySelector('main').inert=value;document.querySelector('header').inert=value;},download);
$('exportButton').onclick=()=>{if(!busy&&model)exportDialog.open();};
const renderIsHealthy=createRenderHealthCheck();
let renderFailed=false,healthChecked=false;
let lastProgress=0;
let animationRunning=false;
let lastTileCount=0;
// One complete preview sample per frame avoids four display/filter passes.
// Keep smaller GPU jobs while dragging and for the larger exported image.
const activePointers=new Set();
window.addEventListener('pointerdown',event=>activePointers.add(event.pointerId),{capture:true});
window.addEventListener('pointerup',event=>activePointers.delete(event.pointerId),{capture:true});
window.addEventListener('pointercancel',event=>activePointers.delete(event.pointerId),{capture:true});
window.addEventListener('blur',()=>activePointers.clear());
const renderScheduler=createRenderScheduler(animate);
function requestRender(){renderScheduler.requestRender();}
function startAnimation(){if(animationRunning)return;requestRender();}
function animate(t){
 animationRunning=false;
 if(!model||busy||exporting||detailEditing||document.hidden||renderFailed)return;
 if(!tracer)return;
 const tiles=exporting||activePointers.size?2:1;if(tiles!==lastTileCount){tracer.tiles.set(tiles,tiles);lastTileCount=tiles;}
 const target=exporting?512:desiredSamples;
 if(tracer.samples<target)tracer.renderSample();else if(finalCompositeSamples!==target){contourEffects.redraw(contour);finalCompositeSamples=target;}
 if(t-lastProgress>200||tracer.samples>=target){
  lastProgress=t;const n=Math.floor(tracer.samples);$('samples').textContent=n+' / '+target;$('progress').style.width=Math.min(100,n/target*100)+'%';
  updateComparisonPreview();
  $('status').textContent=tracer.isCompiling?'Готовлю освещение…':exporting?'Рендер PNG 1024 × 1024…':n>=target?'Превью готово':'Уточняем изображение…';
  if(n>=target&&!healthChecked){healthChecked=true;if(!renderIsHealthy(renderer.domElement)){renderFailed=true;exporting=false;$('testAssets').disabled=false;$('exportButton').disabled=true;$('exportButton').textContent='Скачать PNG';error(new Error('Браузер вывел чёрный силуэт вместо материалов. Изображение не сохранено. Перезагрузите страницу; если ошибка повторится, попробуйте другой браузер с аппаратным ускорением.'));return;}}
  if(n>=target&&!renderFailed&&!exporting)$('exportButton').disabled=false;

 }
 return tracer.samples<target||finalCompositeSamples!==target;
}

function syncSelectionRows(){for(const row of $('parts').children){const selected=selection?.selected!=null&&row.dataset.regionId===String(selection.selected);row.classList.toggle('selected',selected);row.setAttribute('aria-selected',String(selected));const detail=row.querySelector('.part-details');if(detail){detail.hidden=!selected;detail.open=selected;}}}
function selectPart(id,scroll=true){if(id!=null&&typeof colourPanel!=='undefined'&&colourPanel.hidden){selection?.clear();syncSelectionRows();return;}selection?.select(id);syncSelectionRows();if(id!=null){showColours(true);if(scroll){const row=Array.from($('parts').children).find(r=>r.dataset.regionId===String(id));row?.scrollIntoView({block:'nearest'});}}}
// Render scene has no selection renderer, duplicated geometry, or raycasting.
selection={selected:null,select(id){this.selected=id;},clear(){this.selected=null;}};
let previewResizeTimer=null;
function syncPreviewResolution(){
 clearTimeout(previewResizeTimer);previewResizeTimer=null;
 const rect=$('viewport').getBoundingClientRect(),{width,height}=previewBufferDimensions(rect.width,rect.height,desiredSamples,devicePixelRatio);
 const aspect=Math.max(.01,rect.width/Math.max(1,rect.height)),half=1.52;
 camera.left=-half*Math.max(1,aspect);camera.right=half*Math.max(1,aspect);camera.top=half*Math.max(1,1/aspect);camera.bottom=-half*Math.max(1,1/aspect);camera.updateProjectionMatrix();tracer?.updateCamera();
 const current=renderer.getDrawingBufferSize(new THREE.Vector2());if(current.x===width&&current.y===height){updateLightMarkers();resetTrace();return;}
 renderer.setSize(width,height,false);contourEffects.invalidateGeometry();resetTrace();updateLightMarkers();
}
new ResizeObserver(()=>{clearTimeout(previewResizeTimer);previewResizeTimer=setTimeout(syncPreviewResolution,180);}).observe($('viewport'));
syncPreviewResolution();
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){selection.clear();syncSelectionRows();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)startAnimation();});

// Flatten the existing controls while retaining IDs and event handlers.
const oldContour=document.querySelector('.contour-settings'),manual=document.querySelector('.manual-settings');
oldContour.replaceWith($('contourControls'));
function makeSection(key,title){const d=document.createElement('details');d.className='editor-section';d.dataset.section=key;const summary=document.createElement('summary');summary.textContent=title;d.append(summary);d.addEventListener('toggle',()=>sectionChanged(key,d.open));return d;}
const lightingSection=makeSection('lighting','Освещение'),formSection=makeSection('form','Форма и материалы');
const form=document.querySelector('.settings-group');let atForm=false;for(const node of Array.from(manual.children)){if(node===form)atForm=true;if(node.tagName==='SUMMARY')continue;(atForm?formSection:lightingSection).append(node);}manual.replaceWith(lightingSection,formSection);
lightingSection.querySelector('.fixed-studio')?.remove();
const formSummary=form.querySelector('summary'),formSummaryReset=formSummary.querySelector('button');if(formSummaryReset)formSection.querySelector('summary').append(formSummaryReset);formSummary.remove();form.replaceWith(...form.childNodes);
for(const node of settingsPanel.querySelectorAll('.divider,.eyebrow,.footnote')){const reset=node.querySelector('button');if(reset){node.className='reset-section-heading';node.firstChild.textContent='Материалы';}else node.remove();}
for(const type of ['pointerdown','focusin'])settingsPanel.addEventListener(type,e=>{const section=e.target.closest('.editor-section');if(section?.open)sectionChanged(section.dataset.section,true);});
for(const p of settingsPanel.querySelectorAll('p'))p.hidden=true;
const pointsLabel=$('showLights').closest('label');pointsLabel.classList.add('points-toggle');pointsLabel.lastChild.textContent=' Показывать точки';document.querySelector('.stage-options').prepend(pointsLabel);
$('viewport').append(pointsLabel);
const viewControls=document.querySelector('.segmented');viewControls.classList.add('view-toggle-overlay');$('viewport').append(viewControls);
const frontView=document.querySelector('[data-view="front"]'),angleView=document.querySelector('[data-view="angle"]');frontView.textContent='Спереди';frontView.title='Показать значок прямо';angleView.textContent='Объём';angleView.title='Показать значок под углом';
const zoomControls=document.createElement('div');zoomControls.className='zoom-controls';zoomControls.setAttribute('role','group');zoomControls.setAttribute('aria-label','Масштаб значка');
const zoomOut=document.createElement('button'),zoomValue=document.createElement('button'),zoomIn=document.createElement('button');zoomOut.type=zoomValue.type=zoomIn.type='button';zoomOut.textContent='−';zoomIn.textContent='+';zoomOut.setAttribute('aria-label','Уменьшить значок');zoomIn.setAttribute('aria-label','Увеличить значок');zoomValue.setAttribute('aria-label','Сбросить масштаб');zoomValue.title='Сбросить масштаб до 100%';
function setPreviewZoom(next){camera.zoom=Math.max(controls.minZoom,Math.min(controls.maxZoom,next));camera.updateProjectionMatrix();controls.update();syncPreviewZoom();if(physical())tracer?.updateCamera();updateLightMarkers();resetTrace();refreshResetVisibility();}
function syncPreviewZoom(){zoomValue.textContent=Math.round(camera.zoom*100)+'%';zoomOut.disabled=camera.zoom<=controls.minZoom+.001;zoomIn.disabled=camera.zoom>=controls.maxZoom-.001;}
zoomOut.onclick=()=>setPreviewZoom(camera.zoom/1.2);zoomIn.onclick=()=>setPreviewZoom(camera.zoom*1.2);zoomValue.onclick=()=>setPreviewZoom(1);controls.addEventListener('change',syncPreviewZoom);syncPreviewZoom();zoomControls.append(zoomOut,zoomValue,zoomIn);$('viewport').append(zoomControls);
const fileMenu=document.createElement('details');fileMenu.className='file-menu app-menu';fileMenu.innerHTML='<summary>Файл</summary><div class="file-menu-items app-menu-items"></div>';const fileItems=fileMenu.lastElementChild;
const templateMenu=document.createElement('details');templateMenu.className='template-menu app-menu';templateMenu.innerHTML='<summary>Шаблон</summary><div class="template-menu-items app-menu-items"></div>';const templateItems=templateMenu.lastElementChild,applyStudioTemplate=document.createElement('button');applyStudioTemplate.type='button';applyStudioTemplate.textContent='Применить «По умолчанию»';applyStudioTemplate.onclick=applyDefaultTemplate;
$('saveSettings').textContent='Сохранить текущий шаблон';$('loadRecipe').textContent='Открыть шаблон из файла';templateItems.append(applyStudioTemplate,$('saveSettings'),$('loadRecipe'));fileItems.append($('importButton'),$('fileInput'),$('exportButton'),$('exportModel'));document.querySelector('header .project-bar').prepend(fileMenu,templateMenu);
applyStudioTemplate.setAttribute('aria-label','Применить шаблон «По умолчанию»');$('saveSettings').setAttribute('aria-label','Сохранить текущий шаблон');$('loadRecipe').setAttribute('aria-label','Открыть шаблон из файла');$('exportModel').setAttribute('aria-label','Скачать 3D-модель');
const appMenus=[fileMenu,templateMenu];for(const menu of appMenus){menu.addEventListener('toggle',()=>{if(menu.open)for(const other of appMenus)if(other!==menu)other.open=false;});menu.lastElementChild.addEventListener('click',()=>menu.open=false);}document.addEventListener('pointerdown',e=>{for(const menu of appMenus)if(!menu.contains(e.target))menu.open=false;});document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const menu of appMenus)menu.open=false;});
const undoButton=document.createElement('button'),redoButton=document.createElement('button');undoButton.textContent='↶';redoButton.textContent='↷';undoButton.title='Отменить · Ctrl / Cmd + Z';redoButton.title='Повторить · Ctrl / Cmd + Shift + Z';undoButton.setAttribute('aria-label','Отменить');redoButton.setAttribute('aria-label','Повторить');const historyButtons=document.createElement('div');historyButtons.className='history-buttons';historyButtons.append(undoButton,redoButton);document.querySelector('header .head-actions').before(historyButtons);
const readState=()=>({settings:Object.fromEntries([...appearanceKeys,'fill','exposure'].map(k=>[k,settings[k]])),sources:structuredClone(sources),contour:structuredClone(contour),overrides:structuredClone(overrides),detailAssignments:structuredClone(asset?.detailAssignments||null)});
async function applyState(next){const before=readState();const detailChanged=JSON.stringify(before.detailAssignments)!==JSON.stringify(next.detailAssignments);if(detailChanged&&asset?.editablePaints){asset=next.detailAssignments?compileDetailAssignments(asset,next.detailAssignments):{...prepareAsset({...asset,detailAssignments:undefined}),sourceSVG:asset.sourceSVG};historyAsset=asset;}cancelGeometryUpdate();++buildVersion;busy=false;Object.assign(settings,next.settings);sources=structuredClone(next.sources);contour=structuredClone(next.contour);overrides=structuredClone(next.overrides);if(!sources.some(s=>s.id===selectedLight))selectedLight=sources[0]?.id;saveAppearance();saveLighting();saveContour();displayValues();contourControls.update();renderLightPicker();renderParts();const geometry=detailChanged||['bevel','dome'].some(k=>before.settings[k]!==settings[k])||asset?.regions.some(r=>['role','lift'].some(k=>before.overrides[r.id]?.[k]!==overrides[r.id]?.[k]));if(geometry)await rebuild();else if(before.settings.height!==settings.height){updateDepth();updateMaterials();}else if(appearanceKeys.some(k=>before.settings[k]!==next.settings[k])||JSON.stringify(before.overrides)!==JSON.stringify(next.overrides)||before.contour.enabled!==contour.enabled){light();updateMaterials();}else if(JSON.stringify(before.sources)!==JSON.stringify(next.sources)||before.settings.fill!==next.settings.fill||before.settings.exposure!==next.settings.exposure){refreshLight();}else{contourEffects.invalidate();contourEffects.redraw(contour);}updateLightMarkers();}
history=createHistory(readState,applyState,state=>{undoButton.disabled=!state.undo;redoButton.disabled=!state.redo;});history.reset();undoButton.onclick=()=>history.undo();redoButton.onclick=()=>history.redo();
window.addEventListener('pointerdown',e=>{if(e.target.closest('.history-buttons,dialog'))return;beginPointerHistory();},true);
window.addEventListener('pointerup',endPointerHistory);window.addEventListener('pointercancel',endPointerHistory);window.addEventListener('blur',endPointerHistory);
window.addEventListener('keydown',e=>{if(detailEditing)return;const editing=e.target.matches('input:not([type=range]):not([type=checkbox]),textarea,[contenteditable=true]');if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!editing&&!exporting){e.preventDefault();e.shiftKey?history.redo():history.undo();return;}if(asset&&!editing&&!keyTransaction&&!exporting){keyTransaction=true;history.begin();}},true);
window.addEventListener('keyup',()=>{if(keyTransaction){keyTransaction=false;history.end();}});window.addEventListener('blur',()=>{if(keyTransaction){keyTransaction=false;history.end();}});
for(const event of ['input','change','click'])document.addEventListener(event,()=>queueMicrotask(()=>history.commit()));
$('quality').value=String(desiredSamples);updateModeUI();renderLightPicker();light();startAnimation();

setupReferenceZoom();

const offlineLink=document.createElement('a');offlineLink.id='downloadOffline';offlineLink.href='/Relief-Offline.html';offlineLink.download='Relief-Offline.html';offlineLink.textContent='Скачать версию без интернета';fileItems.append(offlineLink);
installHelp();
setupPanelWorkspace();
for(const [element,name]of [[fileMenu.querySelector('summary'),'file'],[templateMenu.querySelector('summary'),'template'],[$('chooseTestSVG'),'test'],[$('sourcePreview').querySelector('summary'),'file'],[$('showSettings'),'settings'],[$('showColours'),'colours'],[$('showReferences'),'examples'],[$('compareRender'),'view'],[$('importButton'),'upload'],[$('exportButton'),'download'],[applyStudioTemplate,'apply'],[$('saveSettings'),'save'],[$('loadRecipe'),'open'],[$('exportModel'),'cube'],[offlineLink,'offline']])addIcon(element,name);

// Direct hooks for an external Tweakpane/lil-gui controller.
export const studioControls = Object.freeze({
 requestRender(){tracer?.updateCamera();resetTrace();},
 setDepth(value){const depth=Number(value);if(!Number.isFinite(depth)||depth<=0)throw new RangeError('Depth must be positive');settings.height=depth;saveAppearance();displayValues();updateDepth();},
 setAppearance(values){
  const previous={...settings};
  for(const [key,value]of Object.entries(values)){
   if(!appearanceKeys.includes(key)||!Number.isFinite(value)||(key==='height'&&value<=0))throw new TypeError('Invalid appearance setting: '+key);
  }
  Object.assign(settings,values);saveAppearance();displayValues();
  if(previous.bevel!==settings.bevel||previous.dome!==settings.dome)return rebuild();
  if(previous.height!==settings.height)updateDepth();
  updateMaterials();
 },
 getMetrics(){return model?{...window.reliefMetrics,drawCalls:model.children.filter(m=>m.isMesh).length}:null;},
});

const detailEditor=createDetailEditor({
 read:()=>{
  if(!asset)return null;
  const assignments=structuredClone(asset.detailAssignments||{});
  for(const region of asset.regions){const edit=overrides[region.id];if(!edit)continue;for(const id of region.sourcePaintIds||[region.id]){const p=asset.editablePaints?.find(p=>p.id===id);if(p)assignments[id]={...assignments[id],role:edit.role||assignments[id]?.role||p.role,...(edit.color?{color:edit.color}:{})};}}
  return {...asset,detailAssignments:assignments};
 },
 pause(){detailEditing=true;controls.enabled=false;},
 resume(){detailEditing=false;controls.enabled=true;requestRender();},
 async apply(assignments){
  if(!asset)return;
  const previous=asset,previousOverrides=overrides;
  const next=compileDetailAssignments(asset,assignments);
  const retained={};for(const region of previous.regions){const lift=previousOverrides[region.id]?.lift;if(lift!==undefined)for(const id of region.sourcePaintIds||[region.id])retained[id]={lift};}
  asset=next;historyAsset=next;overrides=retained;
  if(!await rebuild()){asset=previous;historyAsset=previous;overrides=previousOverrides;throw Error('Сборка не удалась. Предыдущая модель сохранена.');}
  renderParts();
 }
});
const editDetailsButton=document.createElement('button');editDetailsButton.textContent='Редактор деталей';editDetailsButton.id='editDetails';editDetailsButton.onclick=()=>{if(busy||exporting)return;try{detailEditor.open();}catch(e){error(e);}};
document.querySelector('header .project-bar').append(editDetailsButton);
const saveProject=document.createElement('button');saveProject.textContent='Сохранить проект';saveProject.onclick=()=>{if(!asset)return;download(new Blob([JSON.stringify({format:'relief-recipe-v1',assetKey:'custom',asset:asset.sourceSVG?{key:asset.key,name:asset.name,sourceSVG:asset.sourceSVG,detailAssignments:asset.detailAssignments}:asset,settings,lights:sources,contour,overrides},null,2)],{type:'application/json'}),'relief-project.json');};fileItems.append(saveProject);

// Reviewed projects keep explicit editing decisions separate from untouched SVGs.
const reviewedNames={'022':'Рука','024':'Сова','025':'Осьминог','027':'Бицепс','055':'2023','067':'Гоночная машина','079':'Мишень','086':'Палатка'};
async function loadReviewedProject(id){
 if(!reviewedNames[id])return;
 const response=await fetch(new URL(`${import.meta.env.BASE_URL}reviewed-projects/achievement-${id}.json`,location.href));
 if(!response.ok)throw Error('Не удалось загрузить исправленный проект.');
 const text=await response.text();
 await $('fileInput').onchange({target:{files:[new File([text],`achievement-${id}.json`,{type:'application/json'})]}});
}
const reviewedList=document.createElement('fieldset'),reviewedLegend=document.createElement('legend');reviewedLegend.textContent='Исправленные по замечаниям';reviewedList.append(reviewedLegend);
for(const [id,name]of Object.entries(reviewedNames)){const button=document.createElement('button');button.textContent=name;button.onclick=()=>{testSVGDialog.close();loadReviewedProject(id).catch(error);};reviewedList.append(button);}
testSVGDialog.append(reviewedList);
const reviewedId=new URLSearchParams(location.search).get('review');if(reviewedNames[reviewedId])loadReviewedProject(reviewedId).catch(error);
