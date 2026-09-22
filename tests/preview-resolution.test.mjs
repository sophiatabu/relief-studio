import test from 'node:test';
import assert from 'node:assert/strict';
import {PREVIEW_RESOLUTION_LIMITS,previewBufferSize,previewBufferDimensions} from '../src/preview-resolution.js';

test('preview buffer follows its visible size instead of stretching a 448 px image',()=>{
 assert.equal(previewBufferSize(700,128,2),PREVIEW_RESOLUTION_LIMITS[128]);
 assert.equal(previewBufferSize(700,512,2),PREVIEW_RESOLUTION_LIMITS[512]);
 assert.equal(previewBufferSize(700,1024,2),PREVIEW_RESOLUTION_LIMITS[1024]);
 assert.equal(previewBufferSize(400,128,1),448);
 assert.equal(previewBufferSize(450,128,1.5),688);
});

test('preview resolution is bounded on high density and invalid displays',()=>{
 assert.equal(previewBufferSize(4000,1024,4),1024);
 assert.equal(previewBufferSize(0,128,0),448);
});

test('rectangular preview buffers preserve the visible aspect ratio',()=>{
 assert.deepEqual(previewBufferDimensions(1000,520,128,2),{width:768,height:400});
 assert.deepEqual(previewBufferDimensions(520,1000,512,2),{width:480,height:896});
 assert.deepEqual(previewBufferDimensions(448,448,128,1),{width:448,height:448});
});
