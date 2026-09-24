import {renderAppearanceEffects} from './svg-appearance.js';
import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
const vertex=`varying vec3 location;varying vec3 profile;varying vec3 surfaceNormal;attribute vec3 rimProfile;attribute float surfaceRole;varying float materialRole;
void main(){vec4 world=modelMatrix*vec4(position,1.);materialRole=surfaceRole;location=world.xyz*100.;profile=rimProfile;surfaceNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}`;
const uniforms={role:{value:0},pass:{value:0}};
const maskMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:`varying vec3 location;varying vec3 profile;varying vec3 surfaceNormal;uniform float role;uniform int pass;varying float materialRole;
void main(){if(pass==2&&materialRole<1.5)discard;if(pass==0)gl_FragColor=vec4(location,materialRole);else if(pass==1)gl_FragColor=vec4(profile,surfaceNormal.z);else gl_FragColor=vec4(location.z,1.,0.,1.);}`,side:THREE.DoubleSide,blending:THREE.NoBlending,toneMapped:false});
maskMaterial.defaultAttributeValues.rimProfile=[1,0,0];maskMaterial.defaultAttributeValues.surfaceRole=[0];
function target(size=1,type=THREE.FloatType){return new THREE.WebGLRenderTarget(size,size,{type,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});}
export function createContourEffects(renderer){
 const positions=target(),profiles=target(),rims=target(1024),base=target(1,THREE.FloatType),composited=target(1,THREE.UnsignedByteType);composited.texture.minFilter=composited.texture.magFilter=THREE.LinearFilter;
 
 const topCamera=new THREE.OrthographicCamera(-1.52,1.52,1.52,-1.52,.01,50);topCamera.position.set(0,0,7);topCamera.lookAt(0,0,0);topCamera.updateMatrixWorld();
 const material=new THREE.ShaderMaterial({uniforms:{base:{value:base.texture},positions:{value:positions.texture},profiles:{value:profiles.texture},rims:{value:rims.texture},exposure:{value:1},maskSize:{value:new THREE.Vector2(1,1)},highlightDirection:{value:new THREE.Vector2()},shadowDirection:{value:new THREE.Vector2()},highlight:{value:new THREE.Vector4()},shadow:{value:new THREE.Vector3()},facet:{value:new THREE.Vector3()}},vertexShader:`varying vec2 texcoord;void main(){texcoord=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`
 varying vec2 texcoord;uniform sampler2D base,positions,profiles,rims;uniform vec2 highlightDirection,shadowDirection;uniform vec4 highlight;uniform vec3 shadow;uniform vec3 facet;uniform float exposure;uniform vec2 maskSize;
 float occlusion(vec2 p,float z){vec2 uv=p/304.+.5;if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 0.;vec4 rim=texture2D(rims,uv);return rim.g*step(z+.25,rim.r);}
 float edge(vec2 uv){vec4 p=texture2D(positions,uv),f=texture2D(profiles,uv);if(p.a<2.5||p.a>3.5||f.a<=0.||length(f.yz)<.05)return 0.;float u=f.x;float center=facet.x>0.?facet.y*.58:.38;float width=facet.x>0.?min(highlight.y*.8,.015+facet.y*.34):highlight.y;float outerFade=facet.x>0.?max(.004,facet.y*.25):.1;float innerEnd=facet.x>0.?facet.y*.92:.82;float innerFade=facet.x>0.?max(.006,facet.y*.12):.18;float stripe=exp(-.5*pow((u-center)/width,2.))*smoothstep(0.,outerFade,u)*(1.-smoothstep(innerEnd-innerFade,innerEnd,u));return stripe*smoothstep(-highlight.z,.65,dot(f.yz,highlightDirection))*highlight.x;}
 vec3 displayColour(vec3 c){c=clamp(c*exposure,0.,1.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
 void main(){vec4 p=texture2D(positions,texcoord),f=texture2D(profiles,texcoord);float shade=0.;
 if(p.a>.5&&p.a<1.5&&f.a>.25&&shadow.z>0.){float contact=0.,soft=0.;for(int i=0;i<48;i++){float t=float(i)+.5;float a=t*2.39996323;vec2 disk=sqrt(t/48.)*vec2(cos(a),sin(a));contact+=occlusion(p.xy+disk*.65,p.z);soft+=occlusion(p.xy-shadowDirection*shadow.x+disk*shadow.y*2.,p.z);}shade=clamp(shadow.z*(.65*contact/48.+.8*soft/48.),0.,.85);}
 float facetDark=0.,facetLight=0.;
 if(facet.x>0.&&p.a>2.5&&p.a<3.5&&f.a>0.){
  // A constant-width flank whose softened join scales down with narrow facets.
  float join=max(.006,min(.05,facet.y*.14));
  float band=1.-smoothstep(facet.y-join,facet.y+join*.7,f.x);
  vec2 outward=f.yz/max(length(f.yz),.0001);
  float facing=dot(outward,highlightDirection);
  facetDark=band*facet.z*(.08+.48*max(-facing,0.));
  facetLight=band*facet.z*.48*max(facing,0.);
 }
 gl_FragColor=vec4(shade,highlight.x>0.?clamp(edge(texcoord),0.,1.):0.,facetDark,facetLight);
 }`,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false});
 const quad=new FullScreenQuad(material),copyMaterial=new THREE.ShaderMaterial({uniforms:{image:{value:composited.texture},base:{value:base.texture},exposure:{value:1}},vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`varying vec2 v;uniform sampler2D image,base;uniform float exposure;
vec3 displayColour(vec3 c){c=clamp(c*exposure,0.,1.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){vec4 c=texture2D(base,v);if(c.a<.00001){gl_FragColor=c;return;}vec4 effect=texture2D(image,v);vec3 rgb=displayColour(c.rgb/c.a);rgb*=1.-effect.r;rgb*=1.-effect.b;rgb=mix(rgb,vec3(1.),max(effect.g,effect.a));gl_FragColor=vec4(rgb*c.a,c.a);}`,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false}),copy=new FullScreenQuad(copyMaterial);let lastModel=null,lastView='',hasBase=false,dirty=true;
 const stats={atlasBuilds:0,viewBuilds:0,effectBuilds:0,composites:0,lastCompositeMs:0};
 function renderMask(scene,model,camera,output,pass){
  const old={target:renderer.getRenderTarget(),auto:renderer.autoClear,color:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),background:scene.background,override:scene.overrideMaterial};const saved=[];
  try{scene.background=null;scene.overrideMaterial=null;scene.traverse(mesh=>{if(!mesh.isMesh)return;const belongs=model===mesh||isChild(mesh,model);saved.push([mesh,mesh.material,mesh.visible,mesh.onBeforeRender]);const role=mesh.userData.role,isRim=role==='rim'||mesh.userData.parts?.some(p=>p.role==='rim');mesh.visible=mesh.visible&&belongs&&role!=='svg-effect'&&(pass!==2||isRim);mesh.material=maskMaterial;mesh.onBeforeRender=()=>{maskMaterial.uniforms.pass.value=pass;maskMaterial.uniforms.role.value=mesh.userData.surface==='rim-cap'?3:isRim?2:['enamel','light','metal-plate','dark-metal'].includes(role)?1:0;maskMaterial.uniformsNeedUpdate=true;};});renderer.setRenderTarget(output);renderer.setClearColor(0,0);renderer.autoClear=true;renderer.render(scene,camera);}
  finally{for(const [mesh,mat,visible,callback]of saved){mesh.material=mat;mesh.visible=visible;mesh.onBeforeRender=callback;}scene.background=old.background;scene.overrideMaterial=old.override;renderer.setRenderTarget(old.target);renderer.autoClear=old.auto;renderer.setClearColor(old.color,old.alpha);}
 }
 let effectCamera=null;
 function masks(scene,model,camera,width,height){
  effectCamera=camera;
  camera.updateMatrixWorld();const view=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements,width,height].join(',');
  if(model!==lastModel){renderMask(scene,model,topCamera,rims,2);stats.atlasBuilds++;lastView='';lastModel=model;}
  if(view!==lastView){const scale=Math.min(2,2048/Math.max(width,height));positions.setSize(Math.ceil(width*scale),Math.ceil(height*scale));profiles.setSize(Math.ceil(width*scale),Math.ceil(height*scale));material.uniforms.maskSize.value.set(width,height);renderMask(scene,model,camera,positions,0);renderMask(scene,model,camera,profiles,1);lastView=view;stats.viewBuilds++;dirty=true;}
 }
 function draw(settings){const started=performance.now();const u=material.uniforms;u.exposure.value=renderer.toneMappingExposure;const angle=settings.highlightAngle*Math.PI/180,shade=settings.shadowAngle*Math.PI/180;u.facet.value.set(settings.facet?1:0,settings.facetWidth??.75,settings.facetStrength??.65);u.highlightDirection.value.set(Math.sin(angle),Math.cos(angle));u.shadowDirection.value.set(Math.sin(shade),Math.cos(shade));u.highlight.value.set(settings.highlight?settings.highlightStrength:0,.025+settings.highlightWidth*.30,settings.highlightSoftness,0);u.shadow.value.set(settings.shadowOffset,settings.shadowSoftness,settings.shadow?settings.shadowStrength:0);if(dirty){const destination=renderer.getRenderTarget();composited.setSize(positions.width,positions.height);try{renderer.setRenderTarget(composited);quad.render(renderer);}finally{renderer.setRenderTarget(destination);}stats.effectBuilds++;}copyMaterial.uniforms.exposure.value=renderer.toneMappingExposure;copy.render(renderer);renderAppearanceEffects(renderer,lastModel,effectCamera);stats.composites++;stats.lastCompositeMs=performance.now()-started;dirty=false;}
 return {stats,invalidate(){dirty=true;},invalidateGeometry(){lastModel=null;lastView='';dirty=true;},
 attach(tracer,getState,interval=1){const underlying=tracer.renderToCanvasCallback;tracer.renderToCanvasCallback=(input,r,q)=>{const sample=Math.floor(tracer.samples);if(interval>1&&sample>=16&&(!Number.isInteger(tracer.samples)||sample%interval!==0)&&q.material.opacity===1)return;const {model,settings}=getState();if(!settings.enabled||!model){hasBase=false;underlying(input,r,q);renderAppearanceEffects(renderer,model,tracer.camera);return;}const old=renderer.getRenderTarget(),size=renderer.getDrawingBufferSize(new THREE.Vector2());base.setSize(size.x,size.y);masks(tracer.scene,model,tracer.camera,size.x,size.y);const clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();try{renderer.setRenderTarget(base);renderer.setClearColor(0,0);renderer.clear();underlying(input,r,q);}finally{renderer.setRenderTarget(old);renderer.setClearColor(clear,alpha);}hasBase=true;draw(settings);};},
 redraw(settings){if(hasBase&&dirty&&settings.enabled){draw(settings);return true;}return false;},
 dispose(){for(const rt of [positions,profiles,rims,base,composited])rt.dispose();material.dispose();quad.dispose();copyMaterial.dispose();copy.dispose();}
 };
}
function isChild(node,parent){for(let p=node.parent;p;p=p.parent)if(p===parent)return true;return false;}
