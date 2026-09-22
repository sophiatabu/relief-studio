export function setupReferenceZoom(){
 const viewport=document.querySelector('.reference-gallery'),board=document.querySelector('.reference-board');
 const minus=document.getElementById('referenceZoomOut'),plus=document.getElementById('referenceZoomIn'),reset=document.getElementById('referenceZoomReset');
 let zoom=1,drag=null;const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function draw(){if(!viewport.clientWidth)return;board.style.width=viewport.clientWidth*zoom+'px';viewport.classList.toggle('zoomed',zoom>1);minus.disabled=zoom<=1;plus.disabled=zoom>=4;reset.textContent=Math.round(zoom*100)+'%';reset.title='Сбросить масштаб';}
 function changeZoom(next,anchorX=viewport.clientWidth/2,anchorY=viewport.clientHeight/2){next=clamp(next,1,4);const ratio=next/zoom,left=(viewport.scrollLeft+anchorX)*ratio-anchorX,top=(viewport.scrollTop+anchorY)*ratio-anchorY;zoom=next;draw();viewport.scrollLeft=left;viewport.scrollTop=top;}
 minus.onclick=()=>changeZoom(zoom-.25);plus.onclick=()=>changeZoom(zoom+.25);reset.onclick=()=>changeZoom(1);
 viewport.tabIndex=0;
 viewport.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const r=viewport.getBoundingClientRect(),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?r.height:1);changeZoom(zoom*Math.exp(-clamp(delta,-150,150)*.003),e.clientX-r.left,e.clientY-r.top);},{passive:false});
 viewport.addEventListener('keydown',e=>{if(['+','=','-','0'].includes(e.key)){e.preventDefault();changeZoom(e.key==='0'?1:zoom+(e.key==='-'?-.25:.25));}});
 viewport.addEventListener('dragstart',e=>e.preventDefault());
 viewport.addEventListener('pointerdown',e=>{if(e.button!==0||e.target===viewport)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};viewport.setPointerCapture(e.pointerId);viewport.classList.add('panning');});
 viewport.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;viewport.scrollLeft-=e.clientX-drag.x;viewport.scrollTop-=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;});
 function stop(e){if(drag?.id!==e.pointerId)return;drag=null;viewport.classList.remove('panning');if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);}
 for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,stop);
 new ResizeObserver(draw).observe(viewport);draw();
}
