const rows=new Map(),container=document.querySelector('#rows'),connection=document.querySelector('#connection');
const draftKey='relief-svg-review-drafts-v1';let drafts={},filter='all',loaded=false,polling=false;
try{drafts=JSON.parse(localStorage.getItem(draftKey)||'{}');}catch{}
function persistDrafts(){try{localStorage.setItem(draftKey,JSON.stringify(drafts));}catch{connection.textContent='Черновик не помещается в браузере. Не закрывайте страницу до сохранения.';connection.classList.add('offline');}}
function saveState(row,text,kind=''){row.save.textContent=text;row.save.className='save-state '+kind;}
async function save(row){
 clearTimeout(row.timer);if(row.saving||!row.dirty)return;
 row.saving=true;const text=row.input.value;saveState(row,'Сохраняем…');
 try{
  const response=await fetch('/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:row.file,text}),keepalive:true});
  if(!response.ok)throw Error('Save failed');const saved=await response.json();
  row.savedText=text;row.dirty=row.input.value!==text;
  if(!row.dirty){delete drafts[row.file];persistDrafts();saveState(row,text?'Сохранено':'Комментарий удалён','saved');}
  connection.textContent='Автосохранение включено';connection.classList.remove('offline');
 }catch{saveState(row,'Нет связи. Черновик сохранён в браузере, повторим автоматически.','unsaved');row.timer=setTimeout(()=>save(row),5000);}
 finally{row.saving=false;if(row.dirty&&row.savedText===text)row.timer=setTimeout(()=>save(row),100);}
}
function createRow(item,saved){
 const article=document.createElement('article');article.className='review-row';article.dataset.file=item.file;
 const original=document.createElement('section'),title=document.createElement('div');title.className='file-title';
 const name=document.createElement('strong');name.textContent=item.file;title.append(name);
 const sourceFrame=document.createElement('div');sourceFrame.className='frame';const source=document.createElement('img');source.className='source-image';source.src='/svg/'+encodeURIComponent(item.file);source.alt='Исходный SVG '+item.file;source.loading='lazy';source.decoding='async';sourceFrame.append(source);
 const originalName=document.createElement('div');originalName.className='original-name';originalName.textContent=item.source;original.append(title,sourceFrame,originalName);
 const render=document.createElement('section'),renderTitle=document.createElement('div');renderTitle.className='file-title';const renderLabel=document.createElement('strong');renderLabel.textContent='Результат';const status=document.createElement('span');status.className='status';renderTitle.append(renderLabel,status);const frame=document.createElement('div');frame.className='frame';render.append(renderTitle,frame);
 const comment=document.createElement('section');comment.className='comment';const label=document.createElement('label');label.htmlFor='comment-'+item.file;label.textContent='Ваше замечание';const input=document.createElement('textarea');input.id=label.htmlFor;input.setAttribute('aria-label','Комментарий к '+item.file);input.placeholder='Например: пропал контур справа, обрезалась тень, цвет слишком тёмный…';input.spellcheck=true;const saveLabel=document.createElement('div');saveLabel.className='save-state';saveLabel.setAttribute('role','status');comment.append(label,input,saveLabel);
 article.append(original,render,comment);container.append(article);
 const draft=drafts[item.file],recover=draft&&draft.text!==(saved?.text||'')&&(!saved?.updatedAt||draft.editedAt>Date.parse(saved.updatedAt));
 input.value=recover?draft.text:(saved?.text||'');
 const row={file:item.file,item,article,input,save:saveLabel,status,frame,dirty:Boolean(recover),saving:false,savedText:saved?.text||'',result:null,signature:''};rows.set(item.file,row);
 saveState(row,recover?'Восстанавливаем черновик…':input.value?'Сохранено':'Сохранится автоматически',input.value?'saved':'');
 input.addEventListener('input',()=>{row.dirty=true;drafts[item.file]={text:input.value,editedAt:Date.now()};persistDrafts();saveState(row,'Есть изменения…');clearTimeout(row.timer);row.timer=setTimeout(()=>save(row),450);});
 input.addEventListener('blur',()=>{save(row);applyFilter();});
 if(recover)save(row);return row;
}
function updateResult(row,result){
 const signature=JSON.stringify([result?.status,result?.message,result?.totalMs]);if(signature===row.signature)return;row.signature=signature;row.result=result;
 row.frame.replaceChildren();
 if(result?.status==='pass'){
  row.status.textContent='Готово';row.status.className='status pass';const image=document.createElement('img');image.src='/render/'+encodeURIComponent(row.file);image.alt='Рендер '+row.file;image.loading='lazy';image.decoding='async';row.frame.append(image);
 }else{
  const message=document.createElement('div');message.className='render-state'+(result?' error':'');const heading=document.createElement('strong');heading.textContent=result?'Не удалось отрендерить':'Рендер ещё проверяется';const body=document.createElement('span');body.textContent=result?(result.message||'Ошибка обработки SVG').replace(/^Не получилось завершить действие:\s*/,''):'Результат появится здесь автоматически. Уже можно оставить замечание к исходнику.';message.append(heading,body);row.frame.append(message);
  row.status.textContent=result?'Ошибка':'Ожидание';row.status.className='status'+(result?' error':'');
 }
}
function applyFilter(){const query=document.querySelector('#search').value.toLowerCase().trim();let count=0;for(const row of rows.values()){
 const matches=(row.file+' '+row.item.source).toLowerCase().includes(query);
 const show=matches&&(filter==='all'||filter==='errors'&&row.result&&row.result.status!=='pass'||filter==='comments'&&row.input.value.trim());
 row.article.hidden=!show;if(show)count++;
}document.querySelector('#empty').hidden=count>0;}
async function refresh(){if(polling)return;polling=true;try{
 const response=await fetch('/api/state');if(!response.ok)throw Error('Disconnected');const state=await response.json();
 for(const item of state.manifest){const row=rows.get(item.file)||createRow(item,state.comments[item.file]);updateResult(row,state.results[item.file]);if(!row.dirty&&!row.saving&&document.activeElement!==row.input){const saved=state.comments[item.file]?.text||'';if(saved!==row.savedText){row.input.value=row.savedText=saved;saveState(row,saved?'Сохранено':'Сохранится автоматически',saved?'saved':'');}}}
 const done=Object.values(state.results),passed=done.filter(r=>r.status==='pass').length;document.querySelector('#summary').textContent=`Проверено ${done.length} из ${state.manifest.length} · готово ${passed} · ошибок ${done.length-passed}`;
 if(!loaded){applyFilter();loaded=true;}else if(document.activeElement?.tagName!=='TEXTAREA')applyFilter();
 connection.classList.remove('offline');connection.textContent='Автосохранение включено';
 }catch{connection.classList.add('offline');connection.textContent='Нет связи с локальным сервером. Черновики остаются в браузере.';}finally{polling=false;}}
for(const button of document.querySelectorAll('[data-filter]'))button.onclick=()=>{filter=button.dataset.filter;for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b===button));applyFilter();};
document.querySelector('#search').addEventListener('input',applyFilter);
addEventListener('pagehide',()=>{for(const row of rows.values())if(row.dirty)navigator.sendBeacon('/api/comments',new Blob([JSON.stringify({file:row.file,text:row.input.value})],{type:'application/json'}));});
refresh();setInterval(refresh,3000);
