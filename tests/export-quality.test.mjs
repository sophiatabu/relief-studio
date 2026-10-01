import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_EXPORT_SAMPLES,EXPORT_QUALITIES,MAX_EXPORT_SAMPLES,exportQualityOptions} from '../src/export-quality.js';
import {PNG_EXPORT_SIZE,PNG_EXPORT_PADDING} from '../src/export-presets.js';

test('maximum export quality is the real default sample target',async()=>{
 assert.equal(MAX_EXPORT_SAMPLES,1024);
 assert.equal(DEFAULT_EXPORT_SAMPLES,MAX_EXPORT_SAMPLES);
 assert.equal(Math.max(...EXPORT_QUALITIES.map(option=>option.samples)),MAX_EXPORT_SAMPLES);
 assert.match(exportQualityOptions(),/<option value="1024" selected>Максимальное · рекомендуется<\/option>/);
 const source=await readFile(new URL('../src/export-dialog.js',import.meta.url),'utf8');
 assert.match(source,/const token=\+\+serial,size=PNG_EXPORT_SIZE,padding=PNG_EXPORT_PADDING,inner=size-padding\*2,samples=MAX_EXPORT_SAMPLES/);
 assert.match(source,/if\(tracer\.samples<samples\)\{tracer\.renderSample\(\)/);
 assert.match(source,/\$\{Math\.min\(samples,Math\.floor\(tracer\.samples\)\)\} \/ \$\{samples\}/);
});

test('PNG export always downloads a square 1024 px transparent file without an options dialog',async()=>{
 assert.equal(PNG_EXPORT_SIZE,1024);assert.equal(PNG_EXPORT_PADDING,54);
 assert.equal(PNG_EXPORT_SIZE-PNG_EXPORT_PADDING*2,916);
 const source=await readFile(new URL('../src/export-dialog.js',import.meta.url),'utf8');
 assert.match(source,/context\.drawImage\(renderer\.domElement,padding,padding,inner,inner\)/);
 assert.match(source,/output\.width=output\.height=size/);
 assert.match(source,/download\(blob,source\.name\+'-1024x1024\.png'\)/);
 assert.doesNotMatch(source,/showModal|export-advanced|pngPreset/);
});
