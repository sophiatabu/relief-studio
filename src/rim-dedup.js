import C from 'clipper-lib';
const area=loops=>Math.abs(loops.reduce((sum,p)=>sum+C.Clipper.Area(p),0));
const intersection=(a,b)=>{const c=new C.Clipper(),out=[];c.AddPaths(a,C.PolyType.ptSubject,true);c.AddPaths(b,C.PolyType.ptClip,true);c.Execute(C.ClipType.ctIntersection,out,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);return area(out);};
// A filled contour owns its border. Remove a redundant stroke-only closed copy
// only when both its enclosed area and its stroke substantially overlap that border.
export function redundantRims(paints){
 const owners=paints.filter(p=>p.role==='rim'&&p.filled&&p.closed&&p.footprint?.length);
 return new Set(paints.filter(p=>p.role==='rim'&&!p.filled&&p.closed&&p.footprint?.length&&owners.some(o=>{
  if(Math.abs(p.width-o.width)>o.width*.02||p.color.getHex()!==o.color.getHex())return false;
  const a=area(p.footprint),b=area(o.footprint),common=intersection(p.footprint,o.footprint);
  if(!a||!b||common/(a+b-common)<.97)return false;
  const stroke=intersection(p.loops,o.loops);
  return stroke/Math.max(area(p.loops),area(o.loops),1)>.8;
 })));
}
