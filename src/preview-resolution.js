export const PREVIEW_RESOLUTION_LIMITS=Object.freeze({128:768,512:896,1024:1024});

export function previewBufferSize(cssSize,samples,deviceScale=1){
 const visible=Math.max(1,Number(cssSize)||448);
 const scale=Math.max(1,Math.min(1.5,Number(deviceScale)||1));
 const quality=Number(samples)>=1024?1024:Number(samples)>=512?512:128;
 const limit=PREVIEW_RESOLUTION_LIMITS[quality];
 return Math.max(448,Math.min(limit,Math.ceil(visible*scale/16)*16));
}

export function previewBufferDimensions(cssWidth,cssHeight,samples,deviceScale=1){
 const width=Math.max(1,Number(cssWidth)||448),height=Math.max(1,Number(cssHeight)||448);
 const scale=Math.max(1,Math.min(1.5,Number(deviceScale)||1));
 const quality=Number(samples)>=1024?1024:Number(samples)>=512?512:128,limit=PREVIEW_RESOLUTION_LIMITS[quality];
 const fit=Math.min(1,limit/Math.max(width*scale,height*scale));
 const rounded=value=>Math.max(16,Math.min(limit,Math.ceil(value*scale*fit/16)*16));
 return {width:rounded(width),height:rounded(height)};
}
