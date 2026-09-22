import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_EXPORT_SAMPLES,EXPORT_QUALITIES,MAX_EXPORT_SAMPLES,exportQualityOptions} from '../src/export-quality.js';
import {PNG_EXPORT_PRESETS,exportInset} from '../src/export-presets.js';

test('maximum export quality is the real default sample target',async()=>{
 assert.equal(MAX_EXPORT_SAMPLES,1024);
 assert.equal(DEFAULT_EXPORT_SAMPLES,MAX_EXPORT_SAMPLES);
 assert.equal(Math.max(...EXPORT_QUALITIES.map(option=>option.samples)),MAX_EXPORT_SAMPLES);
 assert.match(exportQualityOptions(),/<option value="1024" selected>Максимальное · рекомендуется<\/option>/);
 const source=await readFile(new URL('../src/export-dialog.js',import.meta.url),'utf8');
 assert.match(source,/samples=Number\(dialog\.querySelector\('#pngQuality'\)\.value\)/);
 assert.match(source,/if\(tracer\.samples<samples\)\{tracer\.renderSample\(\)/);
 assert.match(source,/\$\{Math\.min\(samples,Math\.floor\(tracer\.samples\)\)\} \/ \$\{samples\} сэмплов/);
});

test('PNG presets keep the requested canvas and proportional safe area',async()=>{
 assert.deepEqual(PNG_EXPORT_PRESETS.map(({size})=>size),[304,68]);
 assert.equal(PNG_EXPORT_PRESETS[0].padding,16);
 assert.ok(Math.abs(PNG_EXPORT_PRESETS[1].padding-68*16/304)<1e-10);
 assert.deepEqual(exportInset(304,16),{size:304,padding:16,inner:272});
 const compact=exportInset(68,PNG_EXPORT_PRESETS[1].padding);
 assert.equal(compact.size,68);
 assert.ok(Math.abs(compact.inner/compact.size-272/304)<1e-10);
 const source=await readFile(new URL('../src/export-dialog.js',import.meta.url),'utf8');
 assert.match(source,/context\.drawImage\(renderer\.domElement,padding,padding,inner,inner\)/);
 assert.match(source,/selectPreset\('standard'\)/);
 assert.match(source,/export-advanced/);
});
