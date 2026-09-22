import {SRGBToLinear} from 'three/src/math/ColorManagement.js';
const clamp=v=>Math.max(0,Math.min(1,v));
// Coordinates are normalized texture coordinates, with y increasing upwards.
// Match the previous sRGB gradient and Screen/Multiply blend, without byte rounding.
export function gradientField(sources){
 const dark=sources.filter(s=>s.kind==='dark'&&s.enabled).map(s=>{
  const a=s.azimuth*Math.PI/180,span=Math.max(.15,s.softness)*1.15;
  return {x:Math.sin(a),y:Math.cos(a),start:(s.distance??Math.hypot(3.5,3.2))*Math.cos(s.elevation*Math.PI/180)-span,span,shade:Math.max(.04,1-.85*s.power),rich:s.blendMode!=='neutral'&&s.power>0?s.richness??.2:0};
 });
 const lights=sources.filter(s=>s.kind!=='dark'&&s.enabled&&s.power>0&&s.blendMode!=='none'&&(s.richness??.15)>0).map(s=>({x:Math.sin(s.azimuth*Math.PI/180),y:Math.cos(s.azimuth*Math.PI/180),amount:(s.richness??.15)*Math.min(1,s.power)}));
 return (u,v,out=[])=>{
  const x=(u-.5)*3.04,y=(v-.5)*3.04;let shade=1,rich=0,light=0;
  for(const d of dark){const t=clamp((x*d.x+y*d.y-d.start)/d.span);shade*=1+t*(d.shade-1);rich=1-(1-rich)*(1-t*d.rich);}
  for(const l of lights){const t=clamp((u-.5)*l.x+(v-.5)*l.y+.5);light=1-(1-light)*(1-t*l.amount);}
  out[0]=SRGBToLinear(shade);out[1]=rich;out[2]=light;return out;
 };
}
