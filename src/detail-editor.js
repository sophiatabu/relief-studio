import {detailPath,normalizeAssignments} from './detail-document.js';

export function createDetailEditor({read,apply,pause,resume}){
 const dialog=document.createElement('dialog');dialog.className='detail-editor';
 dialog.innerHTML=`<header><h2>Редактор деталей</h2><button type="button" data-action="cancel">Отмена</button><button type="button" data-action="apply">Применить</button></header><div class="detail-tools"><button data-action="undo">Отменить</button><button data-action="redo">Вернуть</button><button data-action="same">Выбрать тот же цвет</button><label>Роль <select aria-label="Роль выбранных деталей"><option value="">Выберите роль</option><option value="rim">Контур</option><option value="enamel">Поверхность</option><option value="hidden">Скрыть</option><option value="cutout">Вырез</option></select></label><label>Цвет <input type="color" aria-label="Цвет выбранных деталей"></label><span data-count></span></div><div class="detail-layout"><div class="detail-canvas"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 304 304" aria-label="Исходные детали SVG"></svg></div><div class="detail-list" aria-label="Список деталей"></div></div><footer><span role="status">Выберите деталь. Shift — выбрать несколько.</span></footer>`;
 document.body.append(dialog);
 const svg=dialog.querySelector('svg'),list=dialog.querySelector('.detail-list'),status=dialog.querySelector('[role=status]'),role=dialog.querySelector('select'),color=dialog.querySelector('input');
 let asset,draft={},initial='',selected=new Set(),past=[],future=[],applying=false;
 const current=p=>({...p,...draft[p.id]});
 const snapshot=()=>JSON.stringify(draft);
 function record(){past.push(snapshot());future=[];}
 function select(id,add){if(!add)selected.clear();if(add&&selected.has(id))selected.delete(id);else selected.add(id);paint();}
 function paint(){
  svg.replaceChildren();list.replaceChildren();
  for(const p of asset.editablePaints){
   const v=current(p),path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',detailPath(p.loops));path.setAttribute('fill',v.color);path.setAttribute('fill-rule','nonzero');
   if(v.role==='hidden')path.style.display='none';
   if(selected.has(p.id)){path.setAttribute('stroke','#dcff9c');path.setAttribute('stroke-width','1');path.style.filter='drop-shadow(0 0 2px #111)';}
   path.onclick=e=>{e.stopPropagation();select(p.id,e.shiftKey||e.metaKey||e.ctrlKey);};svg.append(path);
   const row=document.createElement('button');row.type='button';row.className='detail-item';row.classList.toggle('selected',selected.has(p.id));row.setAttribute('aria-pressed',selected.has(p.id));
   const sw=document.createElement('span');sw.className='detail-swatch';sw.style.background=v.color;
   const label=document.createElement('span');label.textContent=p.label||p.id;
   const badge=document.createElement('small');badge.textContent={rim:'Контур',enamel:'Поверхность',hidden:'Скрыто',cutout:'Вырез'}[v.role];row.append(sw,label,badge);row.onclick=e=>select(p.id,e.shiftKey||e.metaKey||e.ctrlKey);list.append(row);
  }
  const values=asset.editablePaints.filter(p=>selected.has(p.id)).map(current);role.value=values.length&&values.every(v=>v.role===values[0].role)?values[0].role:'';if(values.length)color.value=values[0].color;
  role.disabled=color.disabled=!values.length;dialog.querySelector('[data-count]').textContent=`Выбрано: ${values.length}`;
  dialog.querySelector('[data-action=undo]').disabled=!past.length;dialog.querySelector('[data-action=redo]').disabled=!future.length;
  dialog.querySelector('[data-action=apply]').disabled=applying||snapshot()===initial;
 }
 function change(key,value){if(!selected.size)return;record();for(const p of asset.editablePaints)if(selected.has(p.id))draft[p.id]={role:current(p).role,color:current(p).color,[key]:value};draft=normalizeAssignments(asset.editablePaints,draft);paint();}
 role.onchange=()=>{if(role.value)change('role',role.value);};color.onchange=()=>change('color',color.value);
 function close(){if(applying)return;dialog.close();svg.replaceChildren();list.replaceChildren();asset=null;resume();}
 dialog.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();dialog.querySelector(e.shiftKey?'[data-action=redo]':'[data-action=undo]').click();}});
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.querySelector('[data-action=cancel]').onclick=close;
 dialog.querySelector('[data-action=same]').onclick=()=>{const colors=new Set(asset.editablePaints.filter(p=>selected.has(p.id)).map(p=>current(p).color));selected=new Set(asset.editablePaints.filter(p=>colors.has(current(p).color)).map(p=>p.id));paint();};
 dialog.querySelector('[data-action=undo]').onclick=()=>{if(past.length){future.push(snapshot());draft=JSON.parse(past.pop());paint();}};
 dialog.querySelector('[data-action=redo]').onclick=()=>{if(future.length){past.push(snapshot());draft=JSON.parse(future.pop());paint();}};
 dialog.querySelector('[data-action=apply]').onclick=async()=>{
  applying=true;dialog.querySelector('.detail-layout').inert=true;dialog.querySelector('.detail-tools').inert=true;dialog.querySelector('[data-action=apply]').disabled=true;status.textContent='Собираем модель…';
  try{await apply(draft);applying=false;close();}catch(e){status.textContent=e.message;applying=false;paint();}finally{dialog.querySelector('.detail-layout').inert=false;dialog.querySelector('.detail-tools').inert=false;}
 };
 return {open(){if(dialog.open)return;asset=read();if(!asset?.editablePaints?.length)throw Error('Загрузите SVG для редактирования деталей.');draft=structuredClone(asset.detailAssignments||{});initial=snapshot();selected=new Set();past=[];future=[];status.textContent='Выберите деталь. Shift — выбрать несколько.';pause();paint();dialog.showModal();},get isOpen(){return dialog.open;}};
}
