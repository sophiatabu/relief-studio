import {polygonBoolean,svgCanvasBackdrop} from './svg.js';
const SIZE=1024;
const color=[25,255,85];
const canvas=()=>{const c=document.createElement('canvas');c.width=c.height=SIZE;return c;};
export const svgMismatchLimit=size=>Math.max(64,Math.round(size*size*.002));
// Independent browser SVG rasterization is the reference; it does not use our
// polygon parser, stroke offsetter or triangulator. Reject mismatches before 3D.
export async function validateSVG(source,asset){
 if(!source||!asset.sourceBounds)return;
 const xml=new DOMParser().parseFromString(source,'image/svg+xml'),root=xml.documentElement;
 // Filters change appearance, not vector boundaries; validate unfiltered geometry.
 for(const n of root.querySelectorAll('[filter]'))n.removeAttribute('filter');
 for(const n of root.querySelectorAll('[style]'))n.style.filter='none';
 const sourceViewBox=(root.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number),backdrop=svgCanvasBackdrop(root,sourceViewBox);if(backdrop)backdrop.remove();
 for(const n of root.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line'))if(!n.closest('defs,mask,clipPath')){
  // Retain whether a stroke exists, including inherited/CSS strokes. Replacing
  // its paint with a uniform diagnostic color does not change its geometry.
  let stroke=n.getAttribute('stroke')||n.style.stroke;for(let p=n.parentElement;!stroke&&p;p=p.parentElement)stroke=p.getAttribute('stroke')||p.style.stroke;
  if(stroke&&stroke!=='none'){n.setAttribute('stroke','rgb(25,255,85)');n.style.stroke='rgb(25,255,85)';}
 }
 // CSS stroke declarations are retained as such, with only their color changed.
 for(const style of root.querySelectorAll('style'))style.textContent=style.textContent.replace(/(^|[;{])\s*stroke\s*:\s*(?!none\b)[^;}]+/g,'$1stroke:rgb(25,255,85)');
 const oldViewBox=(root.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number);
 if(oldViewBox.length===4&&oldViewBox.every(Number.isFinite)){const ns=root.namespaceURI,clip=xml.createElementNS(ns,'clipPath'),rect=xml.createElementNS(ns,'rect'),group=xml.createElementNS(ns,'g');let id='relief-validation-viewport';while(xml.getElementById(id))id+='-x';clip.setAttribute('id',id);for(const [i,key]of['x','y','width','height'].entries())rect.setAttribute(key,oldViewBox[i]);clip.append(rect);group.setAttribute('clip-path','url(#'+id+')');while(root.firstChild)group.append(root.firstChild);root.append(clip,group);}
 const b=asset.sourceBounds,extent=Math.max(b.maxX-b.minX,b.maxY-b.minY),span=extent*304/240;
 root.setAttribute('viewBox',[(b.minX+b.maxX-span)/2,(b.minY+b.maxY-span)/2,span,span].join(' '));root.setAttribute('width',SIZE);root.setAttribute('height',SIZE);
 const native=canvas(),converted=canvas(),nctx=native.getContext('2d',{willReadFrequently:true}),ctx=converted.getContext('2d',{willReadFrequently:true});
 const image=new Image(),url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml'}));
 try{image.src=url;await image.decode();nctx.drawImage(image,0,0);}finally{URL.revokeObjectURL(url);}
 ctx.scale(SIZE/304,SIZE/304);
 // Join equal-colour visible regions before rasterization: drawing adjacent
 // pieces separately introduces alpha seams absent from the original SVG.
 const groups=new Map();
 for(const r of asset.regions.flatMap(r=>r.validationPaints?r.validationPaints.map(p=>({...r,loops:p.loops,validationColor:p.color})):r)){const key=r.svgAppearance?'svg-appearance':r.role==='rim'?(r.validationColor?'rim-'+JSON.stringify(r.validationColor):'rim'):JSON.stringify(r.color);if(!groups.has(key))groups.set(key,{...r,loops:[]});groups.get(key).loops.push(...r.loops);}
 // Expanded metal fills retain source pigment; visible SVG strokes overlay them.
 for(const r of [...groups.values()].sort((a,b)=>Number(a.role==='rim'&&!a.validationColor)-Number(b.role==='rim'&&!b.validationColor))){r.loops=polygonBoolean(r.loops);const paint=r.validationColor||r.color;ctx.fillStyle=r.role==='rim'&&!r.validationColor?'rgb('+color.join(',')+')':`rgb(${paint.r*255},${paint.g*255},${paint.b*255})`;ctx.beginPath();for(const loop of r.loops){loop.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.X/1000,p.Y/1000));ctx.closePath();}if(r.svgAppearance){ctx.save();ctx.clip('nonzero');ctx.drawImage(native,0,0,304,304);ctx.restore();}else ctx.fill('nonzero');}
 const a=nctx.getImageData(0,0,SIZE,SIZE).data,c=ctx.getImageData(0,0,SIZE,SIZE).data;
 const difference=(p,q,arr=a)=>Math.max(...[0,1,2,3].map(k=>Math.abs(a[p+k]-arr[q+k])));
 let bad=0;
 for(let y=2;y<SIZE-2;y++)for(let x=2;x<SIZE-2;x++){
  const i=(y*SIZE+x)*4;if(difference(i,i,c)<=24)continue;
  // Several Figma exports draw the same shared metal edge twice.  The
  // renderer intentionally unions those edges into one contour, so a small
  // band around an edge is expected rasterization drift rather than a bad
  // imported shape.
  let boundary=false;for(let dy=-8;dy<=8&&!boundary;dy++)for(let dx=-8;dx<=8;dx++)if(difference(i,i+(dy*SIZE+dx)*4)>24){boundary=true;break;}
  if(!boundary)bad++;
 }
 const mismatchLimit=svgMismatchLimit(SIZE);
 if(globalThis.__svgValidationDebug&&bad>mismatchLimit){
  native.style.width=converted.style.width='320px';native.style.height=converted.style.height='320px';
  native.dataset.validation='native';converted.dataset.validation='converted';
  document.body.append(native,converted);
 }
 if(bad>mismatchLimit)throw Error(`Контуры после импорта не совпали с исходным SVG (${bad} пикс. при проверке 1024×1024). Создание значка остановлено, чтобы не показать искажённый результат. Проверьте маски, эффекты и прозрачные наложения в исходнике, упростите их и экспортируйте SVG заново.`);
 return{size:SIZE,mismatchedPixels:bad,boundaryTolerance:8,mismatchLimit};
}
