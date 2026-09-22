import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import C from 'clipper-lib';
import {redundantRims} from './rim-dedup.js';
const S=1000;
export function coversViewBoxRect(rect,viewBox,tolerance=1e-6){
 if(!rect||viewBox.length!==4||!viewBox.every(Number.isFinite))return false;
 const [vx,vy,vw,vh]=viewBox,[x,y,w,h]=rect;
 return [x,y,w,h].every(Number.isFinite)&&Math.abs(x-vx)<=tolerance&&Math.abs(y-vy)<=tolerance&&Math.abs(w-vw)<=tolerance&&Math.abs(h-vh)<=tolerance;
}
export function svgCanvasBackdrop(root,viewBox){
 const children=[...root.children],drawables=children.filter(n=>/^(path|rect|circle|ellipse|polygon|polyline|line)$/i.test(n.localName));
 if(drawables.length<2)return null;
 return children.find(n=>{
  if(n.localName!=='rect'||n.hasAttribute('mask')||n.hasAttribute('clip-path')||n.hasAttribute('transform'))return false;
  const stroke=(n.getAttribute('stroke')||n.style?.stroke||'none').trim().toLowerCase();
  const opacity=Number(n.getAttribute('opacity')||n.style?.opacity||1),fillOpacity=Number(n.getAttribute('fill-opacity')||n.style?.fillOpacity||1);
  return stroke==='none'&&opacity>=.999&&fillOpacity>=.999&&coversViewBoxRect([Number(n.getAttribute('x')||0),Number(n.getAttribute('y')||0),Number(n.getAttribute('width')),Number(n.getAttribute('height'))],viewBox);
 })||null;
}
export function paintServerId(value){
 if(!value)return null;
 const normalized=String(value).trim();
 if(!normalized||normalized.toLowerCase()==='none')return null;
 return normalized.match(/^url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)$/i)?.[1]||null;
}
function whitePaint(value){
 const color=String(value||'').trim().toLowerCase().replace(/\s+/g,'');
 return color==='white'||color==='#fff'||color==='#ffffff'||color==='rgb(255,255,255)'||color==='rgba(255,255,255,1)';
}
function blackPaint(value){
 const color=String(value||'').trim().toLowerCase().replace(/\s+/g,'');
 return color==='black'||color==='#000'||color==='#000000'||color==='rgb(0,0,0)'||color==='rgba(0,0,0,1)';
}
function inheritedPaint(node,attribute,root){
 for(let n=node;n&&n!==root.parentElement;n=n.parentElement){
  const value=n.getAttribute?.(attribute)||n.style?.getPropertyValue?.(attribute);if(value)return value;
  if(n===root)break;
 }
 return '';
}
function inheritedOpacity(node,root){
 let opacity=1;
 for(let n=node;n&&n!==root.parentElement;n=n.parentElement){
  for(const attribute of ['opacity','fill-opacity']){const raw=n.getAttribute?.(attribute)||n.style?.getPropertyValue?.(attribute);if(raw!==null&&raw!==''){const value=Number(raw);if(Number.isFinite(value))opacity*=value;}}
  if(n===root)break;
 }
 return opacity;
}
export function maskPaintSupported(type,fill,opacity=1){
 if(!Number.isFinite(opacity)||opacity<.999)return false;
 return type==='alpha'?(String(fill||'').trim().toLowerCase()!=='none'):(whitePaint(fill)||blackPaint(fill));
}
export function maskPaintKind(type,fill,opacity=1){
 if(!maskPaintSupported(type,fill,opacity))return 'unsupported';
 return type==='luminance'&&blackPaint(fill)?'cut':'keep';
}
export function ribbonCoverage(loops){
 const points=loops.flat();if(points.length<3)return 1;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of points){minX=Math.min(minX,p.X);minY=Math.min(minY,p.Y);maxX=Math.max(maxX,p.X);maxY=Math.max(maxY,p.Y);}
 const box=(maxX-minX)*(maxY-minY);if(box<=0)return 1;
 return Math.abs(loops.reduce((area,loop)=>area+C.Clipper.Area(loop),0))/box;
}
export function isMetalFill(color,strokeColors=new Set()){
 const hex=color.getHexString();if(strokeColors.has(hex))return true;
 const value=parseInt(hex,16),r=value>>16,g=value>>8&255,b=value&255;
 return Math.max(r,g,b)<=105&&Math.max(r,g,b)-Math.min(r,g,b)<=14;
}
export function polygonBoolean(subject,cutters=[],operation=C.ClipType.ctUnion,rule='nonzero'){
 const c=new C.Clipper();c.AddPaths(subject,C.PolyType.ptSubject,true);if(cutters.length)c.AddPaths(cutters,C.PolyType.ptClip,true);
 const out=[];c.Execute(operation,out,rule==='evenodd'?C.PolyFillType.pftEvenOdd:C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);return out;
}
export function filledPath(path,flatten){
 const loops=path.subPaths.map(p=>flatten(p).map(q=>({X:Math.round(q.x*S),Y:Math.round(q.y*S)}))).filter(p=>p.length>2);
 return polygonBoolean(loops,[],C.ClipType.ctUnion,path.userData.style.fillRule);
}
function matrixOf(node){const chain=[];for(let n=node;n?.nodeType===1;n=n.parentElement)chain.unshift(n);let m=new DOMMatrix();for(const n of chain){const a=n.transform?.baseVal?.consolidate()?.matrix;if(a)m=m.multiply(a);}return m;}
function transformLoops(loops,m){return loops.map(p=>p.map(q=>{const v=m.transformPoint({x:q.X/S,y:q.Y/S});return{X:Math.round(v.x*S),Y:Math.round(v.y*S)};}));}
export function readSVG(text,name,flatten){
 if(text.length>3_000_000)throw Error('SVG слишком большой для импорта: допустимо до 3 миллионов символов. Удалите ненужные объекты и экспортируйте файл снова.');
 const xml=new DOMParser().parseFromString(text,'image/svg+xml');if(xml.querySelector('parsererror'))throw Error('Не удалось прочитать SVG: структура файла повреждена. Экспортируйте его заново из векторного редактора.');
 if(xml.querySelector('image,linearGradient,radialGradient,text,use,filter,foreignObject'))throw Error('В SVG есть неподдерживаемые элементы: изображения, градиенты, текст, символы или эффекты. Используйте векторные фигуры со сплошной заливкой; преобразуйте текст и символы в кривые, удалите изображения и эффекты, замените градиенты сплошными цветами.');
 const parsed=new SVGLoader().parse(text),paints=[],strokeWidths=[];
 const vb=(xml.documentElement.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number);
 // SVGLoader parses its own DOM document. Identify the backdrop in that copy,
 // otherwise object identity can never match the nodes in parsed.paths.
 const parsedRoot=parsed.paths[0]?.userData.node?.ownerDocument?.documentElement;
 const canvasBackdrop=parsedRoot&&svgCanvasBackdrop(parsedRoot,vb);
 const rootClip=vb.length===4&&vb.every(Number.isFinite)&&vb[2]>0&&vb[3]>0?transformLoops([[{X:vb[0]*S,Y:vb[1]*S},{X:(vb[0]+vb[2])*S,Y:vb[1]*S},{X:(vb[0]+vb[2])*S,Y:(vb[1]+vb[3])*S},{X:vb[0]*S,Y:(vb[1]+vb[3])*S}]],matrixOf(xml.documentElement)):null;
 function constraints(loops,node){for(let n=node;n?.nodeType===1;n=n.parentElement)for(const attr of ['clip-path','mask']){
  const value=n.getAttribute(attr)||n.style?.getPropertyValue(attr);if(!value||String(value).trim().toLowerCase()==='none')continue;
  const id=paintServerId(value);if(!id)continue;
  const def=xml.getElementById(id);if(!def)throw Error('В SVG есть ссылка на отсутствующую маску. Экспортируйте файл заново.');
  if((def.getAttribute(attr==='mask'?'maskContentUnits':'clipPathUnits')||'userSpaceOnUse')!=='userSpaceOnUse')throw Error('Этот способ задания маски не поддерживается. Примените маску к фигурам в векторном редакторе и экспортируйте результат заново.');
  if(attr==='mask'){
   const type=(def.getAttribute('mask-type')||def.style?.getPropertyValue('mask-type')||'luminance').trim().toLowerCase();
   const shapes=[...def.querySelectorAll('path,rect,circle,ellipse,polygon,polyline')];
   // Figma commonly emits alpha masks with a solid shape plus an outline,
   // or with a stroke-only duplicate of that shape.  An alpha mask uses
   // opacity, so the paint colour and stroke are both valid mask geometry;
   // keep the filled geometry here and let the normal SVG rasterizer account
   // for the outline when it is the only visible part.
   if(!shapes.length||shapes.some(c=>{
    const fill=inheritedPaint(c,'fill',def)||'none',stroke=inheritedPaint(c,'stroke',def)||'none';
    if(type==='alpha')return (!maskPaintSupported(type,fill,inheritedOpacity(c,def))&&stroke.toLowerCase()==='none')||(!Number.isFinite(inheritedOpacity(c,def))||inheritedOpacity(c,def)<.999);
    return !maskPaintSupported(type,fill,inheritedOpacity(c,def))||stroke.toLowerCase()!=='none';
   }))throw Error(type==='alpha'?'Эта альфа-маска содержит прозрачность, градиент или обводку, которые нельзя без потерь превратить в объём. Примените маску к фигурам перед экспортом SVG.':'Эта маска содержит промежуточную яркость, прозрачность, градиент или обводку. Поддерживаются сплошные белые и чёрные фигуры маски.');
  }
  const doc=def.cloneNode(true),maskType=attr==='mask'?(def.getAttribute('mask-type')||def.style?.getPropertyValue('mask-type')||'luminance').trim().toLowerCase():null;
  const renderMaskPart=kind=>{
   const part=doc.cloneNode(true),partShapes=[...part.querySelectorAll('path,rect,circle,ellipse,polygon,polyline')],sourceShapes=[...def.querySelectorAll('path,rect,circle,ellipse,polygon,polyline')];
   for(const [index,c] of partShapes.entries()){
    if(maskType){
     const original=sourceShapes[index];
     const paintKind=maskPaintKind(maskType,inheritedPaint(original,'fill',def)||'black',inheritedOpacity(original,def));
     if(paintKind!==kind){c.remove();continue;}
    }
    c.removeAttribute('stroke');c.setAttribute('fill','#fff');c.removeAttribute('mask');c.removeAttribute('clip-path');
   }
   return part;
  };
  const m=matrixOf(n),svg='<svg xmlns="http://www.w3.org/2000/svg"><g transform="matrix('+[m.a,m.b,m.c,m.d,m.e,m.f].join(' ')+')">'+doc.innerHTML+'</g></svg>';
  const svgOf=part=>'<svg xmlns="http://www.w3.org/2000/svg"><g transform="matrix('+[m.a,m.b,m.c,m.d,m.e,m.f].join(' ')+')">'+part.innerHTML+'</g></svg>';
  let mask;
  if(maskType){
   const keep=polygonBoolean(new SVGLoader().parse(svgOf(renderMaskPart('keep'))).paths.flatMap(p=>filledPath(p,flatten)));
   const cut=polygonBoolean(new SVGLoader().parse(svgOf(renderMaskPart('cut'))).paths.flatMap(p=>filledPath(p,flatten)));
   mask=polygonBoolean(keep,cut,C.ClipType.ctDifference);
  }else mask=polygonBoolean(new SVGLoader().parse(svg).paths.flatMap(p=>filledPath(p,flatten)));
  loops=polygonBoolean(loops,mask,C.ClipType.ctIntersection);
 }return rootClip?polygonBoolean(loops,rootClip,C.ClipType.ctIntersection):loops;}
 for(const path of parsed.paths){
  const {style,node}=path.userData;if(node.closest('defs,mask,clipPath'))continue;let hidden=style.visibility==='hidden'||style.visibility==='collapse'||style.opacity===0;
  if(node===canvasBackdrop)continue;
  for(let n=node;n?.nodeType===1;n=n.parentElement)if(n.getAttribute('display')==='none'||n.style?.display==='none'||n.getAttribute('opacity')==='0')hidden=true;
  if(hidden)continue;
  const filled=!!(style.fill&&style.fill!=='none'&&style.fillOpacity!==0);
  const add=(loops,role,color,metadata={})=>{loops=constraints(loops,node);if(loops.length)paints.push({loops,role,color,...metadata});};
  if(style.fill&&style.fill!=='none'&&style.fillOpacity!==0)add(filledPath(path,flatten),'fill',path.color.clone());
  if(style.stroke&&style.stroke!=='none'&&style.strokeOpacity!==0&&style.strokeWidth>0){
   if(node.getAttribute('stroke-dasharray')||node.style?.strokeDasharray)throw Error('Пунктирная обводка не поддерживается. Преобразуйте её в отдельные векторные фигуры перед экспортом SVG.');
   const m=matrixOf(node),inverse=m.inverse(),stroke=[];
   let width=style.strokeWidth*Math.sqrt(Math.abs(m.a*m.d-m.b*m.c));const maskId=(node.getAttribute('mask')||'').match(/#([^)'"\s]+)/)?.[1],maskNode=maskId&&xml.getElementById(maskId);if(maskNode?.children.length===1&&maskNode.children[0].getAttribute('d')===node.getAttribute('d'))width*=.5;strokeWidths.push(width);
   for(const sub of path.subPaths){
    const points=flatten(sub,.01).map(v=>{const p=inverse.transformPoint(v);return{X:Math.round(p.x*S),Y:Math.round(p.y*S)}});
    if(points.length<2)continue;
    const closed=sub.autoClose||(points.length>2&&points[0].X===points.at(-1).X&&points[0].Y===points.at(-1).Y);if(closed&&points[0].X===points.at(-1).X&&points[0].Y===points.at(-1).Y)points.pop();
    const offset=new C.ClipperOffset(style.strokeMiterLimit||4,.01*S),out=[];
    const join=style.strokeLineJoin==='round'?C.JoinType.jtRound:style.strokeLineJoin==='bevel'?C.JoinType.jtSquare:C.JoinType.jtMiter;
    const end=closed?C.EndType.etClosedLine:style.strokeLineCap==='round'?C.EndType.etOpenRound:style.strokeLineCap==='square'?C.EndType.etOpenSquare:C.EndType.etOpenButt;
    offset.AddPath(points,join,end);offset.Execute(out,style.strokeWidth*S/2);stroke.push(...transformLoops(out,m));
   }
   add(polygonBoolean(stroke),'rim',new THREE.Color(style.stroke),{filled,width,closed:path.subPaths.every(s=>s.autoClose),footprint:filledPath(path,flatten)});
  }
 }
 // Apply SVG paint order before joining the metal. Covered paths cannot reappear
 // as raised metal simply because all strokes were moved to the top of the scene.
 const visible=paints.map((p,i)=>({...p,loops:polygonBoolean(p.loops,paints.slice(i+1).filter(q=>q.role==='fill').flatMap(q=>q.loops),C.ClipType.ctDifference)})).filter(p=>p.loops.length);
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of visible.flatMap(p=>p.loops).flat()){minX=Math.min(minX,p.X);minY=Math.min(minY,p.Y);maxX=Math.max(maxX,p.X);maxY=Math.max(maxY,p.Y);}
 if(!isFinite(minX)||Math.max(maxX-minX,maxY-minY)<1)throw Error('В SVG нет видимых векторных фигур подходящего размера. Проверьте, что экспортируете сами фигуры, а не пустой фрейм.');
 const extent=Math.max(maxX-minX,maxY-minY),scale=240*S/extent,cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 const norm=loops=>loops.map(l=>l.map(p=>({X:Math.round((p.X-cx)*scale+152*S),Y:Math.round((p.Y-cy)*scale+152*S)})));
 const strokeColors=new Set(paints.filter(p=>p.role==='rim').map(p=>p.color.getHexString()));
 // In badge artwork, dark neutral vector fills are expanded metal paths.
 // A fill that uses the stroke colour is metal regardless of its area: broad
 // junctions must merge with neighbouring strokes instead of becoming enamel.
 const expandedRims=new Set(visible.filter(p=>p.role==='fill'&&isMetalFill(p.color,strokeColors)));
 const regions=[];
 for(const [i,p]of visible.entries())if(p.role==='fill'&&!expandedRims.has(p)){
  const c=p.color.clone().convertLinearToSRGB();
  // Fill colour is pigment, not a material tag. Only actual strokes form metal.
  const role='enamel';
 regions.push({id:'svg-'+i,role,color:{r:c.r,g:c.g,b:c.b},loops:norm(p.loops)});
 }
 const redundant=redundantRims(paints),renderPaints=paints.filter(p=>!redundant.has(p));
 const renderRims=renderPaints.filter(p=>p.role==='rim').flatMap(p=>polygonBoolean(p.loops,renderPaints.slice(renderPaints.indexOf(p)+1).filter(q=>q.role==='fill').flatMap(q=>q.loops),C.ClipType.ctDifference));
 const rims=visible.filter(p=>p.role==='rim');if(rims.length)regions.push({id:'svg-rim',role:'rim',renderLoops:norm(polygonBoolean(renderRims)),redundantOutlines:redundant.size,color:{r:.5,g:.5,b:.5},loops:norm(polygonBoolean(rims.flatMap(p=>p.loops)))});
 if(expandedRims.size){const loops=polygonBoolean([...expandedRims].flatMap(p=>p.loops)),source=[...expandedRims][0].color.clone().convertLinearToSRGB();regions.push({id:'svg-expanded-rim',role:'rim',renderLoops:norm(loops),color:{r:.5,g:.5,b:.5},validationColor:{r:source.r,g:source.g,b:source.b},loops:norm(loops)});}
 return{key:'custom',name,viewBox:[0,0,304,304],strokeWidth:strokeWidths.length?strokeWidths.sort((a,b)=>a-b)[Math.floor(strokeWidths.length/2)]*scale:undefined,sourceBounds:{minX:minX/S,minY:minY/S,maxX:maxX/S,maxY:maxY/S},regions};
}
