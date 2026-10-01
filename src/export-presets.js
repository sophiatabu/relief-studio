export const PNG_EXPORT_SIZE=1024;
// Keep the 16 px margin from the former 304 px default at the same proportion.
export const PNG_EXPORT_PADDING=Math.round(PNG_EXPORT_SIZE*16/304);

export function squareExportCamera(source){
 const camera=source.clone();
 if(camera.isOrthographicCamera){const half=Math.min(camera.right-camera.left,camera.top-camera.bottom)/2;camera.left=-half;camera.right=half;camera.top=half;camera.bottom=-half;}
 else if(camera.isPerspectiveCamera)camera.aspect=1;
 camera.updateProjectionMatrix();return camera;
}
