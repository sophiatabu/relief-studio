export function resetButton(label,action){const button=document.createElement('button');button.type='button';button.className='reset-control';button.textContent='↺';button.setAttribute('aria-label',label);button.title=label;button.onclick=e=>{e.preventDefault();e.stopPropagation();action();};return button;}
export function showReset(button,dirty){button.hidden=!dirty;button.disabled=!dirty;}
export function inlineReset(row,button){
 const wrapper=document.createElement('div');wrapper.className='reset-field';
 row.before(wrapper);wrapper.append(row,button);button.classList.add('reset-icon');button.textContent='↺';
 return wrapper;
}
