// Ferramentas: booleanas (CSG), vista explodida, import/export, BOM.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// ---------- geometria única em espaço de mundo (para CSG/exportar)
export function worldGeometry(obj) {
  obj.updateWorldMatrix(true, true);
  const parts = [];
  obj.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    if (o.isInstancedMesh) {
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4);
        const g = o.geometry.clone().applyMatrix4(m4).applyMatrix4(o.matrixWorld);
        parts.push(clean(g));
      }
      return;
    }
    parts.push(clean(o.geometry.clone().applyMatrix4(o.matrixWorld)));
  });
  if (!parts.length) return null;
  return mergeGeometries(parts, false);
}

function clean(g) {
  const ng = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(ng.attributes)) if (k !== 'position' && k !== 'normal') ng.deleteAttribute(k);
  if (!ng.attributes.normal) ng.computeVertexNormals();
  ng.clearGroups();
  return ng;
}

const evaluator = new Evaluator();
evaluator.attributes = ['position', 'normal'];
evaluator.useGroups = false;

export function csg(objA, objB, op) {
  const ga = worldGeometry(objA), gb = worldGeometry(objB);
  if (!ga || !gb) throw new Error('Seleção sem geometria');
  const a = new Brush(mergeVertices(ga, 1e-4)); const bb = new Brush(mergeVertices(gb, 1e-4));
  a.updateMatrixWorld(); bb.updateMatrixWorld();
  const res = evaluator.evaluate(a, bb, { union: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION }[op]);
  const g = res.geometry;
  if (!g.attributes.position || g.attributes.position.count === 0) throw new Error('Resultado vazio (os objetos se tocam?)');
  g.computeBoundingBox();
  return g;
}

// ---------- vista explodida
// modo: 'radial' | 'y' (camadas) | 'x' | 'z'
export function computeExplode(objects, containers, mode) {
  // objects: Map id->holder ; containers: Map parentId->[childIds]
  const offsets = new Map();
  const tmp = new THREE.Box3(), c = new THREE.Vector3(), inv = new THREE.Matrix4();
  containers.forEach((ids, pid) => {
    if (ids.length < 2) return;
    const parentObj = pid ? objects.get(pid) : null;
    if (parentObj) { parentObj.updateWorldMatrix(true, false); inv.copy(parentObj.matrixWorld).invert(); } else inv.identity();
    const centers = ids.map(id => {
      const o = objects.get(id); tmp.setFromObject(o);
      if (tmp.isEmpty()) return null;
      return tmp.getCenter(c.clone()).applyMatrix4(inv);
    });
    const valid = centers.filter(Boolean);
    if (!valid.length) return;
    const mid = valid.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(valid.length);
    const sizeBox = new THREE.Box3(); valid.forEach(v => sizeBox.expandByPoint(v));
    const span = Math.max(20, sizeBox.getSize(new THREE.Vector3()).length());
    if (mode === 'radial') {
      ids.forEach((id, i) => { if (!centers[i]) return; const d = centers[i].clone().sub(mid); offsets.set(id, d.multiplyScalar(1.0)); });
    } else {
      const ax = mode;
      const order = ids.map((id, i) => ({ id, v: centers[i] ? centers[i][ax] : 0 })).sort((p, q) => p.v - q.v);
      const step = span * 0.18;
      order.forEach((o, rank) => { const v = new THREE.Vector3(); v[ax] = (rank - (order.length - 1) / 2) * step; offsets.set(o.id, v); });
    }
  });
  return offsets;
}

// ---------- exportação
export function download(name, data, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function exportRoot(objs) {
  const root = new THREE.Group();
  objs.forEach(o => { o.updateWorldMatrix(true, true); const c = o.clone(true); c.applyMatrix4(o.parent ? o.parent.matrixWorld : new THREE.Matrix4()); root.add(c); });
  // Converte Y-up (three) para Z-up (padrão de CAD/impressão 3D) no STL/OBJ
  return root;
}

export function exportSTL(objs, name, zUp = true) {
  const root = exportRoot(objs);
  if (zUp) root.rotation.x = Math.PI / 2;
  root.updateMatrixWorld(true);
  const data = new STLExporter().parse(root, { binary: true });
  download(name + '.stl', data, 'model/stl');
}

export function exportOBJ(objs, name) {
  const root = exportRoot(objs); root.updateMatrixWorld(true);
  download(name + '.obj', new OBJExporter().parse(root), 'text/plain');
}

export async function exportGLB(objs, name) {
  const root = exportRoot(objs);
  root.scale.setScalar(0.001); // glTF usa metros
  const data = await new GLTFExporter().parseAsync(root, { binary: true });
  download(name + '.glb', data, 'model/gltf-binary');
}

// ---------- importação: retorna [{name, geometry(world), color}]
export async function importFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const buf = await file.arrayBuffer();
  const out = [];
  const collect = (root, scale = 1) => {
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh) return;
      const g = clean(o.geometry.clone().applyMatrix4(o.matrixWorld));
      if (scale !== 1) g.scale(scale, scale, scale);
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      out.push({ name: o.name || file.name, geometry: g, color: m?.color ? '#' + m.color.getHexString() : null });
    });
  };
  if (ext === 'stl') {
    const g = new STLLoader().parse(buf);
    g.rotateX(-Math.PI / 2); // Z-up -> Y-up
    out.push({ name: file.name.replace(/\.stl$/i, ''), geometry: clean(g), color: null });
  } else if (ext === 'obj') {
    collect(new OBJLoader().parse(new TextDecoder().decode(buf)));
  } else if (ext === 'glb' || ext === 'gltf') {
    const gltf = await new GLTFLoader().parseAsync(buf, '');
    collect(gltf.scene, 1000); // metros -> mm
  } else throw new Error('Formato não suportado: .' + ext);
  // apoia no grid
  const box = new THREE.Box3(); out.forEach(o => { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); });
  out.forEach(o => o.geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
  return out;
}

// ---------- BOM (lista de materiais)
export function buildBOM(doc, byType) {
  const rows = new Map();
  const isHidden = (n) => { let p = n; while (p) { if (!p.visible) return true; p = doc.nodes.find(x => x.id === p.parent); } return false; };
  doc.nodes.forEach(n => {
    if (n.type === 'group' || isHidden(n)) return;
    const key = n.type + '|' + n.name + '|' + JSON.stringify(n.params) + '|' + n.cost;
    const r = rows.get(key) || { name: n.name, type: byType[n.type]?.name || 'Malha', cat: byType[n.type]?.cat || 'Importado', qty: 0, cost: +n.cost || 0, supplier: n.supplier || '' };
    r.qty += (+n.qty || 1);
    rows.set(key, r);
  });
  const list = [...rows.values()].sort((a, b) => b.cost * b.qty - a.cost * a.qty);
  const total = list.reduce((s, r) => s + r.cost * r.qty, 0);
  return { list, total };
}

export function bomCSV(bom) {
  const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
  const lines = [['Item', 'Tipo', 'Categoria', 'Qtd', 'Custo unit. (R$)', 'Subtotal (R$)', 'Fornecedor'].map(esc).join(';')];
  bom.list.forEach(r => lines.push([r.name, r.type, r.cat, r.qty, r.cost.toFixed(2).replace('.', ','), (r.cost * r.qty).toFixed(2).replace('.', ','), r.supplier].map(esc).join(';')));
  lines.push(['TOTAL', '', '', '', '', bom.total.toFixed(2).replace('.', ','), ''].map(esc).join(';'));
  return '﻿' + lines.join('\n');
}
