import C from 'clipper-lib';

const roles=new Set(['rim','enamel','hidden','cutout']);
export function normalizeAssignments(paints,input={}) {
 const result={};
 for(const p of paints){const edit=input[p.id];if(!edit)continue;
  const role=roles.has(edit.role)?edit.role:p.role;
  const color=/^#[0-9a-f]{6}$/i.test(edit.color)?edit.color.toLowerCase():p.color;
  if(role!==p.role||color!==p.color)result[p.id]={role,color};
 }
 return result;
}
function subtract(subject,cutters){
 if(!cutters.length)return subject;
 const c=new C.Clipper(),out=[];c.AddPaths(subject,C.PolyType.ptSubject,true);c.AddPaths(cutters,C.PolyType.ptClip,true);
 c.Execute(C.ClipType.ctDifference,out,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);return out;
}
export function compileDetailAssignments(asset,input={}){
 const paints=asset.editablePaints;
 if(!paints?.length)throw Error('У этого макета нет исходных элементов SVG.');
 const assignments=normalizeAssignments(paints,input);
 const visible=paints.map(p=>({...p,...assignments[p.id]})).filter(p=>p.role!=='hidden');
 const regions=visible.map((p,i)=>{
  const loops=subtract(p.loops,visible.slice(i+1).filter(q=>q.paint==='fill'||q.role==='cutout').flatMap(q=>q.loops));
  const hex=parseInt(p.color.slice(1),16);
  return {id:p.id,role:p.role,loops,color:{r:(hex>>16)/255,g:(hex>>8&255)/255,b:(hex&255)/255},...(assignments[p.id]?.color?{overrideColor:p.color}:{})};
 }).filter(r=>r.loops.length&&r.role!=='cutout');
 if(!regions.length)throw Error('Оставьте хотя бы одну видимую деталь.');
 return {...asset,regions,detailAssignments:assignments};
}
export function detailPath(loops){return loops.map(loop=>loop.map((p,i)=>`${i?'L':'M'}${p.X/1000},${p.Y/1000}`).join(' ')+'Z').join(' ');}
