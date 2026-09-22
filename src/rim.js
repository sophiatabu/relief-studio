import * as THREE from 'three';
import Clipper from 'clipper-lib';
const SCALE=10000;
function boolean(subject,cutters=[],op=Clipper.ClipType.ctUnion){
 const c=new Clipper.Clipper();c.AddPaths(subject,Clipper.PolyType.ptSubject,true);
 if(cutters.length)c.AddPaths(cutters,Clipper.PolyType.ptClip,true);
 const tree=new Clipper.PolyTree();c.Execute(op,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);return tree;
}
function shapesFrom(tree){const out=[];function visit(n){for(const c of n.Childs()){if(!c.IsHole()){const points=p=>p.Contour().map(q=>new THREE.Vector2(q.X/SCALE,q.Y/SCALE));const s=new THREE.Shape(points(c));s.holes=c.Childs().filter(h=>h.IsHole()).map(h=>new THREE.Path(points(h)));out.push(s);}visit(c);}}visit(tree);return out;}
// Boolean inset bands handle changing topology (narrow necks, holes and junctions).
// Unlike per-vertex miter bevels, every band stays inside the source silhouette.
export function roundedRimGeometry(shapes,height,radius){
 const loops=[];
 for(const shape of shapes)for(const [i,path]of[shape,...shape.holes].entries()){
  const p=path.getPoints(1).map(v=>({X:Math.round(v.x*SCALE),Y:Math.round(v.y*SCALE)}));
  if(p.length>1&&p[0].X===p.at(-1).X&&p[0].Y===p.at(-1).Y)p.pop();
  if(Clipper.Clipper.Orientation(p)!==(i===0))p.reverse();loops.push(p);
 }
 const original=Clipper.Clipper.PolyTreeToPaths(boolean(loops));
 const r=Math.max(.0001,radius),cell=Math.max(1,r*2),bins=new Map();
 for(const pts of original)for(let i=0;i<pts.length;i++){
  const a=pts[i],b=pts[(i+1)%pts.length],x=a.X/SCALE,y=a.Y/SCALE,dx=(b.X-a.X)/SCALE,dy=(b.Y-a.Y)/SCALE,len=dx*dx+dy*dy;if(len<1e-15)continue;
  const segment={x,y,dx,dy,len};
  for(let iy=Math.floor((Math.min(y,y+dy)-r)/cell);iy<=Math.floor((Math.max(y,y+dy)+r)/cell);iy++)for(let ix=Math.floor((Math.min(x,x+dx)-r)/cell);ix<=Math.floor((Math.max(x,x+dx)+r)/cell);ix++){
   const k=ix+':'+iy;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(segment);
  }
 }
 const positions=[],normals=[],profile=[];
 function sample(x,y){let d2=r*r,gx=0,gy=0;for(const s of bins.get(Math.floor(x/cell)+':'+Math.floor(y/cell))||[]){const t=Math.max(0,Math.min(1,((x-s.x)*s.dx+(y-s.y)*s.dy)/s.len)),vx=x-s.x-t*s.dx,vy=y-s.y-t*s.dy,q=vx*vx+vy*vy;if(q<d2){d2=q;const d=Math.sqrt(q);gx=d>.0001?vx/d:-s.dy/Math.sqrt(s.len);gy=d>.0001?vy/d:s.dx/Math.sqrt(s.len);}}
  const u=Math.min(1,(d2<1e-8?0:Math.sqrt(d2))/r),z=Math.sqrt(Math.max(0,1-(1-u)**2)),slope=1.5*(1-u)/Math.max(1e-5,z),n=new THREE.Vector3(-slope*gx,-slope*gy,1).normalize();return[height+radius*1.5*z,n,u,gx,gy];
 }
 function append(tree){const shapes=shapesFrom(tree);if(!shapes.length)return;const g=new THREE.ShapeGeometry(shapes,1),p=g.attributes.position;
  for(const i of g.index.array){const x=p.getX(i),y=p.getY(i),[z,n,u,gx,gy]=sample(x,y);positions.push(x,y,z);normals.push(n.x,n.y,n.z);profile.push(u,-gx,-gy);}g.dispose();
 }
 let previous=original;
 for(let i=1;i<=12&&previous.length;i++){
  const inset=r*(1-Math.cos(i/12*Math.PI/2)),offset=new Clipper.ClipperOffset(2,.002*SCALE),paths=[];
  offset.AddPaths(original,Clipper.JoinType.jtRound,Clipper.EndType.etClosedPolygon);offset.Execute(paths,-inset*SCALE);
  const inner=paths.length?Clipper.Clipper.PolyTreeToPaths(boolean(previous,paths,Clipper.ClipType.ctIntersection)):[];
  append(boolean(previous,inner,Clipper.ClipType.ctDifference));previous=inner;
 }
 if(previous.length)append(boolean(previous));
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('rimProfile',new THREE.Float32BufferAttribute(profile,3));return g;
}
