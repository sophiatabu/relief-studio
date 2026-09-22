export const normalizeAngle=value=>((Number(value)%360)+360)%360;
export function createDirectionControl(label,onChange){
 const root=document.createElement('div');root.className='direction-control';
 const dial=document.createElement('button');dial.type='button';dial.className='direction-dial';dial.setAttribute('role','slider');dial.setAttribute('aria-label',label);dial.setAttribute('aria-valuemin','0');dial.setAttribute('aria-valuemax','359');dial.innerHTML='<span aria-hidden="true">↑</span>';
 const input=document.createElement('input');input.type='number';input.min=0;input.max=359;input.step=1;input.setAttribute('aria-label',label+' в градусах');let value=0,drag=false;
 function set(v){value=normalizeAngle(Math.round(normalizeAngle(v)));onChange(value);}
 function move(e){const r=dial.getBoundingClientRect();set(Math.atan2(e.clientX-r.left-r.width/2,-(e.clientY-r.top-r.height/2))*180/Math.PI);}
 dial.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();drag=true;dial.setPointerCapture(e.pointerId);move(e);};dial.onpointermove=e=>{if(drag)move(e);};dial.onpointerup=dial.onpointercancel=dial.onlostpointercapture=()=>{drag=false;};
 dial.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();set(value+(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*(e.shiftKey?15:5));};input.oninput=()=>{if(input.value!==''&&Number.isFinite(input.valueAsNumber))set(input.valueAsNumber);};input.onchange=()=>{set(input.value);input.value=value;};
 root.append(dial,input,document.createTextNode('°'));return {root,update(v,disabled){value=v;dial.firstChild.style.transform=`rotate(${v}deg)`;dial.setAttribute('aria-valuenow',String(v));dial.disabled=input.disabled=disabled;if(document.activeElement!==input)input.value=v;}};
}
