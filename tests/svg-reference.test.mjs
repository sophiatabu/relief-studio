import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {paintServerId,maskPaintSupported,maskPaintKind,ribbonCoverage,isMetalFill,coversViewBoxRect} from '../src/svg.js';

test('reads SVG clip and mask paint-server references',()=>{
 assert.equal(paintServerId('url(#clip0_1811_49)'),'clip0_1811_49');
 assert.equal(paintServerId(' url( "#mask-a" ) '),'mask-a');
});

test('ignores CSS mask values that are not SVG paint servers',()=>{
 assert.equal(paintServerId('none'),null);
 assert.equal(paintServerId('linear-gradient(black, transparent)'),null);
 assert.equal(paintServerId(''),null);
});

test('accepts opaque Figma alpha masks regardless of their paint colour',()=>{
 assert.equal(maskPaintSupported('alpha','#F8F8F8',1),true);
 assert.equal(maskPaintSupported('alpha','#000000',1),true);
 assert.equal(maskPaintSupported('alpha','#F8F8F8',.5),false);
});

test('supports opaque black cutouts in Figma luminance masks',()=>{
 assert.equal(maskPaintSupported('luminance','#fff',1),true);
 assert.equal(maskPaintSupported('luminance','#000',1),true);
 assert.equal(maskPaintSupported('luminance','#F8F8F8',1),false);
 assert.equal(maskPaintSupported('luminance','white',.8),false);
 assert.equal(maskPaintKind('luminance','white',1),'keep');
 assert.equal(maskPaintKind('luminance','black',1),'cut');
 assert.equal(maskPaintKind('alpha','black',1),'keep');
});

test('distinguishes a long expanded outline from a broad filled surface',()=>{
 const ribbon=[[{X:0,Y:0},{X:1000,Y:0},{X:1000,Y:100},{X:100,Y:100},{X:100,Y:1000},{X:0,Y:1000}]];
 const surface=[[{X:0,Y:0},{X:1000,Y:0},{X:1000,Y:800},{X:0,Y:800}]];
 assert.ok(ribbonCoverage(ribbon)<.28);
 assert.ok(ribbonCoverage(surface)>.28);
});

test('treats the SVG stroke colour and neutral black fills as metal',()=>{
 const strokes=new Set(['5f5f5f']);
 assert.equal(isMetalFill(new THREE.Color('#5f5f5f'),strokes),true);
 assert.equal(isMetalFill(new THREE.Color('#000000')),true);
 assert.equal(isMetalFill(new THREE.Color('#ffb617'),strokes),false);
});

test('recognizes only an exact canvas-sized rectangle as an export background',()=>{
 assert.equal(coversViewBoxRect([0,0,311,292],[0,0,311,292]),true);
 assert.equal(coversViewBoxRect([16,16,279,260],[0,0,311,292]),false);
 assert.equal(coversViewBoxRect([0,0,311,291],[0,0,311,292]),false);
});

test('background detection is applied to the DOM copy used by SVGLoader',async()=>{
 const source=await readFile(new URL('fixtures/canvas-background.svg',import.meta.url),'utf8');
 assert.match(source,/<rect[^>]+fill="white"/);
 const main=await readFile(new URL('../src/svg.js',import.meta.url),'utf8');
 assert.match(main,/parsedRoot=parsed\.paths\[0\].*ownerDocument.*documentElement/);
 assert.match(main,/canvasBackdrop=parsedRoot&&svgCanvasBackdrop\(parsedRoot,vb\)/);
});
