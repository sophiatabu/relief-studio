import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('template actions live in their own menu beside File',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/templateMenu\.className='template-menu app-menu'/);
 assert.match(main,/templateItems\.append\(applyStudioTemplate,\$\('saveSettings'\),\$\('loadRecipe'\)\)/);
 assert.match(main,/fileItems\.append\(\$\('importButton'\),\$\('fileInput'\),\$\('exportButton'\),\$\('exportModel'\)\)/);
 assert.match(main,/prepend\(fileMenu,templateMenu\)/);
});

test('menus fit their labels and primary actions receive restrained line icons',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 const icons=await readFile(new URL('../src/ui-icons.js',import.meta.url),'utf8');
 assert.match(css,/\.app-menu-items\{[^}]*z-index:80[^}]*width:max-content[^}]*min-width:260px/);
 assert.match(css,/header\{[^}]*position:relative[^}]*z-index:100[^}]*overflow:visible/);
 assert.match(css,/\.empty-studio \.file-menu\{display:block\}/);
 assert.match(css,/@media\(max-width:1180px\)\{header \.panel-switcher>button\.has-ui-icon/);
 assert.match(css,/@media\(max-width:880px\)\{header \.app-menu>summary\.has-ui-icon/);
 assert.match(main,/\[\$\('showSettings'\),'settings'\]/);
 assert.match(main,/\[\$\('exportButton'\),'download'\]/);
 assert.match(icons,/export function addIcon/);
 assert.doesNotMatch(icons,/<img/);
});
