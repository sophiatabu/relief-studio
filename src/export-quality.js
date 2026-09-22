export const EXPORT_QUALITIES=Object.freeze([
 {samples:128,label:'Обычное'},
 {samples:512,label:'Высокое'},
 {samples:1024,label:'Максимальное'},
]);

export const MAX_EXPORT_SAMPLES=Math.max(...EXPORT_QUALITIES.map(option=>option.samples));
export const DEFAULT_EXPORT_SAMPLES=MAX_EXPORT_SAMPLES;

export function exportQualityOptions(){
 return EXPORT_QUALITIES.map(option=>`<option value="${option.samples}"${option.samples===DEFAULT_EXPORT_SAMPLES?' selected':''}>${option.label}${option.samples===MAX_EXPORT_SAMPLES?' · рекомендуется':''}</option>`).join('');
}
