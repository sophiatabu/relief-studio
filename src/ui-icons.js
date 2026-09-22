const paths={
 file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/>',
 template:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M8 9h13"/>',
 test:'<path d="M9 3h6M10 3v6l-5 8.5A2.3 2.3 0 0 0 7 21h10a2.3 2.3 0 0 0 2-3.5L14 9V3"/><path d="M7.5 15h9"/>',
 upload:'<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M4 15v5h16v-5"/>',
 download:'<path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5"/><path d="M4 19h16"/>',
 settings:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
 colours:'<path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3.3-4-6-9-6Z"/><circle cx="7.5" cy="9" r="1"/><circle cx="10.5" cy="6.5" r="1"/><circle cx="15" cy="7" r="1"/>',
 examples:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.5"/><path d="m5 17 4-4 3 3 3-3 4 4"/>',
 view:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
 apply:'<path d="m5 12 4 4L19 6"/>',
 save:'<path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
 open:'<path d="M3 7h7l2 2h9l-3 10H5z"/><path d="M3 7v12h2"/>',
 cube:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
 offline:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M12 7v6m0 0 2.5-2.5M12 13l-2.5-2.5"/>'
};

export function addIcon(element,name){
 if(!element||element.querySelector(':scope > .ui-icon')||!paths[name])return;
 const icon=document.createElement('span');icon.className='ui-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
 element.prepend(icon);element.classList.add('has-ui-icon');
}
