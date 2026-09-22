import * as THREE from 'three';
import {SRGBToLinear} from 'three/src/math/ColorManagement.js';
import {shadowMultipliers} from './darkness-blend.js';
import {gradientField} from './gradient-field.js';
import {gradientTexture,setGradientPixel} from './gradient-texture.js';
const N=512,clamp=v=>Math.max(0,Math.min(1,v));

// A real lamp supplies the strength shared by both material groups. The
// directional texture supplies the extra amount requested by either group.
// Darkness is texture-based already, so its material influence is exact.
function sourcesForMaterial(sources,key,darkGain=1){
 return sources.map(source=>{
  const influence=clamp(source[key]??1);
  if(source.kind==='dark')return {...source,power:source.power*influence*darkGain};
  const shared=Math.min(source.surfaceInfluence??1,source.contourInfluence??1),extra=Math.max(0,influence-shared);
  const baseRichness=key==='surfaceInfluence'?(source.richness??.15)*influence:0;
  return {...source,blendMode:source.blendMode==='none'&&extra>0?'screen':source.blendMode,richness:clamp(baseRichness+extra*1.5)};
 });
}

export function createDarkness(){
 const metal=gradientTexture(N),enamel=gradientTexture(N),colours=new Map();let previous='',surfaceFields,metalFields;
 return{
  update(model,sources,surface,options={}){
   if(!model)return false;
   const surfaceSources=sourcesForMaterial(sources,'surfaceInfluence');
   const metalSources=sourcesForMaterial(sources,'contourInfluence',options.metalShadeGain??1);
   const surfaceLights=surfaceSources.filter(s=>s.kind!=='dark'&&s.enabled&&s.power>0&&s.blendMode!=='none'&&(s.richness??.15)>0);
   const metalLights=metalSources.filter(s=>s.kind!=='dark'&&s.enabled&&s.power>0&&s.blendMode!=='none'&&(s.richness??.15)>0);
   const active=surfaceSources.filter(s=>s.kind==='dark'&&s.enabled);
   const key=JSON.stringify([surfaceSources,metalSources])+'|'+(surface?.uuid||'');let changed=key!==previous;previous=key;
   if(changed){
    const surfaceField=gradientField(surfaceSources),metalField=gradientField(metalSources);surfaceFields=new Float32Array(N*N*5);metalFields=new Float32Array(N*N*5);
    let surfacePixels;
    if(surface){const c=document.createElement('canvas');c.width=c.height=N;const ctx=c.getContext('2d');ctx.drawImage(surface.image,0,0,N,N);surfacePixels=ctx.getImageData(0,0,N,N).data;}
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
     const p=y*N+x,u=(x+.5)/N,v=(y+.5)/N,s=surfaceField(u,v),m=metalField(u,v),offset=((N-1-y)*N+x)*4;
     for(let c=0;c<3;c++){surfaceFields[p*5+c]=s[0]*(surfacePixels?SRGBToLinear(surfacePixels[offset+c]/255):1);metalFields[p*5+c]=m[0];}
     surfaceFields[p*5+3]=s[1];surfaceFields[p*5+4]=s[2];metalFields[p*5+3]=m[1];metalFields[p*5+4]=m[2];
     setGradientPixel(enamel,p*4,surfaceFields[p*5],surfaceFields[p*5+1],surfaceFields[p*5+2]);setGradientPixel(metal,p*4,m[0],m[0],m[0]);
    }
    metal.needsUpdate=enamel.needsUpdate=true;
   }
   const chromatic=active.some(s=>s.blendMode!=='neutral'&&(s.richness??.2)>0&&s.power>0),used=new Set();
   const colouredMap=(material,fields,screen,scope)=>{
    const base=(material.userData.screenBase||material.color).toArray(),peak=Math.max(...base,1e-6),id=scope+'|'+base.join(',')+'|'+screen;used.add(id);let entry=colours.get(id);
    if(!entry){entry={texture:gradientTexture(N),key:''};colours.set(id,entry);}
    if(entry.key!==key){
     for(let p=0;p<N*N;p++){
      const t=fields[p*5+3],out=[],multipliers=shadowMultipliers(base,fields[p*5],1);
      for(let c=0;c<3;c++){
       const a=fields[p*5+c],full=surface?shadowMultipliers(base,a,1)[c]:multipliers[c];let value=clamp(a+t*(full-a));
       if(screen){value*=base[c];value=1-(1-value)*(1-(base[c]/peak)*fields[p*5+4]*.25);}out.push(value);
      }
      setGradientPixel(entry.texture,p*4,...out);
     }
     entry.texture.needsUpdate=true;entry.key=key;changed=true;
    }
    return entry.texture;
   };
   model.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry,p=g.attributes.position;if(!g.userData.badgeUV){const uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[2*i]=(p.getX(i)+152)/304;uv[2*i+1]=(p.getY(i)+152)/304;}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.userData.badgeUV=true;}
    const role=mesh.userData.role,isEnamel=role==='enamel'||role==='light',fields=isEnamel?surfaceFields:metalFields,screen=(isEnamel?surfaceLights:metalLights).length>0;
    if(!screen&&mesh.material.userData.screenBase){mesh.material.color.copy(mesh.material.userData.screenBase);delete mesh.material.userData.screenBase;changed=true;}
    const map=(screen||(isEnamel&&chromatic))?colouredMap(mesh.material,fields,screen,isEnamel?'surface':'contour'):surface&&role!=='rim'&&role!=='pin'?enamel:metal;
    if(screen&&!mesh.material.userData.screenBase){mesh.material.userData.screenBase=mesh.material.color.clone();mesh.material.color.set(0xffffff);changed=true;}
    if(mesh.material.map!==map){mesh.material.map=map;mesh.material.needsUpdate=true;changed=true;}
   });
   for(const [id,entry]of colours)if(!used.has(id)){entry.texture.dispose();colours.delete(id);}
   return changed;
  },dispose(){metal.dispose();enamel.dispose();for(const entry of colours.values())entry.texture.dispose();colours.clear();}
 };
}
