let current='',url=null;
export function showSourcePreview(asset){
 const panel=document.getElementById('sourcePreview'),image=document.getElementById('sourceImage');
 if(!asset){panel.hidden=true;return;}
 const key=asset.sourceSVG||JSON.stringify(asset.regions);if(key===current)return;current=key;
 let text=asset.sourceSVG;
 if(text){const doc=new DOMParser().parseFromString(text,'image/svg+xml'),root=doc.documentElement,b=asset.sourceBounds;
  if(!root.hasAttribute('viewBox')&&b){const pad=Math.max(b.maxX-b.minX,b.maxY-b.minY)*.025;root.setAttribute('viewBox',[b.minX-pad,b.minY-pad,b.maxX-b.minX+pad*2,b.maxY-b.minY+pad*2].join(' '));}
  root.setAttribute('width','240');root.setAttribute('height','160');root.setAttribute('preserveAspectRatio','xMidYMid meet');text=new XMLSerializer().serializeToString(root);
 }else{text='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 304 304">'+asset.regions.map(r=>'<path fill="rgb('+[r.color.r,r.color.g,r.color.b].map(c=>Math.round(c*255)).join(',')+')" fill-rule="nonzero" d="'+r.loops.map(l=>'M'+l.map(p=>p.X/1000+','+p.Y/1000).join('L')+'Z').join(' ')+'"/>').join('')+'</svg>';}
 if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));image.src=url;image.alt='Исходный вектор: '+asset.name;document.getElementById('sourceName').textContent=asset.name;panel.hidden=false;
}
