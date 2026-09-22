import test from 'node:test';
import assert from 'node:assert/strict';
import {svgMismatchLimit} from '../src/validate-svg.js';

test('allows subpixel SVG rasterization drift but keeps a narrow bound',()=>{
 assert.equal(svgMismatchLimit(1024),2097);
 assert.ok(922<svgMismatchLimit(1024));
 assert.ok(2500>svgMismatchLimit(1024));
});
