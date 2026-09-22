import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the preview toggle controls every marker group independently of open panels',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const contour=await readFile(new URL('../src/contour-markers.js',import.meta.url),'utf8');
 assert.match(main,/showLights:true/);
 assert.match(main,/markers\.hidden=!settings\.showLights\|\|!model/);
 assert.doesNotMatch(main,/markers\.hidden=[^;]*(settingsVisible|activeSection)/);
 assert.match(main,/\$\('viewport'\)\.append\(pointsLabel\)/);
 assert.match(main,/\$\('viewport'\)\.append\(viewControls\)/);
 assert.match(main,/zoomControls\.append\(zoomOut,zoomValue,zoomIn\)/);
 assert.match(contour,/button\.hidden=false/);
});

test('reset icons follow actual changes instead of occupying permanent space',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const contour=await readFile(new URL('../src/contour-controls.js',import.meta.url),'utf8');
 const lights=await readFile(new URL('../src/light-cards.js',import.meta.url),'utf8');
 assert.match(main,/function refreshResetVisibility\(\)/);
 assert.match(main,/showReset\(button,settings\[key\]!==base\[key\]\)/);
 assert.match(contour,/showReset\(button,s\[key\]!==CONTOUR_DEFAULTS\[key\]\)/);
 assert.match(lights,/showReset\(button,dirty\(source/);
});

test('panel and preview controls are rehomed without a second toolbar row',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const panel=await readFile(new URL('../src/panel-workspace.js',import.meta.url),'utf8');
 assert.match(main,/prepend\(colourToggle\);showColours\(false\)/);
 assert.match(main,/function selectPart\([^)]*\)/);
 assert.match(main,/selectPart[\s\S]*showColours\(true\)/);
 assert.match(panel,/querySelector\('header \.head-actions'\)\.before\(group\)/);
 assert.match(panel,/\$\('showReferences'\),\$\('compareRender'\)/);
 assert.match(panel,/previewTools\.append\([^;]*view-toggle-overlay[^;]*zoom-controls[^;]*points-toggle[^;]*quality/);
 assert.match(panel,/querySelector\('\.stage-toolbar'\)\.remove\(\)/);
 assert.match(panel,/panel\.classList\.add\('resizable-panel'\)/);
 assert.match(panel,/observer\.observe\(panel\)/);
 assert.match(panel,/stage\.style\.setProperty\(track/);
 assert.match(panel,/stage\.style\.removeProperty\(track\)/);
 assert.match(panel,/panel\.classList\.contains\('comparison-mode'\)/);
 assert.match(panel,/new MutationObserver\(syncDockTrack\)/);
});

test('current render can be placed beside achievement examples without UI overlays',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(main,/compareRender\.textContent='Посмотреть'/);
 assert.match(main,/currentRenderContext\.drawImage\(source,sx,sy,side,side,padding,padding,size-padding\*2,size-padding\*2\)/);
 assert.match(main,/referenceBoard\.prepend\(currentRenderFigure\)/);
 assert.match(main,/classList\.add\('comparison-mode'\)/);
 assert.match(main,/showColours\(false\);showSettings\(true\)/);
 assert.match(main,/updateComparisonPreview\(\)/);
 assert.match(css,/\.reference-sidebar\.comparison-mode \.reference-board\{[^}]*display:grid[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/\.viewports>\.reference-sidebar\.comparison-mode\{[^}]*grid-column:2\/-1/);
 assert.match(css,/\.compact-workbench \.viewports>\.reference-sidebar\.comparison-mode\{[^}]*margin-left:var\(--left-panel,0px\)[^}]*width:calc\(100% - var\(--left-panel,0px\)\)!important/);
 assert.match(css,/\.compact-workbench \.viewports:has\(>\.reference-sidebar\.comparison-mode\)>\.settings-panel:not\(\[hidden\]\)\{z-index:10\}/);
 assert.doesNotMatch(main,/currentRenderContext\.drawImage\([^;]*selection-overlay/);
 assert.match(main,/comparisonDrag=\{id:e\.pointerId/);
 assert.match(main,/referenceBoard\.insertBefore\(currentRenderFigure/);
 assert.match(main,/function centerComparisonCamera\(\)/);
});

test('contour highlight stays inside the sloped facet instead of its plateau join',async()=>{
 const effects=await readFile(new URL('../src/contour-effects.js',import.meta.url),'utf8');
 assert.match(effects,/center=facet\.x>0\.\?facet\.y\*\.58/);
 assert.match(effects,/innerEnd=facet\.x>0\.\?facet\.y\*\.92/);
 assert.match(effects,/1\.-smoothstep\(innerEnd-innerFade,innerEnd,u\)/);
});

test('docked panels resize from the canvas edge and remember their width',async()=>{
 const panel=await readFile(new URL('../src/panel-workspace.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(panel,/panelWidthKey='relief-panel-widths-v1'/);
 assert.match(panel,/className='panel-resize-edge'/);
 assert.match(panel,/aria-hidden="true">⋮<\/span>/);
 assert.match(panel,/direction:rightSide\?-1:1/);
 assert.match(panel,/savePanelWidth\(id,width\)/);
 assert.match(panel,/setProperty\(track,panel\.getBoundingClientRect\(\)\.width\+18\+'px'\)/);
 assert.match(css,/\.panel-resize-edge\{[^}]*cursor:ew-resize/);
 assert.match(css,/\.panel-resize-edge>span\{[^}]*opacity:\.82/);
 assert.match(css,/\.reference-sidebar\{position:relative/);
 assert.match(css,/max-width:min\(720px,72cqw\)/);
});

test('the renderer fills the whole preview and shift drag pans it',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const selection=await readFile(new URL('../src/part-selection.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(main,/controls\.enablePan=true/);
 assert.match(main,/controls\.mouseButtons\.RIGHT=null/);
 assert.match(main,/function setPreviewZoom\([^)]*\)[^{]*\{[^}]*syncPreviewZoom\(\)[^}]*tracer\?\.updateCamera\(\)[^}]*resetTrace\(\)/);
 assert.match(main,/renderer\.setSize\(width,height,false\)/);
 assert.match(main,/camera\.left=-half\*Math\.max\(1,aspect\)/);
 assert.match(selection,/resize\(width,height=width\)/);
 assert.match(css,/\.render-pane #viewport\{[^}]*flex:1 1 auto[^}]*width:100%[^}]*aspect-ratio:auto/);
});

test('completed previews stop continuous GPU compositing',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(main,/finalCompositeSamples!==target/);
 assert.match(main,/function startAnimation\(\)\{if\(animationRunning\)return;/);
 assert.match(main,/if\(!model\|\|busy\|\|exporting\|\|detailEditing\|\|document\.hidden\|\|renderFailed\)return;/);
 assert.match(main,/finally\{if\(version===buildVersion\)\{busy=false;startAnimation\(\);\}\}/);
 assert.doesNotMatch(main,/if\(tracer\.samples<target\)tracer\.renderSample\(\);else contourEffects\.redraw/);
 assert.equal((html.match(/loading="lazy"/g)||[]).length,9);
});

test('redundant enable switches and source explanations are absent',async()=>{
 const contour=await readFile(new URL('../src/contour-controls.js',import.meta.url),'utf8');
 const lights=await readFile(new URL('../src/light-cards.js',import.meta.url),'utf8');
 const help=await readFile(new URL('../src/help-tooltips.js',import.meta.url),'utf8');
 assert.doesNotMatch(contour,/Блики и тени по контурам| Включены| Скошенные края/);
 assert.doesNotMatch(lights,/source-enabled|source-purpose|Перетащите точку источника/);
 assert.doesNotMatch(help,/setAttribute\('aria-label','Подсказка:/);
 assert.match(help,/class="visually-hidden"/);
});
