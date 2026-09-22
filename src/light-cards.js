import {resetButton,inlineReset,showReset} from './reset-button.js';
// Every source owns its controls; adjusting darkness never changes the light form.
export function createLightCards(root,{change,remove,reset,dirty}){
 const cards=new Map();
 const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;};
 const format=(key,value)=>['azimuth','elevation'].includes(key)?Math.round(value)+'°':key==='softness'?Number(value).toFixed(1):Math.round(value*100)+'%';
 function render(sources,selected){
  cards.clear();root.replaceChildren();let lightNumber=0,darkNumber=0,stripNumber=0;
  for(const source of sources){
   const dark=source.kind==='dark',strip=source.shape==='strip',number=dark?++darkNumber:strip?++stripNumber:++lightNumber,title=strip?'Свет для бликов'+(number>1?' '+number:''):(dark?'Затемнение':'Свет')+' '+number;
   const card=el('section','source-card'+(dark?' dark':''));card.setAttribute('aria-label',title);card.dataset.sourceId=source.id;
   const header=el('div','source-card-header'),icon=el('span','source-card-icon',dark?'◐':strip?'✦':'☀');icon.setAttribute('aria-hidden','true');header.append(icon,el('strong','',title));
   const sourceReset=resetButton('Сбросить '+title,()=>reset(source));sourceReset.dataset.resetSource='all';header.append(sourceReset);card.append(header);
   const controls=new Map();
   const slider=(parent,key,label,min,max,step)=>{
    const row=el('label','source-control'),heading=el('span','source-control-heading'),out=el('output'),input=el('input');input.type='range';input.min=min;input.max=max;input.step=step;input.setAttribute('aria-label',title+': '+label);heading.append(el('span','',label),out);row.append(heading,input);parent.append(row);
    input.oninput=()=>{source[key]=Number(input.value);out.textContent=format(key,source[key]);change(source);};const fieldReset=resetButton('Сбросить '+title+': '+label,()=>reset(source,key));fieldReset.dataset.resetSource=key;controls.set(key,{input,out,reset:fieldReset});inlineReset(row,fieldReset);
   };
   slider(card,'power',dark?'Сила затемнения':strip?'Сила бликов':'Яркость',0,3,.01);
   slider(card,'softness',dark?'Плавность перехода':strip?'Размер источника':'Размер источника',.3,4,.1);
   const influence=el('fieldset','source-influence'),influenceTitle=el('legend','','Влияние на материалы');influence.append(influenceTitle);
   slider(influence,'surfaceInfluence','На поверхности',0,1,.01);
   slider(influence,'contourInfluence','На контуре',0,1,.01);
   card.append(influence);
   const detail=el('details','source-details');detail.append(el('summary','',dark?'Цвета и положение':'Цвет и положение'));
   const blendLabel=el('label','inline-check'),blend=el('input');blend.type='checkbox';blend.setAttribute('aria-label',title+': '+(dark?'сохранить сочность':'мягкое высветление'));blend.onchange=()=>{source.blendMode=blend.checked?(dark?'multiply':'screen'):(dark?'neutral':'none');change(source);};blendLabel.append(blend,el('span','',dark?'Сохранить сочность цветов':'Мягко высветлять цвета'));detail.append(blendLabel);blendLabel.hidden=strip;
   slider(detail,'richness',dark?'Сочность в тени':'Сила высветления',0,1,.05);if(strip)detail.lastElementChild.hidden=true;
   let color;
   if(!dark){const label=el('label','source-colour','Цвет света');color=el('input');color.type='color';color.setAttribute('aria-label',title+': цвет света');color.oninput=()=>{source.color=color.value;change(source);};label.append(color);const colorReset=resetButton('Сбросить '+title+': цвет света',()=>reset(source,'color'));colorReset.dataset.resetSource='color';detail.append(label,colorReset);}
   slider(detail,'azimuth','Направление',-180,180,1);slider(detail,'elevation','Угол к поверхности',10,90,.5);
   const del=el('button','source-delete','Удалить '+(dark?'затемнение':'свет'));del.disabled=sources.length===1;del.onclick=()=>remove(source.id);detail.append(del);card.append(detail);root.append(card);cards.set(source.id,{card,blend,color,controls});
  }
  update(sources,selected);
 }
 function update(sources,selected){
  for(const source of sources){const c=cards.get(source.id);if(!c)continue;c.card.classList.toggle('selected',source.id===selected);c.card.classList.toggle('disabled-source',!source.enabled);c.blend.checked=!['neutral','none'].includes(source.blendMode);if(c.color)c.color.value=source.color;
   for(const [key,{input,out}]of c.controls){input.value=source[key]??.15;out.textContent=format(key,Number(input.value));input.disabled=!source.enabled||(key==='richness'&&!c.blend.checked);}
   for(const button of c.card.querySelectorAll('[data-reset-source]'))showReset(button,dirty(source,button.dataset.resetSource==='all'?null:button.dataset.resetSource));
  }
 }
 return {render,update};
}
