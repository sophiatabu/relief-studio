// Panel placement is editor UI state; it never changes the render recipe.
export function setupPanelWorkspace(){
 const $=id=>document.getElementById(id),stage=document.querySelector('.viewports');
 const dockTracks={settingsPanel:'--left-panel',colourPanel:'--right-panel',referenceDialog:'--reference-panel'};
 const panelWidthKey='relief-panel-widths-v1';
 let savedWidths={};
 try{savedWidths=JSON.parse(localStorage.getItem(panelWidthKey)||'{}')||{};}catch{}
 const savePanelWidth=(id,width)=>{savedWidths[id]=Math.round(width);try{localStorage.setItem(panelWidthKey,JSON.stringify(savedWidths));}catch{}};
 const group=document.createElement('div');group.className='panel-switcher';group.setAttribute('role','group');group.setAttribute('aria-label','Панели');
 const label=document.createElement('span');label.textContent='Панели';group.append(label,$('showSettings'),$('showColours'),$('showReferences'),$('compareRender'));document.querySelector('header .head-actions').before(group);
 const quality=document.createElement('div');quality.className='preview-quality';const title=document.createElement('span');title.textContent='Превью';quality.append(title);
 const select=$('quality');quality.append(select.closest('.help-action')||select);
 const previewTools=document.createElement('div');previewTools.className='preview-tools';previewTools.setAttribute('aria-label','Управление превью');
 previewTools.append(document.querySelector('.view-toggle-overlay'),document.querySelector('.zoom-controls'),document.querySelector('.points-toggle'),quality);
 document.querySelector('.render-pane>.pane-label').append(previewTools);
 document.querySelector('.stage-toolbar').remove();
 let top=20;
 for(const id of ['settingsPanel','colourPanel','referenceDialog']){
  const panel=$(id),heading=panel.querySelector('.colour-panel-header,.pane-label');panel.classList.add('resizable-panel');heading.classList.add('panel-drag-handle');heading.title='Потяните заголовок, чтобы переместить панель. Ширина закреплённой панели меняется за границу рядом с рендером.';
  if(Number.isFinite(savedWidths[id]))panel.style.width=savedWidths[id]+'px';
  const dock=document.createElement('button');dock.className='panel-dock';dock.textContent='↩';dock.type='button';dock.setAttribute('aria-label','Закрепить панель сбоку');dock.title='Закрепить сбоку';heading.insertBefore(dock,heading.lastElementChild);
  const syncDockTrack=()=>{const track=dockTracks[id];if(panel.hidden||panel.classList.contains('floating-panel')||panel.classList.contains('comparison-mode'))stage.style.removeProperty(track);else stage.style.setProperty(track,panel.getBoundingClientRect().width+18+'px');};
  const attach=()=>{panel.classList.remove('floating-panel');for(const key of ['left','top','height','zIndex'])panel.style[key]='';syncDockTrack();};dock.onclick=attach;
  let drag=null;
  function place(x,y){const bounds=stage.getBoundingClientRect(),r=panel.getBoundingClientRect();panel.style.left=Math.max(0,Math.min(x,bounds.width-r.width))+'px';panel.style.top=Math.max(0,Math.min(y,bounds.height-44))+'px';panel.style.height=Math.max(100,Math.min(drag?.height||r.height,bounds.height-parseFloat(panel.style.top)))+'px';}
  heading.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button,input,select'))return;const r=panel.getBoundingClientRect(),b=stage.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left-b.left,top:r.top-b.top,height:r.height,moved:false};heading.setPointerCapture(e.pointerId);e.preventDefault();});
  heading.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;if(!drag.moved){drag.moved=true;panel.classList.add('floating-panel');panel.style.zIndex=String(++top);syncDockTrack();}place(drag.left+dx,drag.top+dy);});
  function end(e){if(drag?.id!==e.pointerId)return;drag=null;if(heading.hasPointerCapture(e.pointerId))heading.releasePointerCapture(e.pointerId);}
  for(const name of ['pointerup','pointercancel','lostpointercapture'])heading.addEventListener(name,end);
  heading.addEventListener('dblclick',e=>{if(!e.target.closest('button'))attach();});
  panel.addEventListener('pointerdown',()=>{if(panel.classList.contains('floating-panel'))panel.style.zIndex=String(++top);});
  const resizeEdge=document.createElement('div');resizeEdge.className='panel-resize-edge';resizeEdge.tabIndex=0;resizeEdge.setAttribute('role','separator');resizeEdge.setAttribute('aria-orientation','vertical');resizeEdge.setAttribute('aria-label',id==='referenceDialog'?'Изменить ширину примеров ачивок':'Изменить ширину панели');resizeEdge.title='Зажмите и потяните, чтобы изменить ширину';resizeEdge.innerHTML='<span aria-hidden="true">⋮</span>';panel.append(resizeEdge);
  let edgeDrag=null;
  const widthBounds=()=>({min:210,max:Math.max(210,Math.min(720,stage.getBoundingClientRect().width*.72))});
  const applyWidth=width=>{const {min,max}=widthBounds(),next=Math.round(Math.max(min,Math.min(max,width)));panel.style.width=next+'px';resizeEdge.setAttribute('aria-valuemin',String(min));resizeEdge.setAttribute('aria-valuemax',String(Math.round(max)));resizeEdge.setAttribute('aria-valuenow',String(next));syncDockTrack();return next;};
  resizeEdge.addEventListener('pointerdown',e=>{if(e.button!==0||panel.classList.contains('floating-panel'))return;const rightSide=id!=='settingsPanel';edgeDrag={id:e.pointerId,x:e.clientX,width:panel.getBoundingClientRect().width,direction:rightSide?-1:1};resizeEdge.setPointerCapture(e.pointerId);document.body.classList.add('panel-edge-resizing');e.preventDefault();e.stopPropagation();});
  resizeEdge.addEventListener('pointermove',e=>{if(!edgeDrag||edgeDrag.id!==e.pointerId)return;applyWidth(edgeDrag.width+(e.clientX-edgeDrag.x)*edgeDrag.direction);});
  const endEdgeResize=e=>{if(!edgeDrag||edgeDrag.id!==e.pointerId)return;const width=applyWidth(panel.getBoundingClientRect().width);edgeDrag=null;document.body.classList.remove('panel-edge-resizing');savePanelWidth(id,width);if(resizeEdge.hasPointerCapture(e.pointerId))resizeEdge.releasePointerCapture(e.pointerId);};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])resizeEdge.addEventListener(name,endEdgeResize);
  resizeEdge.addEventListener('keydown',e=>{if(panel.classList.contains('floating-panel')||!['ArrowLeft','ArrowRight'].includes(e.key))return;const rightSide=id!=='settingsPanel',delta=(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?40:10)*(rightSide?-1:1),width=applyWidth(panel.getBoundingClientRect().width+delta);savePanelWidth(id,width);e.preventDefault();});
  applyWidth(panel.getBoundingClientRect().width||savedWidths[id]||220);
  const observer=new ResizeObserver(()=>{if(!panel.hidden&&panel.classList.contains('floating-panel'))place(parseFloat(panel.style.left)||0,parseFloat(panel.style.top)||0);syncDockTrack();});observer.observe(stage);observer.observe(panel);
  new MutationObserver(syncDockTrack).observe(panel,{attributes:true,attributeFilter:['hidden','class']});
 }
}
