import C from 'clipper-lib';
export const RIM_WIDTH_GAIN=.25;
const treeFor=loops=>{const c=new C.Clipper(),tree=new C.PolyTree();c.AddPaths(loops,C.PolyType.ptSubject,true);c.Execute(C.ClipType.ctUnion,tree,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);return tree;};
const holesOf=loops=>{const holes=[];function walk(n){for(const c of n.Childs()){if(c.IsHole())holes.push(c.Contour());walk(c);}}walk(treeFor(loops));return holes;};
const bounds=p=>p.reduce((b,q)=>({minX:Math.min(b.minX,q.X),minY:Math.min(b.minY,q.Y),maxX:Math.max(b.maxX,q.X),maxY:Math.max(b.maxY,q.Y)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
const overlap=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minY<b.maxY&&a.maxY>b.minY;
// Offset the whole rim by one constant distance. Neighbouring strokes may meet:
// their union is a continuous border, not a reason to thin every other stroke.
// Protect each original opening, rather than comparing global component counts.
export function widenRim(loops,width=5.2,gain=RIM_WIDTH_GAIN){
 if(gain<=0)return loops;
 const holes=holesOf(loops).map(path=>({path,bounds:bounds(path)}));
 const preservesOpenings=result=>{
  if(!holes.length)return true;
  const remaining=holesOf(result).map(path=>({path,bounds:bounds(path)}));
  return holes.every(h=>remaining.some(r=>{
   if(!overlap(h.bounds,r.bounds))return false;
   const c=new C.Clipper(),out=[];c.AddPath(h.path,C.PolyType.ptSubject,true);c.AddPath(r.path,C.PolyType.ptClip,true);
   c.Execute(C.ClipType.ctIntersection,out,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
   return out.some(p=>Math.abs(C.Clipper.Area(p))>1);
  }));
 };
 const offset=d=>{const c=new C.ClipperOffset(2,5),out=[];c.AddPaths(loops,C.JoinType.jtRound,C.EndType.etClosedPolygon);c.Execute(out,d*1000);return out;};
 let low=0,high=width*gain/2;const result=offset(high);
 if(preservesOpenings(result))return result;
 for(let i=0;i<14;i++){const d=(low+high)/2;if(preservesOpenings(offset(d)))low=d;else high=d;}
 return low>0?offset(low*.98):loops;
}
