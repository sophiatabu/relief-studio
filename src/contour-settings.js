import {STUDIO} from './studio.js';
export const CONTOUR_DEFAULTS=STUDIO.contour;
const ranges={facetWidth:[.03,.95],facetStrength:[0,1],highlightAngle:[0,360],highlightWidth:[.03,1.5],highlightStrength:[0,1],highlightSoftness:[.05,1],shadowAngle:[0,360],shadowOffset:[0,8],shadowSoftness:[.2,6],shadowStrength:[0,1]};
const ALTERED_DEFAULTS={...CONTOUR_DEFAULTS,facetWidth:.42,highlightWidth:.55};
export function migrateContourDefaults(value){return value&&Object.entries(ALTERED_DEFAULTS).every(([key,expected])=>value[key]===expected)?{...value,facetWidth:CONTOUR_DEFAULTS.facetWidth,highlightWidth:CONTOUR_DEFAULTS.highlightWidth}:value;}
export function normalizeContour(value,legacy=false){const out={...CONTOUR_DEFAULTS,enabled:!legacy,facet:!legacy&&(!value||value.facet===true)};for(const k of ['enabled','facet','highlight','shadow'])if(typeof value?.[k]==='boolean')out[k]=value[k];for(const [k,[min,max]]of Object.entries(ranges))if(Number.isFinite(value?.[k]))out[k]=Math.min(max,Math.max(min,value[k]));return out;}
export function contourSources(sources,contour){return contour.enabled?sources.map(s=>s.shape==='strip'?{...s,enabled:false}:s):sources;}
export function applyContourMaterials(model,contour){model?.traverse(m=>{if(!m.isMesh)return;for(const material of Array.isArray(m.material)?m.material:[m.material])material.castShadow=!contour.enabled;});}
