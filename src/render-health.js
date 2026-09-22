// A fully black opaque silhouette is a failed render, not a finished badge.
// Transparent padding is ignored and even very dark visible colour is accepted.
export function isBlackSilhouette(pixels) {
 let opaque=0;
 for(let i=0;i<pixels.length;i+=4){
  if(pixels[i+3]<200)continue;
  opaque++;
  if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>2)return false;
 }
 return opaque>=8;
}

export function createRenderHealthCheck(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
 const context=canvas.getContext('2d',{willReadFrequently:true});
 return source=>{
  context.clearRect(0,0,32,32);context.drawImage(source,0,0,32,32);
  return !isBlackSilhouette(context.getImageData(0,0,32,32).data);
 };
}
