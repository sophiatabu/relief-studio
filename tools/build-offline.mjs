import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, process.argv[2] || '../../outputs/Relief-Offline.html');
const legacyAssets = Object.fromEntries(await Promise.all(
  ['robot', 'meditation', 'sneaker', 'paw', 'car', 'seams'].map(async key =>
    [key, JSON.parse(await fs.readFile(path.join(root, 'public/assets', key + '.json'), 'utf8'))])
));
const result = await build({
  absWorkingDir: root, entryPoints: ['src/main.js'], bundle: true,
  outfile: 'offline/app.js', write: false, format: 'iife', target: 'es2022', minify: true,
  define: { 'import.meta.env.BASE_URL': '"./"' },
  plugins: [{
    name: 'offline-assets', setup(builder) {
      builder.onLoad({ filter: /[/\\]src[/\\]main\.js$/ }, async ({ path: filename }) => {
        let contents = await fs.readFile(filename, 'utf8');
        const request = "const res=await fetch(publicAsset(keyName+'.json'));";
        if (!contents.includes(request)) throw new Error('Preset loading changed; update the offline build.');
        contents = 'const offlineAssets=' + JSON.stringify(legacyAssets) + ';\n' + contents.replace(request,
          'const res={ok:!!offlineAssets[keyName],json:async()=>offlineAssets[keyName]};');
        const recipeRequest="const response=await fetch(publicAsset(d.assetKey+'.json'));";
        if(!contents.includes(recipeRequest))throw new Error('Recipe loading changed; update offline build.');
        contents=contents.replace(recipeRequest,'const response={ok:!!offlineAssets[d.assetKey],json:async()=>offlineAssets[d.assetKey]};');
        return { contents, loader: 'js' };
      });
    }
  }]
});
let html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const js = result.outputFiles.find(f => f.path.endsWith('.js')).text;
// Offline uses the existing system-font fallback instead of Google Fonts.
const css = result.outputFiles.find(f => f.path.endsWith('.css')).text
  .replace(/@import\s*(?:url\([^)]*\)|["'][^"']*["'])\s*;/g, '');
for (const match of [...html.matchAll(/src="(\/assets\/[^"<>]+\.png)"/g)]) {
  const data = await fs.readFile(path.join(root, 'public', match[1]));
  html = html.replace(match[0], 'src="data:image/png;base64,' + data.toString('base64') + '"');
}
html = html.replace('</head>', '<style>' + css.replace(/<\/style/gi, '<\\/style') + '</style></head>');
html = html.replace('<script type="module" src="/src/main.js"></script>', '');
html = html.replace('</body>',()=>'<script>'+js.replace(/<\/script/gi,'<\\/script')+'</script></body>');
html=html.replace('<html lang="ru">','<html lang="ru" data-offline>');
if (/(?:src|href)="\/(?:assets|src)\//.test(html) || /@import\s/.test(css)) {
  throw new Error('Offline HTML still contains external file dependencies.');
}
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, html);
console.log(output + '\n' + Buffer.byteLength(html) + ' bytes; all code and nine examples embedded.');
