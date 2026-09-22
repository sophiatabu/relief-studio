// Multipliers in linear light. Lift dominant colour channels a little more than
// weak ones: shadows keep their hue without adding coloured light or emission.
export function shadowMultipliers(base,attenuation,richness){
 const a=Math.max(0,Math.min(1,attenuation)),t=Math.max(0,Math.min(1,richness));
 const peak=Math.max(...base,1e-6);
 return base.map(c=>{
  const chroma=Math.max(0,Math.min(1,c/peak));
  return Math.max(0,Math.min(1,a+t*.22*(1-a)*chroma-t*.08*a*(1-a)*(1-chroma)));
 });
}
