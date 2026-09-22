import {defineConfig} from 'vite';

export default defineConfig({
  base: './',
  build:{rollupOptions:{output:{manualChunks(id){
   if(id.includes('three-gpu-pathtracer')||id.includes('three-mesh-bvh'))return 'pathtracer';
   if(id.includes('/three/'))return 'three';
   if(id.includes('clipper-lib'))return 'clipper';
  }}}},
});
