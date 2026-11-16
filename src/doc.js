// Modelo do documento (projeto). Tudo que é salvo fica aqui; a cena Three.js é derivada.
import { byType, defaults } from './library.js';

let counter = 0;
export const uid = () => Date.now().toString(36) + (counter++).toString(36) + Math.random().toString(36).slice(2, 5);

export function newDoc(name = 'Projeto sem nome') {
  return { app: 'ZeyForge', version: 1, name, units: 'mm', nodes: [], blobs: {} };
}

export function makeNode(type, params = {}, extra = {}) {
  const d = byType[type];
  return {
    id: uid(),
    name: extra.name || (d ? d.name : type === 'group' ? 'Montagem' : 'Malha'),
    type,
    params: d ? { ...defaults(type), ...params } : {},
    pos: extra.pos || [0, 0, 0],
    rot: extra.rot || [0, 0, 0],
    scl: extra.scl || [1, 1, 1],
    mat: { preset: extra.mat ?? (d?.defaultMat ?? null), color: extra.color ?? null, opacity: extra.opacity ?? 1 },
    visible: true,
    locked: false,
    parent: extra.parent ?? null,
    cost: extra.cost ?? (d ? d.cost : 0),
    qty: 1,
    supplier: '',
    notes: '',
    blob: extra.blob ?? null,
    expanded: true,
  };
}

export const children = (doc, id) => doc.nodes.filter(n => n.parent === id);
export const get = (doc, id) => doc.nodes.find(n => n.id === id);

export function descendants(doc, id) {
  const out = [];
  const walk = pid => children(doc, pid).forEach(c => { out.push(c); walk(c.id); });
  walk(id);
  return out;
}

export function removeNodes(doc, ids) {
  const kill = new Set();
  ids.forEach(id => { kill.add(id); descendants(doc, id).forEach(d => kill.add(d.id)); });
  doc.nodes = doc.nodes.filter(n => !kill.has(n.id));
}

// Clona nós (com descendentes), retornando os novos ids raiz
export function cloneNodes(doc, ids, offset = [0, 0, 0]) {
  const roots = [];
  const map = new Map();
  const all = [];
  ids.forEach(id => { const n = get(doc, id); if (n) { all.push(n); descendants(doc, id).forEach(d => all.push(d)); } });
  const uniq = [...new Map(all.map(n => [n.id, n])).values()];
  uniq.forEach(n => map.set(n.id, uid()));
  uniq.forEach(n => {
    const c = JSON.parse(JSON.stringify(n));
    c.id = map.get(n.id);
    if (map.has(n.parent)) c.parent = map.get(n.parent);
    else { c.pos = c.pos.map((v, i) => v + offset[i]); roots.push(c.id); c.name = n.name; }
    doc.nodes.push(c);
  });
  return roots;
}

// ---------- serialização de geometria (para malhas importadas / resultado de booleanas)
const toB64 = (typed) => {
  const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
};
const fromB64 = (b64, Type) => {
  const s = atob(b64); const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Type(bytes.buffer);
};

export function geometryToBlob(geometry) {
  const g = geometry;
  return {
    pos: toB64(new Float32Array(g.attributes.position.array)),
    nor: g.attributes.normal ? toB64(new Float32Array(g.attributes.normal.array)) : null,
    idx: g.index ? toB64(new Uint32Array(g.index.array)) : null,
  };
}

export function blobArrays(blob) {
  return {
    pos: fromB64(blob.pos, Float32Array),
    nor: blob.nor ? fromB64(blob.nor, Float32Array) : null,
    idx: blob.idx ? fromB64(blob.idx, Uint32Array) : null,
  };
}

// ---------- histórico (desfazer/refazer). Blobs são imutáveis e ficam fora dos snapshots.
export class History {
  constructor(limit = 120) { this.undo = []; this.redo = []; this.limit = limit; }
  push(doc) {
    this.undo.push(JSON.stringify({ nodes: doc.nodes, name: doc.name }));
    if (this.undo.length > this.limit) this.undo.shift();
    this.redo.length = 0;
  }
  back(doc) {
    if (this.undo.length < 2) return false;
    this.redo.push(this.undo.pop());
    Object.assign(doc, JSON.parse(this.undo[this.undo.length - 1]));
    return true;
  }
  forward(doc) {
    if (!this.redo.length) return false;
    const s = this.redo.pop(); this.undo.push(s);
    Object.assign(doc, JSON.parse(s));
    return true;
  }
  reset(doc) { this.undo = []; this.redo = []; this.push(doc); }
}
