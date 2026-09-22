import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const EXTRUDE_DEFAULTS = Object.freeze({curveSegments: 3, steps: 1, bevelSegments: 1});

// Model-owned resources only. Environment/gradient textures belong to the studio.
export function disposeRenderPipeline(model) {
  if (!model) return;
  const geometries = new Set(), materials = new Set();
  model.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of [node.material].flat()) if (material) materials.add(material);
  });
  model.removeFromParent();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  model.clear();
}

function normalizedGeometry(mesh) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.updateMatrix();
  geometry.applyMatrix4(mesh.matrix);
  const count = geometry.attributes.position.count;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  if (!geometry.attributes.rimProfile) geometry.setAttribute('rimProfile', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  const role = mesh.userData.surface === 'rim-cap' ? 3 : mesh.userData.role === 'rim' ? 2 : ['enamel', 'light', 'metal-plate', 'dark-metal'].includes(mesh.userData.role) ? 1 : 0;
  geometry.setAttribute('surfaceRole', new THREE.Float32BufferAttribute(new Float32Array(count).fill(role), 1));
  // Highlight colours are recomputed after batching, not baked into the key.
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 4).fill(1), 4));
  geometry.clearGroups();
  return geometry;
}

// Materials with different response to lighting must never share a draw batch.
export function materialBatchKey(material,role='') {
 const fields=['type','metalness','roughness','clearcoat','clearcoatRoughness','specularIntensity','transmission','ior','opacity','transparent','side','depthWrite','wireframe','flatShading'];
 return JSON.stringify([role,material.color?.getHexString(),material.emissive?.getHexString(),...fields.map(k=>material[k]),...['map','normalMap','roughnessMap','metalnessMap','alphaMap'].map(k=>material[k]?.uuid||null)]);
}

export function batchByColor(model) {
  const groups = new Map(), old = [...model.children];
  const temporary = [], created = [], materials = new Set();
  try {
    for (const mesh of old) {
      if (!mesh.isMesh) continue;
      const color = materialBatchKey(mesh.material,mesh.userData.role);
      if (!groups.has(color)) groups.set(color, []);
      const geometry = normalizedGeometry(mesh);
      temporary.push(geometry);
      groups.get(color).push({mesh, geometry});
      materials.add(mesh.material);
    }
    for (const [batchKey, pieces] of groups) {
      const color='#'+pieces[0].mesh.material.color.getHexString();
      const geometry = mergeGeometries(pieces.map(piece => piece.geometry), false);
      if (!geometry) throw new Error('Не удалось объединить геометрию цвета ' + color);
      const material = pieces[0].mesh.material.clone();
      material.vertexColors=true;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = color;
      mesh.castShadow = mesh.receiveShadow = true;
      let start = 0;
      const parts = pieces.map(piece => {
        const part = {...piece.mesh.userData, start, count: piece.geometry.attributes.position.count};
        start += part.count;
        return part;
      });
      mesh.userData = {...pieces[0].mesh.userData, colorKey: color, batchKey, parts};
      if (parts.some(part => part.surface === 'rim-cap')) mesh.userData.surface = 'rim-cap';
      created.push(mesh);
    }
    for (const mesh of old) { model.remove(mesh); mesh.geometry?.dispose(); }
    for (const material of materials) material.dispose();
    model.add(...created);
    model.userData.batchRevision = (model.userData.batchRevision || 0) + 1;
    return groups.size;
  } catch (error) {
    for (const mesh of created) { mesh.geometry.dispose(); mesh.material.dispose(); }
    throw error;
  } finally {
    for (const geometry of temporary) geometry.dispose();
  }
}

// Change pigments without triangulating again. Ranges retain individual selection IDs.
export function refreshBatchMaterials(model, materialForPart) {
  const candidates=new Map(),batchKeys=new Set();let compatible=true;
  for(const mesh of model.children){
    const materials=(mesh.userData.parts||[]).map(part=>materialForPart(part,mesh.material));
    candidates.set(mesh,materials);
    const keys=materials.map((material,i)=>materialBatchKey(material,mesh.userData.parts[i].role));
    if(!keys.length||keys.some(key=>key!==keys[0])||batchKeys.has(keys[0]))compatible=false;
    batchKeys.add(keys[0]);
  }
  if(compatible){
    for(const [mesh,materials]of candidates){
      mesh.material.copy(materials[0]);mesh.material.userData=structuredClone(materials[0].userData);mesh.material.vertexColors=true;mesh.material.needsUpdate=true;
      mesh.userData.colorKey='#'+materials[0].color.getHexString();
      for(const material of materials)material.dispose();
    }
    return false;
  }
  for(const materials of candidates.values())for(const material of materials)material.dispose();
  const pieces = new THREE.Group();
  try {
    for (const mesh of model.children) {
      for (const part of mesh.userData.parts || []) {
        const geometry = new THREE.BufferGeometry();
        for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) {
          if (name === 'color') continue;
          geometry.setAttribute(name, new THREE.BufferAttribute(attribute.array.slice(part.start * attribute.itemSize, (part.start + part.count) * attribute.itemSize), attribute.itemSize, attribute.normalized));
        }
        const copy = new THREE.Mesh(geometry, materialForPart(part, mesh.material));
        copy.userData = {...part};
        pieces.add(copy);
      }
    }
    batchByColor(pieces);
    const replacement = [...pieces.children];
    const old = new THREE.Group(); old.add(...model.children);
    disposeRenderPipeline(old);
    model.add(...replacement);
    model.userData.batchRevision++;
    return true;
  } catch (error) { disposeRenderPipeline(pieces); throw error; }
}

export function setModelDepth(model, depth) {
  if (!model || !Number.isFinite(depth) || depth <= 0) return false;
  model.scale.z = .01 * depth / model.userData.baseDepth;
  model.updateMatrixWorld(true);
  return true;
}

// One pending frame, with a finite optional refinement pass. Never ticks in idle.
export function createRenderScheduler(render, {
  schedule = callback => requestAnimationFrame(callback),
  cancel = handle => cancelAnimationFrame(handle),
} = {}) {
  let pending = null, disposed = false;
  function requestRender() {
    if (disposed || pending !== null) return;
    pending = schedule(time => {
      pending = null;
      if (render(time) === true) requestRender();
    });
  }
  function dispose() {
    disposed = true;
    if (pending !== null) cancel(pending);
    pending = null;
  }
  return {requestRender, dispose};
}
