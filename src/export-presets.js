export const PNG_EXPORT_PRESETS=[
 {id:'standard',size:304,padding:16,label:'304 × 304',note:'поля 16 px'},
 {id:'compact',size:68,padding:68*16/304,label:'68 × 68',note:'пропорциональные поля'},
];

export function exportInset(size,padding){
 const safeSize=Math.max(1,Math.round(Number(size)||304));
 const safePadding=Math.max(0,Math.min(safeSize/2-0.5,Number(padding)||0));
 return {size:safeSize,padding:safePadding,inner:safeSize-safePadding*2};
}

export function squareExportCamera(source){
 const camera=source.clone();
 if(camera.isOrthographicCamera){const half=Math.min(camera.right-camera.left,camera.top-camera.bottom)/2;camera.left=-half;camera.right=half;camera.top=half;camera.bottom=-half;}
 else if(camera.isPerspectiveCamera)camera.aspect=1;
 camera.updateProjectionMatrix();return camera;
}
