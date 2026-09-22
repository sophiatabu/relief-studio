import {Vector3,Raycaster,Plane} from 'three';

// These handles describe directions in the badge plane, just like the effect
// shader. Camera projection keeps them aligned when the badge is rotated.
export function createContourMarkers(viewport,camera,controls,getState,change,beginGesture=()=>{},endGesture=()=>{}){
 const root=document.createElement('div');root.className='light-markers contour-markers';viewport.append(root);
 const buttons=new Map(),ray=new Raycaster(),plane=new Plane(new Vector3(0,0,1),-.15);let drag=null;
 function end(){if(!drag)return;const previous=drag;drag=null;controls.enabled=previous.controls;root.classList.remove('dragging');if(root.hasPointerCapture(previous.id))root.releasePointerCapture(previous.id);endGesture();}
 for(const [kind,icon,label]of [['highlight','✦','Блик'],['shadow','◒','Тень']]){
  const button=document.createElement('button');button.type='button';button.className='light-marker contour-marker '+kind;button.innerHTML=`<span class="source-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
  button.setAttribute('aria-label',label+' по контуру: перетащите для изменения направления');button.title='Перетащите вокруг значка — направление '+(kind==='highlight'?'блика':'тени');
  button.onpointerdown=e=>{if(e.button!==0||drag)return;e.preventDefault();e.stopPropagation();beginGesture();drag={kind,id:e.pointerId,controls:controls.enabled};controls.enabled=false;root.setPointerCapture(e.pointerId);root.classList.add('dragging');};
  button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const step=e.shiftKey?15:5,sign=['ArrowLeft','ArrowDown'].includes(e.key)?-1:1;change(kind,((getState().settings[kind+'Angle']+sign*step)%360+360)%360);};
  root.append(button);buttons.set(kind,button);
 }
 root.onpointermove=e=>{
  if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();
  const rect=root.getBoundingClientRect();camera.updateMatrixWorld();ray.setFromCamera({x:(e.clientX-rect.left)/rect.width*2-1,y:1-(e.clientY-rect.top)/rect.height*2},camera);
  const p=ray.ray.intersectPlane(plane,new Vector3());if(!p||Math.hypot(p.x,p.y)<.08)return;
  change(drag.kind,(Math.round(Math.atan2(p.x,p.y)*180/Math.PI)+360)%360);
 };
 root.onpointerup=end;root.onpointercancel=end;root.onlostpointercapture=end;window.addEventListener('blur',end);
 return {update(){
  const {model,settings,visible}=getState();root.hidden=!model||!settings.enabled||!visible;
  if(root.hidden){end();return;}camera.updateMatrixWorld();
  for(const [kind,button]of buttons){button.hidden=false;
   const a=settings[kind+'Angle']*Math.PI/180,p=new Vector3(Math.sin(a)*1.27,Math.cos(a)*1.27,.15).project(camera);
   button.style.left=Math.max(10,Math.min(90,50+p.x*50))+'%';button.style.top=Math.max(18,Math.min(93,50-p.y*50))+'%';
   button.classList.toggle('off',!settings[kind]);button.setAttribute('aria-description',settings[kind+'Angle']+'°. Стрелки — изменить направление.');
  }
 }};
}
