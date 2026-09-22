import * as THREE from 'three';

export function installWindowSelectionClear(target,onClear,{threshold=5,preserve='.part-row'}={}){
 const starts=new Map();
 const down=event=>{if(event.button===0)starts.set(event.pointerId,{x:event.clientX,y:event.clientY,moved:false});};
 const move=event=>{const start=starts.get(event.pointerId);if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>threshold)start.moved=true;};
 const finish=event=>{
  const start=starts.get(event.pointerId);starts.delete(event.pointerId);if(!start)return;
  if(start.moved||Math.hypot(event.clientX-start.x,event.clientY-start.y)>threshold)return;
  if(preserve&&event.target?.closest?.(preserve))return;
  onClear();
 };
 const cancel=event=>starts.delete(event.pointerId),blur=()=>starts.clear();
 target.addEventListener('pointerdown',down,true);target.addEventListener('pointermove',move,true);target.addEventListener('pointerup',finish,true);target.addEventListener('pointercancel',cancel,true);target.addEventListener('blur',blur);
 return ()=>{target.removeEventListener('pointerdown',down,true);target.removeEventListener('pointermove',move,true);target.removeEventListener('pointerup',finish,true);target.removeEventListener('pointercancel',cancel,true);target.removeEventListener('blur',blur);starts.clear();};
}

export function createPartSelection(viewport,canvas,camera,getModel,onSelect){
 const ray=new THREE.Raycaster(),overlay=new THREE.WebGLRenderer({alpha:true,antialias:true});overlay.setSize(448,448);overlay.setClearColor(0,0);overlay.autoClear=false;overlay.domElement.className='selection-overlay';overlay.domElement.setAttribute('aria-hidden','true');viewport.append(overlay.domElement);
 const scene=new THREE.Scene(),depth=new THREE.MeshBasicMaterial({colorWrite:false,side:THREE.DoubleSide}),tint=new THREE.MeshBasicMaterial({color:0xd0ef9e,transparent:true,opacity:.32,depthWrite:false,depthFunc:THREE.LessEqualDepth,side:THREE.DoubleSide});
 let selected=null,hover=null,lastModel=null,lastRevision=-1,start=null;
 function sync(){
  const model=getModel(),revision=model?.userData.batchRevision;
  if(model!==lastModel||revision!==lastRevision){
   for(const copy of scene.children)copy.geometry.dispose();
   scene.clear();lastModel=model;lastRevision=revision;
   if(model)model.traverse(m=>{if(!m.isMesh)return;
    for(const part of m.userData.parts||[{regionId:m.userData.regionId,start:0,count:Infinity}]){
     const geometry=new THREE.BufferGeometry();
     for(const [name,attribute]of Object.entries(m.geometry.attributes))geometry.setAttribute(name,attribute);
     if(m.geometry.index)geometry.setIndex(m.geometry.index);
     geometry.setDrawRange(part.start,part.count);
     const copy=new THREE.Mesh(geometry,depth);copy.matrixAutoUpdate=false;
     copy.userData={original:m,regionId:part.regionId};scene.add(copy);
    }
   });
  }
  model?.updateMatrixWorld(true);for(const copy of scene.children){copy.matrix.copy(copy.userData.original.matrixWorld);copy.visible=true;}
 }

 function draw(){sync();overlay.clear();const id=hover??selected;if(id==null||!lastModel)return;scene.overrideMaterial=depth;overlay.render(scene,camera);scene.overrideMaterial=tint;for(const copy of scene.children)copy.visible=String(copy.userData.regionId)===String(id);overlay.render(scene,camera);scene.overrideMaterial=null;}
 canvas.addEventListener('pointerdown',e=>{if(e.button===0)start={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};});
 canvas.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)start.moved=true;});
 canvas.addEventListener('pointerup',e=>{if(!start||start.id!==e.pointerId)return;const down=start;start=null;if(down.moved||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const r=canvas.getBoundingClientRect();camera.updateMatrixWorld();ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:1-(e.clientY-r.top)/r.height*2},camera);const hit=getModel()?ray.intersectObject(getModel(),true).find(h=>h.object.userData.regionId!=null):null;const part=hit?.object.userData.parts?.find(p=>hit.faceIndex*3>=p.start&&hit.faceIndex*3<p.start+p.count);selected=part?.regionId??hit?.object.userData.regionId??null;hover=null;onSelect(selected);draw();});canvas.addEventListener('pointercancel',()=>{start=null;});
 return {draw,resize(width,height=width){overlay.setSize(width,height,false);draw();},select(id){selected=id;draw();},hover(id){hover=id;draw();},clear(){selected=hover=null;draw();},get selected(){return selected;}};
}
