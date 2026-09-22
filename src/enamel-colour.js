import * as THREE from 'three';
// Lift chromatic pigments toward the reference palette without changing hue,
// whitening saturated channels, recolouring neutrals or clipping channel values.
export function cleanEnamelColour(colour,vividness=1){
 const rgb=colour.getRGB({},THREE.SRGBColorSpace),peak=Math.max(rgb.r,rgb.g,rgb.b),low=Math.min(rgb.r,rgb.g,rgb.b);
 if(peak<1e-6||peak-low<1e-6)return colour.clone();
 const saturation=(peak-low)/peak,gate=THREE.MathUtils.smoothstep(peak,.12,.4);
 const gain=1+Math.min(.28,(1-peak)/peak)*gate;
 const headroom=1-THREE.MathUtils.smoothstep(saturation,.78,.88);
 const chroma=Math.min(1/saturation,1+.16*THREE.MathUtils.smoothstep(saturation,.15,.5)*headroom*gate);
 const saturationGain=THREE.MathUtils.clamp(Number(vividness)||1,.5,1.5);
 const channel=c=>Math.max(0,peak+(c-peak)*chroma*saturationGain)*gain;
 return new THREE.Color().setRGB(channel(rgb.r),channel(rgb.g),channel(rgb.b),THREE.SRGBColorSpace);
}
