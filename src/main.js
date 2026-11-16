// ZeyForge — CAD 3D de hardware no navegador.
import * as THREE from 'three';
import { Viewport } from './viewport.js';
import { LIBRARY, CATEGORIES, byType, buildComponent } from './library.js';
import { TEMPLATES } from './templates.js';
import { makeMaterial, materialOptions, MATERIALS, clipPlanes } from './materials.js';
import { newDoc, makeNode, get, children, descendants, removeNodes, cloneNodes, geometryToBlob, blobArrays, History, uid } from './doc.js';
import { csg, computeExplode, exportSTL, exportOBJ, exportGLB, importFile, download, buildBOM, bomCSV } from './tools.js';
import { icon } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
  return e;
};
const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toString();
const brl = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DEG = Math.PI / 180;

/* ============================== ESTADO ============================== */
const S = {
  doc: newDoc(),
  hist: new History(),
  objects: new Map(),     // id -> holder (THREE.Group)
  sel: [],
  tool: 'translate',
  snap: true, snapMove: 1, snapRot: 15,
  explode: { f: 0, mode: 'radial', cache: null },
  clip: { axis: '', t: 0.5, flip: false },
  xray: false, wire: false,
  leftTab: 'lib', rightTab: 'props', search: '', collapsed: {},
};
const vp = new Viewport($('#view'));

/* ============================== CENA <- DOC ============================== */
function depth(n) { let d = 0, p = n; while (p && p.parent) { p = get(S.doc, p.parent); d++; } return d; }

function buildContent(n) {
  if (n.type === 'group') return null;
  if (n.type === 'mesh') {
    const blob = S.doc.blobs[n.blob];
    const g = new THREE.BufferGeometry();
    if (blob) {
      const a = blobArrays(blob);
      g.setAttribute('position', new THREE.BufferAttribute(a.pos, 3));
      if (a.nor) g.setAttribute('normal', new THREE.BufferAttribute(a.nor, 3)); else g.computeVertexNormals();
      if (a.idx) g.setIndex(new THREE.BufferAttribute(a.idx, 1));
    }
    const m = new THREE.Mesh(g, makeMaterial('aluminio'));
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  try { return buildComponent(n.type, n.params); }
  catch (e) { console.error(e); toast('Erro ao gerar ' + n.name + ': ' + e.message, 'err'); return new THREE.Group(); }
}

function cloneMat(m) { const c = m.clone(); c.clippingPlanes = clipPlanes; c.userData = { ...m.userData }; return c; }

function applyMaterials(n, holder) {
  const content = holder.userData.content; if (!content) return;
  content.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData.baseMat) o.userData.baseMat = o.material;
    let m = o.userData.baseMat;
    if (n.mat.preset) m = makeMaterial(n.mat.preset, { color: n.mat.color });
    else if (n.mat.color) { m = cloneMat(m); m.color.set(n.mat.color); }
    const op = n.mat.opacity ?? 1;
    if (op < 1 || S.xray || S.wire) {
      if (m === o.userData.baseMat) m = cloneMat(m);
      if (op < 1 || S.xray) { m.transparent = true; m.opacity = S.xray ? Math.min(op, 0.22) : op; m.depthWrite = false; m.transmission = 0; }
      if (S.wire) m.wireframe = true;
    }
    m.clippingPlanes = clipPlanes;
    if (clipPlanes.length) m.side = THREE.DoubleSide;
    o.material = m;
  });
}

function applyTransform(n, holder) {
  const off = (S.explode.f > 0 && S.explode.cache && S.explode.cache.get(n.id)) || null;
  holder.position.set(...n.pos);
  if (off) holder.position.addScaledVector(off, S.explode.f * 1.6);
  holder.rotation.set(n.rot[0] * DEG, n.rot[1] * DEG, n.rot[2] * DEG);
  holder.scale.set(...n.scl);
  holder.visible = n.visible;
}

function buildHolder(n) {
  const holder = new THREE.Group();
  holder.name = n.name; holder.userData.nodeId = n.id;
  const c = buildContent(n);
  if (c) { holder.add(c); holder.userData.content = c; }
  applyTransform(n, holder); applyMaterials(n, holder);
  return holder;
}

function rebuildAll(keepSel = true) {
  vp.attachGizmo(null);
  vp.model.clear();
  S.objects.clear();
  [...S.doc.nodes].sort((a, b) => depth(a) - depth(b)).forEach(n => {
    const holder = buildHolder(n);
    S.objects.set(n.id, holder);
    (n.parent && S.objects.get(n.parent) || vp.model).add(holder);
  });
  S.explode.cache = null; if (S.explode.f > 0) applyExplode();
  if (S.clip.axis) applyClip();
  S.sel = keepSel ? S.sel.filter(id => get(S.doc, id)) : [];
  refreshSelection();
  renderOutliner(); renderBOM();
  vp.updateShadowBounds();
}

function rebuildNode(id) {
  const n = get(S.doc, id), holder = S.objects.get(id); if (!n || !holder) return;
  if (holder.userData.content) { holder.remove(holder.userData.content); disposeTree(holder.userData.content); }
  const c = buildContent(n);
  if (c) { holder.add(c); holder.userData.content = c; }
  holder.name = n.name;
  applyTransform(n, holder); applyMaterials(n, holder);
  S.explode.cache = null; if (S.explode.f > 0) applyExplode();
  refreshSelectionBoxes();
}

function disposeTree(o) { o.traverse(x => { if (x.isMesh) { x.geometry?.dispose(); } }); }

function refreshMaterialsAll() { S.doc.nodes.forEach(n => { const ho = S.objects.get(n.id); if (ho) applyMaterials(n, ho); }); }

/* ============================== HISTÓRICO / AUTOSAVE ============================== */
let saveTimer;
function commit(rebuild = false) {
  S.hist.push(S.doc);
  if (rebuild) rebuildAll(); else { renderOutliner(); renderBOM(); }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(autosave, 400);
  updateTitle();
}
function autosave() { try { localStorage.setItem('zeyforge.autosave', JSON.stringify(S.doc)); } catch (e) { /* armazenamento cheio/indisponível */ } }
function undo() { if (S.hist.back(S.doc)) { rebuildAll(); renderProps(); autosave(); toast('Desfeito'); } }
function redo() { if (S.hist.forward(S.doc)) { rebuildAll(); renderProps(); autosave(); toast('Refeito'); } }

/* ============================== SELEÇÃO ============================== */
function select(ids, additive = false) {
  ids = ids.filter(Boolean);
  if (additive) { ids.forEach(id => { const i = S.sel.indexOf(id); i >= 0 ? S.sel.splice(i, 1) : S.sel.push(id); }); }
  else S.sel = ids;
  refreshSelection();
}
function refreshSelectionBoxes() { vp.showSelection(S.sel.map(id => S.objects.get(id)).filter(Boolean)); }
function refreshSelection() {
  refreshSelectionBoxes();
  const primary = S.sel[0] && get(S.doc, S.sel[0]);
  const canMove = primary && !primary.locked && S.explode.f === 0 && S.tool !== 'select' && vp.mode !== 'measure';
  vp.attachGizmo(canMove ? S.objects.get(primary.id) : null);
  renderOutliner(); renderProps(); updateStatus(); updateToolbar();
}

vp.addEventListener('pick', e => {
  const { hit, shift } = e.detail;
  if (!hit) { if (!shift) select([]); return; }
  let o = hit.object, id = null;
  while (o) { if (o.userData.nodeId) { id = o.userData.nodeId; break; } o = o.parent; }
  let n = get(S.doc, id);
  while (n && n.locked && n.parent) n = get(S.doc, n.parent);
  if (!n) return;
  // clicar de novo numa peça já selecionada sobe para a montagem-pai
  if (!shift && S.sel.length === 1 && S.sel[0] === n.id && n.parent) n = get(S.doc, n.parent);
  select([n.id], shift);
});

vp.addEventListener('transform', e => {
  const holder = e.detail, n = get(S.doc, holder.userData.nodeId); if (!n) return;
  n.pos = holder.position.toArray().map(v => +v.toFixed(4));
  n.rot = [holder.rotation.x, holder.rotation.y, holder.rotation.z].map(v => +(v / DEG).toFixed(3));
  n.scl = holder.scale.toArray().map(v => +v.toFixed(4));
  syncTransformFields(n); updateStatus();
});
vp.addEventListener('transform-end', () => commit());
vp.addEventListener('measured', e => toast(`Distância: ${e.detail.d.toFixed(2)} mm`));

/* ============================== OPERAÇÕES ============================== */
function placeBesideScene() {
  const box = vp.bounds();
  return box.isEmpty() ? [0, 0, 0] : [Math.ceil(box.max.x + 15), 0, 0];
}

// Encosta o objeto recém-criado à direita do que já existe na cena (sem sobrepor)
function placeNode(id, sceneBox) {
  if (sceneBox.isEmpty()) return;
  const n = get(S.doc, id), ho = S.objects.get(id);
  const b = new THREE.Box3().setFromObject(ho); if (b.isEmpty()) return;
  n.pos[0] += Math.ceil(sceneBox.max.x + 15 - b.min.x);
  n.pos[1] -= Math.min(0, b.min.y) - 0;
  n.pos[2] += (sceneBox.min.z + sceneBox.max.z) / 2 - (b.min.z + b.max.z) / 2;
  applyTransform(n, ho);
}

function addComponent(type) {
  const sceneBox = vp.bounds();
  const n = makeNode(type, {});
  S.doc.nodes.push(n); rebuildAll(); placeNode(n.id, sceneBox); commit(); select([n.id]); vp.fit([S.objects.get(n.id)]);
  toast(`${n.name} adicionado`);
}

function addTemplate(t) {
  const sceneBox = vp.bounds();
  const root = t.build(S.doc);
  rebuildAll(); placeNode(root, sceneBox);
  commit(true); select([root]); vp.fit([S.objects.get(root)], new THREE.Vector3(1, 0.9, 1.1));
  toast(`Montagem "${t.name}" criada`);
}

function deleteSel() {
  if (!S.sel.length) return;
  const k = S.sel.length; removeNodes(S.doc, S.sel); S.sel = []; commit(true); toast(`${k} item(ns) removido(s)`);
}

function duplicateSel() {
  if (!S.sel.length) return;
  const roots = cloneNodes(S.doc, topLevel(S.sel), [10, 0, 10]);
  roots.forEach(id => { const n = get(S.doc, id); n.name = n.name + ' (cópia)'; });
  commit(true); select(roots);
}

function topLevel(ids) { return ids.filter(id => !ids.some(o => o !== id && descendants(S.doc, o).some(d => d.id === id))); }

function worldMatrixOf(id) { const o = id ? S.objects.get(id) : vp.model; o.updateWorldMatrix(true, false); return o.matrixWorld.clone(); }

function reparent(id, newParent) {
  const n = get(S.doc, id); if (!n || n.id === newParent) return;
  if (newParent && descendants(S.doc, id).some(d => d.id === newParent)) return toast('Não dá para colocar uma montagem dentro dela mesma', 'err');
  const world = worldMatrixOf(id);
  const local = new THREE.Matrix4().copy(worldMatrixOf(newParent)).invert().multiply(world);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  local.decompose(p, q, s);
  const e = new THREE.Euler().setFromQuaternion(q);
  n.pos = p.toArray().map(v => +v.toFixed(4)); n.rot = [e.x, e.y, e.z].map(v => +(v / DEG).toFixed(3)); n.scl = s.toArray().map(v => +v.toFixed(4));
  n.parent = newParent || null;
}

function groupSel() {
  const ids = topLevel(S.sel); if (!ids.length) return;
  const parent = get(S.doc, ids[0]).parent;
  const g = makeNode('group', {}, { name: 'Montagem', parent });
  S.doc.nodes.push(g); rebuildAll();
  ids.forEach(id => reparent(id, g.id));
  commit(true); select([g.id]); toast('Agrupado (Ctrl+Shift+G desagrupa)');
}

function ungroupSel() {
  const n = get(S.doc, S.sel[0]); if (!n || n.type !== 'group') return toast('Selecione uma montagem', 'err');
  const kids = children(S.doc, n.id).map(c => c.id);
  kids.forEach(id => reparent(id, n.parent));
  S.doc.nodes = S.doc.nodes.filter(x => x.id !== n.id);
  commit(true); select(kids);
}

function mirrorSel(axis = 0) {
  if (!S.sel.length) return;
  const roots = cloneNodes(S.doc, topLevel(S.sel));
  roots.forEach(id => { const n = get(S.doc, id); n.pos[axis] = -n.pos[axis]; n.scl[axis] = -n.scl[axis]; n.rot = n.rot.map((r, i) => i === axis ? r : -r); n.name += ' (espelho)'; });
  commit(true); select(roots); toast('Espelhado no plano ' + ['YZ', 'XZ', 'XY'][axis]);
}

async function arraySel() {
  if (!S.sel.length) return toast('Selecione algo primeiro', 'err');
  const box = vp.bounds(S.sel.map(id => S.objects.get(id))); const size = box.getSize(new THREE.Vector3());
  const r = await modal('Padrão linear (array)', [
    { k: 'count', label: 'Quantidade total', value: 4, type: 'number' },
    { k: 'axis', label: 'Eixo', value: 'x', type: 'select', options: [['x', 'X'], ['y', 'Y'], ['z', 'Z']] },
    { k: 'step', label: 'Espaçamento (mm)', value: +(size.x + 2).toFixed(2), type: 'number' },
  ]);
  if (!r) return;
  const ai = { x: 0, y: 1, z: 2 }[r.axis]; const out = [...S.sel];
  for (let i = 1; i < Math.max(2, +r.count); i++) { const off = [0, 0, 0]; off[ai] = +r.step * i; out.push(...cloneNodes(S.doc, topLevel(S.sel), off)); }
  commit(true); select(out); toast(`${r.count} cópias em ${r.axis.toUpperCase()}`);
}

function booleanOp(op) {
  if (S.sel.length !== 2) return toast('Selecione exatamente 2 objetos (Shift+clique). O 1º é a base.', 'err');
  const [a, b] = S.sel.map(id => S.objects.get(id));
  try {
    const t0 = performance.now();
    const g = csg(a, b, op);
    const blobId = uid(); S.doc.blobs[blobId] = geometryToBlob(g);
    const base = get(S.doc, S.sel[0]);
    const n = makeNode('mesh', {}, { name: `${base.name} ${{ union: '∪', subtract: '−', intersect: '∩' }[op]} ${get(S.doc, S.sel[1]).name}`, blob: blobId, mat: base.mat.preset || 'aluminio', color: base.mat.color, cost: (+base.cost || 0) });
    removeNodes(S.doc, S.sel); S.doc.nodes.push(n); commit(true); select([n.id]);
    toast(`Booleana concluída em ${Math.round(performance.now() - t0)} ms`);
  } catch (e) { console.error(e); toast('Falha na booleana: ' + e.message, 'err'); }
}

function setTool(t) {
  S.tool = t; vp.setMode(t === 'measure' ? 'measure' : 'select');
  if (['translate', 'rotate', 'scale'].includes(t)) vp.gizmo.setMode(t);
  refreshSelection();
}

function applySnap() {
  vp.gizmo.setTranslationSnap(S.snap ? S.snapMove : null);
  vp.gizmo.setRotationSnap(S.snap ? S.snapRot * DEG : null);
  vp.gizmo.setScaleSnap(S.snap ? 0.05 : null);
}

function applyExplode() {
  if (S.explode.f > 0 && !S.explode.cache) {
    const f = S.explode.f; S.explode.f = 0;
    S.doc.nodes.forEach(n => applyTransform(n, S.objects.get(n.id)));
    const containers = new Map();
    S.doc.nodes.forEach(n => { if (!n.visible) return; const k = n.parent || null; if (!containers.has(k)) containers.set(k, []); containers.get(k).push(n.id); });
    S.explode.cache = computeExplode(S.objects, containers, S.explode.mode);
    S.explode.f = f;
  }
  S.doc.nodes.forEach(n => { const ho = S.objects.get(n.id); if (ho) applyTransform(n, ho); });
  refreshSelectionBoxes();
}

function applyClip() { vp.setClip(S.clip.axis || null, S.clip.t, S.clip.flip); }

/* ============================== ARQUIVOS ============================== */
function projectName() { return (S.doc.name || 'projeto').replace(/[^\w\-]+/g, '_'); }

function saveProject() { download(projectName() + '.zeyforge.json', JSON.stringify(S.doc), 'application/json'); toast('Projeto salvo'); }

function loadProjectData(data) {
  if (!data || !Array.isArray(data.nodes)) throw new Error('Arquivo inválido');
  S.doc = Object.assign(newDoc(), data); S.doc.blobs = S.doc.blobs || {};
  S.hist.reset(S.doc); S.sel = []; rebuildAll(false); vp.view('iso'); autosave(); updateTitle();
}

function pickFile(accept, multiple = false) {
  return new Promise(res => { const i = h('input', { type: 'file', accept, multiple }); i.onchange = () => res([...i.files]); i.click(); });
}

async function openProject() {
  const [f] = await pickFile('.json,.zeyforge'); if (!f) return;
  try { loadProjectData(JSON.parse(await f.text())); toast('Projeto aberto: ' + S.doc.name); } catch (e) { toast('Não consegui abrir: ' + e.message, 'err'); }
}

async function importMeshes() {
  const files = await pickFile('.stl,.obj,.glb,.gltf', true);
  for (const f of files) {
    try {
      const parts = await importFile(f);
      const pos = placeBesideScene();
      let parent = null;
      if (parts.length > 1) { const g = makeNode('group', {}, { name: f.name, pos }); S.doc.nodes.push(g); parent = g.id; }
      parts.forEach(p => {
        const blobId = uid(); S.doc.blobs[blobId] = geometryToBlob(p.geometry);
        S.doc.nodes.push(makeNode('mesh', {}, { name: p.name, blob: blobId, parent, pos: parent ? [0, 0, 0] : pos, mat: 'pla_cinza', color: p.color }));
      });
      commit(true); vp.fit(); toast(`Importado: ${f.name} (${parts.length} malha(s))`);
    } catch (e) { console.error(e); toast('Erro ao importar ' + f.name + ': ' + e.message, 'err'); }
  }
}

function exportTargets() { const ids = S.sel.length ? topLevel(S.sel) : S.doc.nodes.filter(n => !n.parent).map(n => n.id); return ids.map(id => S.objects.get(id)).filter(o => o && o.visible); }

async function doExport(kind) {
  const objs = exportTargets(); const name = projectName() + (S.sel.length ? '_selecao' : '');
  if (!objs.length && kind !== 'bom' && kind !== 'png') return toast('Nada para exportar', 'err');
  const prevF = S.explode.f;
  try {
    if (kind === 'stl') exportSTL(objs, name);
    if (kind === 'obj') exportOBJ(objs, name);
    if (kind === 'glb') await exportGLB(objs, name);
    if (kind === 'png') { vp.showSelection([]); vp.attachGizmo(null); const url = vp.screenshot(); const a = h('a', { href: url, download: name + '.png' }); a.click(); refreshSelection(); }
    if (kind === 'bom') download(name + '_BOM.csv', bomCSV(buildBOM(S.doc, byType)), 'text/csv');
    if (kind === 'json') saveProject();
    toast('Exportado: ' + kind.toUpperCase());
  } catch (e) { console.error(e); toast('Erro ao exportar: ' + e.message, 'err'); }
  S.explode.f = prevF;
}

async function newProject() {
  if (S.doc.nodes.length && !confirm('Começar um projeto novo? O atual fica salvo só se você exportou/salvou.')) return;
  const name = prompt('Nome do projeto:', 'Novo projeto') || 'Novo projeto';
  S.doc = newDoc(name); S.hist.reset(S.doc); S.sel = []; rebuildAll(false); vp.view('iso'); autosave(); updateTitle();
}

/* ============================== UI: TOPO ============================== */
function btn(ic, label, onclick, opts = {}) {
  return h('button', { class: 'tb' + (opts.active ? ' on' : '') + (opts.cls ? ' ' + opts.cls : ''), title: opts.title || label, onclick, 'data-k': opts.key }, h('span', { html: icon(ic) }), opts.text === false ? null : h('span', { class: 'lbl' }, label));
}

function menu(label, ic, items) {
  const d = h('details', { class: 'menu' }, h('summary', { class: 'tb' }, h('span', { html: icon(ic) }), h('span', { class: 'lbl' }, label)),
    h('div', { class: 'menu-pop' }, items.map(it => it === '-' ? h('hr') : h('button', { onclick: () => { d.open = false; it[2](); } }, h('span', { html: icon(it[1], 16) }), h('span', {}, it[0]), it[3] ? h('kbd', {}, it[3]) : null))));
  return d;
}

function renderTopbar() {
  const t = $('#topbar'); t.innerHTML = '';
  t.append(
    h('button', { class: 'tb mobile-only', onclick: () => document.body.classList.toggle('show-left'), html: icon('menu') }),
    h('div', { class: 'brand', html: `<svg width="26" height="26" viewBox="0 0 32 32"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5fb4ff"/><stop offset="1" stop-color="#7a5cff"/></linearGradient></defs><path d="M16 2l12 7v14l-12 7-12-7V9z" fill="url(#lg)"/><path d="M10 11h12l-12 10h12" stroke="#0d1117" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Zey<b>Forge</b></span>` }),
    menu('Arquivo', 'file', [['Novo projeto', 'plus', newProject], ['Abrir projeto…', 'open', openProject, 'Ctrl+O'], ['Salvar projeto', 'save', saveProject, 'Ctrl+S'], '-', ['Importar STL / OBJ / GLB…', 'import', importMeshes], '-', ['Renomear projeto', 'file', () => { const v = prompt('Nome do projeto:', S.doc.name); if (v) { S.doc.name = v; commit(); } }]]),
    menu('Exportar', 'export', [['STL (impressão 3D)', 'export', () => doExport('stl')], ['GLB (web / AR / Blender)', 'export', () => doExport('glb')], ['OBJ', 'export', () => doExport('obj')], '-', ['Imagem PNG', 'camera', () => doExport('png')], ['Lista de materiais (CSV)', 'bom', () => doExport('bom')], ['Projeto (.json)', 'save', () => doExport('json')]]),
    h('div', { class: 'sep' }),
    btn('undo', 'Desfazer', undo, { text: false, title: 'Desfazer (Ctrl+Z)' }),
    btn('redo', 'Refazer', redo, { text: false, title: 'Refazer (Ctrl+Y)' }),
    h('div', { class: 'sep' }),
    h('div', { class: 'seg', id: 'toolseg' },
      btn('select', 'Selecionar', () => setTool('select'), { key: 'select', text: false, title: 'Selecionar (Q)' }),
      btn('move', 'Mover', () => setTool('translate'), { key: 'translate', text: false, title: 'Mover (W)' }),
      btn('rotate', 'Girar', () => setTool('rotate'), { key: 'rotate', text: false, title: 'Girar (E)' }),
      btn('scale', 'Escalar', () => setTool('scale'), { key: 'scale', text: false, title: 'Escalar (R)' }),
      btn('measure', 'Medir', () => setTool('measure'), { key: 'measure', text: false, title: 'Medir distância (M)' })),
    btn('magnet', 'Snap', () => { S.snap = !S.snap; applySnap(); updateToolbar(); }, { key: 'snap', text: false, title: 'Snap: 1 mm / 15°' }),
    h('div', { class: 'sep' }),
    btn('union', 'Unir', () => booleanOp('union'), { text: false, title: 'Booleana: unir (2 objetos)' }),
    btn('subtract', 'Subtrair', () => booleanOp('subtract'), { text: false, title: 'Booleana: subtrair o 2º do 1º' }),
    btn('intersect', 'Interseção', () => booleanOp('intersect'), { text: false, title: 'Booleana: interseção' }),
    h('div', { class: 'sep' }),
    btn('dup', 'Duplicar', duplicateSel, { text: false, title: 'Duplicar (Ctrl+D)' }),
    btn('mirror', 'Espelhar', () => mirrorSel(0), { text: false, title: 'Espelhar em X' }),
    btn('array', 'Padrão', arraySel, { text: false, title: 'Padrão linear (array)' }),
    btn('group', 'Agrupar', groupSel, { text: false, title: 'Agrupar em montagem (Ctrl+G)' }),
    btn('trash', 'Excluir', deleteSel, { text: false, title: 'Excluir (Del)' }),
    h('div', { class: 'grow' }),
    h('div', { class: 'docname', id: 'docname', title: 'Clique para renomear', onclick: () => { const v = prompt('Nome do projeto:', S.doc.name); if (v) { S.doc.name = v; commit(); } } }),
    h('button', { class: 'tb mobile-only', onclick: () => document.body.classList.toggle('show-right'), html: icon('bom') }),
  );
  updateToolbar(); updateTitle();
}

function updateToolbar() {
  document.querySelectorAll('#toolseg .tb').forEach(b => b.classList.toggle('on', b.dataset.k === S.tool));
  const sb = document.querySelector('.tb[data-k="snap"]'); if (sb) sb.classList.toggle('on', S.snap);
  document.querySelectorAll('[data-view-toggle]').forEach(b => b.classList.toggle('on', !!S[b.dataset.viewToggle]));
}
function updateTitle() { const d = $('#docname'); if (d) d.textContent = S.doc.name; document.title = S.doc.name + ' — ZeyForge'; }

/* ============================== UI: VIEWPORT OVERLAY ============================== */
function renderViewBar() {
  const v = $('#viewbar'); v.innerHTML = '';
  const vb = (name, label) => h('button', { onclick: () => vp.view(name) }, label);
  v.append(
    h('div', { class: 'vgroup' }, vb('iso', 'Iso'), vb('front', 'Frente'), vb('top', 'Topo'), vb('right', 'Direita'), vb('back', 'Trás'), vb('bottom', 'Baixo'),
      h('button', { id: 'orthoBtn', title: 'Projeção ortográfica (5)', onclick: e => { const on = vp.camera !== vp.ortho; vp.setOrtho(on); e.currentTarget.classList.toggle('on', on); } }, 'Orto'),
      h('button', { title: 'Enquadrar tudo (F)', onclick: () => vp.fit(S.sel.length ? S.sel.map(id => S.objects.get(id)) : null), html: icon('focus', 16) })),
  );
  const t = $('#viewtools'); t.innerHTML = '';
  const tog = (key, ic, label, fn) => h('button', { 'data-view-toggle': key, title: label, onclick: () => { S[key] = !S[key]; fn(); updateToolbar(); } }, h('span', { html: icon(ic, 16) }), label);
  t.append(
    tog('xray', 'xray', 'Raio-X', refreshMaterialsAll),
    tog('wire', 'wire', 'Wireframe', refreshMaterialsAll),
    h('button', { title: 'Mostrar/ocultar grid', onclick: e => { vp.grid.visible = !vp.grid.visible; e.currentTarget.classList.toggle('on', vp.grid.visible); }, class: 'on' }, h('span', { html: icon('grid', 16) }), 'Grid'),
    h('div', { class: 'vt-block' },
      h('label', {}, h('span', { html: icon('explode', 16) }), 'Explodir'),
      h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: S.explode.f, oninput: e => { S.explode.f = +e.target.value; applyExplode(); refreshSelection(); } }),
      h('select', { onchange: e => { S.explode.mode = e.target.value; S.explode.cache = null; applyExplode(); } },
        [['radial', 'Radial'], ['y', 'Camadas (Y)'], ['x', 'Eixo X'], ['z', 'Eixo Z']].map(([v, l]) => h('option', { value: v, selected: v === S.explode.mode }, l)))),
    h('div', { class: 'vt-block' },
      h('label', {}, h('span', { html: icon('cut', 16) }), 'Corte'),
      h('select', { onchange: e => { S.clip.axis = e.target.value; applyClip(); refreshMaterialsAll(); } }, [['', 'Desligado'], ['x', 'Plano X'], ['y', 'Plano Y'], ['z', 'Plano Z']].map(([v, l]) => h('option', { value: v }, l))),
      h('input', { type: 'range', min: 0, max: 1, step: 0.005, value: S.clip.t, oninput: e => { S.clip.t = +e.target.value; if (S.clip.axis) applyClip(); } }),
      h('button', { title: 'Inverter lado do corte', onclick: () => { S.clip.flip = !S.clip.flip; if (S.clip.axis) applyClip(); } }, '⇄')),
    h('button', { title: 'Limpar medições', onclick: () => vp.clearMeasurements() }, h('span', { html: icon('measure', 16) }), 'Limpar medidas'),
  );
  updateToolbar();
}

/* ============================== UI: PAINEL ESQUERDO ============================== */
function renderLeft() {
  const L = $('#left'); L.innerHTML = '';
  L.append(h('div', { class: 'tabs' },
    h('button', { class: S.leftTab === 'lib' ? 'on' : '', onclick: () => { S.leftTab = 'lib'; renderLeft(); } }, h('span', { html: icon('box', 15) }), 'Biblioteca'),
    h('button', { class: S.leftTab === 'scene' ? 'on' : '', onclick: () => { S.leftTab = 'scene'; renderLeft(); } }, h('span', { html: icon('group', 15) }), 'Cena', h('span', { class: 'count', id: 'nodecount' }, S.doc.nodes.length))));
  const body = h('div', { class: 'panel-body', id: S.leftTab === 'lib' ? 'libbody' : 'outliner' });
  L.append(body);
  if (S.leftTab === 'lib') renderLibrary(body); else renderOutliner();
}

function renderLibrary(body) {
  body.innerHTML = '';
  const search = h('div', { class: 'search' }, h('span', { html: icon('search', 15) }), h('input', { placeholder: 'Buscar componente… (ex: esp32, bateria)', value: S.search, oninput: e => { S.search = e.target.value; fillList(); } }));
  const list = h('div', { class: 'lib-list' });
  body.append(search, list);
  const fillList = () => {
    list.innerHTML = '';
    const q = S.search.trim().toLowerCase();
    if (!q) {
      list.append(h('div', { class: 'cat' }, h('span', { html: icon('template', 14) }), 'Montagens prontas'));
      TEMPLATES.forEach(t => list.append(h('button', { class: 'tpl', onclick: () => { addTemplate(t); document.body.classList.remove('show-left'); } }, h('b', {}, t.name), h('small', {}, t.desc))));
    }
    CATEGORIES.forEach(cat => {
      const items = LIBRARY.filter(c => c.cat === cat && (!q || (c.name + ' ' + c.type + ' ' + cat).toLowerCase().includes(q)));
      if (!items.length) return;
      const collapsed = S.collapsed[cat] && !q;
      list.append(h('button', { class: 'cat clickable', onclick: () => { S.collapsed[cat] = !S.collapsed[cat]; fillList(); } }, h('span', { class: 'chev' + (collapsed ? '' : ' open'), html: icon('chevron', 12) }), cat, h('span', { class: 'count' }, items.length)));
      if (collapsed) return;
      const grid = h('div', { class: 'lib-grid' });
      items.forEach(c => grid.append(h('button', { class: 'item', title: `Adicionar ${c.name}` + (c.cost ? ` · ~${brl(c.cost)}` : ''), onclick: () => { addComponent(c.type); document.body.classList.remove('show-left'); } },
        h('span', { class: 'thumb', html: thumbFor(c) }), h('span', { class: 'nm' }, c.name), c.cost ? h('span', { class: 'cost' }, '~' + brl(c.cost)) : null)));
      list.append(grid);
    });
  };
  fillList();
}

// Miniaturas renderizadas do próprio modelo paramétrico (cache)
const thumbCache = new Map();
let thumbRenderer;
function thumbFor(c) {
  if (thumbCache.has(c.type)) return `<img src="${thumbCache.get(c.type)}" alt="">`;
  queueThumb(c.type);
  return icon('box', 26);
}
const thumbQueue = [];
function queueThumb(type) { if (!thumbQueue.includes(type)) thumbQueue.push(type); if (thumbQueue.length === 1) setTimeout(drainThumbs, 50); }
function drainThumbs() {
  if (!thumbRenderer) {
    thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbRenderer.setSize(96, 96); thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  const scene = new THREE.Scene(); scene.environment = vp.scene.environment;
  const l = new THREE.DirectionalLight('#fff', 2); l.position.set(1, 2, 1.5); scene.add(l);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 10000);
  let n = 0;
  while (thumbQueue.length && n++ < 6) {
    const type = thumbQueue.shift();
    try {
      const o = buildComponent(type, {}); scene.add(o);
      o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.clippingPlanes = null; } });
      const box = new THREE.Box3().setFromObject(o); const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3()).length();
      cam.position.copy(c).add(new THREE.Vector3(1, 0.85, 1.2).normalize().multiplyScalar(s * 1.75)); cam.lookAt(c); cam.near = s / 100; cam.far = s * 10; cam.updateProjectionMatrix();
      thumbRenderer.render(scene, cam);
      thumbCache.set(type, thumbRenderer.domElement.toDataURL());
      scene.remove(o);
      document.querySelectorAll('.lib-grid .item').forEach(btnEl => { if (btnEl.title.startsWith('Adicionar ' + byType[type].name)) btnEl.querySelector('.thumb').innerHTML = `<img src="${thumbCache.get(type)}" alt="">`; });
    } catch (e) { console.warn('thumb', type, e); }
  }
  if (thumbQueue.length) setTimeout(drainThumbs, 30);
}

let dragId = null;
function renderOutliner() {
  const nc = $('#nodecount'); if (nc) nc.textContent = S.doc.nodes.length;
  const body = $('#outliner'); if (!body) return;
  body.innerHTML = '';
  if (!S.doc.nodes.length) { body.append(h('div', { class: 'empty' }, 'Cena vazia. Adicione algo pela Biblioteca.')); return; }
  const tree = h('div', { class: 'tree', ondragover: e => e.preventDefault(), ondrop: e => { e.preventDefault(); if (dragId && e.target === tree) { reparent(dragId, null); commit(true); } } });
  const row = (n, d) => {
    const kids = children(S.doc, n.id);
    const isGroup = n.type === 'group';
    const r = h('div', {
      class: 'row' + (S.sel.includes(n.id) ? ' sel' : '') + (n.visible ? '' : ' hidden') + (S.sel[0] === n.id ? ' primary' : ''),
      style: `padding-left:${8 + d * 14}px`, draggable: 'true',
      ondragstart: () => { dragId = n.id; },
      ondragover: e => { e.preventDefault(); r.classList.add('drop'); },
      ondragleave: () => r.classList.remove('drop'),
      ondrop: e => { e.preventDefault(); e.stopPropagation(); r.classList.remove('drop'); if (dragId && dragId !== n.id) { reparent(dragId, isGroup ? n.id : n.parent); commit(true); } },
      onclick: e => select([n.id], e.shiftKey || e.ctrlKey || e.metaKey),
      ondblclick: () => { const v = prompt('Renomear:', n.name); if (v) { n.name = v; commit(); renderProps(); } },
    },
      kids.length ? h('span', { class: 'chev' + (n.expanded ? ' open' : ''), html: icon('chevron', 11), onclick: e => { e.stopPropagation(); n.expanded = !n.expanded; renderOutliner(); } }) : h('span', { class: 'chev-sp' }),
      h('span', { class: 'ico', html: icon(isGroup ? 'folder' : n.type === 'mesh' ? 'wire' : 'box', 14) }),
      h('span', { class: 'nm' }, n.name),
      h('span', { class: 'act', title: n.locked ? 'Destravar' : 'Travar', html: icon(n.locked ? 'lock' : 'unlock', 13), onclick: e => { e.stopPropagation(); n.locked = !n.locked; commit(); refreshSelection(); } }),
      h('span', { class: 'act', title: n.visible ? 'Ocultar (H)' : 'Mostrar', html: icon(n.visible ? 'eye' : 'eyeoff', 13), onclick: e => { e.stopPropagation(); n.visible = !n.visible; applyTransform(n, S.objects.get(n.id)); commit(); } }),
    );
    tree.append(r);
    if (n.expanded) kids.forEach(k => row(k, d + 1));
  };
  S.doc.nodes.filter(n => !n.parent).forEach(n => row(n, 0));
  body.append(tree);
  body.append(h('div', { class: 'hint' }, 'Arraste itens para dentro de uma montagem · duplo clique renomeia · Shift seleciona vários'));
}

/* ============================== UI: PAINEL DIREITO ============================== */
function renderRight() {
  const R = $('#right'); R.innerHTML = '';
  R.append(h('div', { class: 'tabs' },
    h('button', { class: S.rightTab === 'props' ? 'on' : '', onclick: () => { S.rightTab = 'props'; renderRight(); } }, 'Propriedades'),
    h('button', { class: S.rightTab === 'bom' ? 'on' : '', onclick: () => { S.rightTab = 'bom'; renderRight(); } }, 'Custos / BOM')));
  R.append(h('div', { class: 'panel-body', id: S.rightTab === 'props' ? 'props' : 'bom' }));
  S.rightTab === 'props' ? renderProps() : renderBOM();
}

function field(label, input, unit) { return h('label', { class: 'field' }, h('span', { class: 'fl' }, label), input, unit ? h('span', { class: 'unit' }, unit) : null); }

function numInput(value, step, onInput, onChange, attrs = {}) {
  const i = h('input', { type: 'number', value: fmt(value, 4), step, ...attrs });
  i.addEventListener('input', () => { if (i.value !== '' && !isNaN(+i.value)) onInput(+i.value); });
  i.addEventListener('change', () => onChange && onChange(+i.value));
  i.addEventListener('wheel', e => { if (document.activeElement !== i) return; e.preventDefault(); i.value = fmt(+i.value + (e.deltaY < 0 ? 1 : -1) * (+step || 1), 4); i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); }, { passive: false });
  return i;
}

function syncTransformFields(n) {
  ['pos', 'rot', 'scl'].forEach(k => [0, 1, 2].forEach(i => { const el = document.getElementById(`tf-${k}-${i}`); if (el && document.activeElement !== el) el.value = fmt(n[k][i], 3); }));
}

function renderProps() {
  const P = $('#props'); if (!P) return;
  P.innerHTML = '';
  if (!S.sel.length) {
    P.append(h('div', { class: 'empty big' },
      h('div', { html: icon('select', 34) }),
      h('p', {}, 'Selecione uma peça na cena ou adicione um componente pela Biblioteca.'),
      h('div', { class: 'shortcuts' },
        ...[['Clique', 'Selecionar peça'], ['Clique de novo', 'Selecionar montagem-pai'], ['Shift+clique', 'Seleção múltipla'], ['W / E / R', 'Mover / girar / escalar'], ['M', 'Medir'], ['F', 'Enquadrar'], ['Ctrl+D', 'Duplicar'], ['Ctrl+G', 'Agrupar'], ['H', 'Ocultar'], ['X', 'Raio-X'], ['Ctrl+Z', 'Desfazer'], ['Botão direito', 'Pan da câmera']].map(([k, v]) => h('div', {}, h('kbd', {}, k), h('span', {}, v))))));
    return;
  }
  if (S.sel.length > 1) {
    P.append(h('div', { class: 'section' }, h('h4', {}, `${S.sel.length} itens selecionados`),
      h('p', { class: 'muted' }, 'Booleanas usam o 1º selecionado como base. Use Agrupar para criar uma montagem.'),
      h('div', { class: 'btnrow' }, h('button', { onclick: () => booleanOp('union') }, 'Unir'), h('button', { onclick: () => booleanOp('subtract') }, 'Subtrair'), h('button', { onclick: () => booleanOp('intersect') }, 'Interseção'), h('button', { onclick: groupSel }, 'Agrupar'))));
    selectionDims(P); return;
  }
  const n = get(S.doc, S.sel[0]); if (!n) return;
  const d = byType[n.type];
  const live = () => { applyTransform(n, S.objects.get(n.id)); refreshSelectionBoxes(); updateStatus(); };

  // Cabeçalho
  P.append(h('div', { class: 'section head' },
    h('input', { class: 'name', value: n.name, onchange: e => { n.name = e.target.value; S.objects.get(n.id).name = n.name; commit(); } }),
    h('div', { class: 'muted' }, n.type === 'group' ? `Montagem · ${descendants(S.doc, n.id).length} itens` : n.type === 'mesh' ? 'Malha (importada / booleana)' : `${d.cat} · ${d.name}`)));

  // Transformação
  const tf = h('div', { class: 'section' }, h('h4', {}, 'Transformação'));
  const rowOf = (key, label, step, unit) => h('div', { class: 'xyz' }, h('span', { class: 'fl' }, label),
    ...[0, 1, 2].map(i => h('div', { class: 'ax ax' + 'xyz'[i] }, h('i', {}, 'XYZ'[i]),
      numInput(n[key][i], step, v => { n[key][i] = v; live(); }, () => commit(), { id: `tf-${key}-${i}` }))), h('span', { class: 'unit' }, unit));
  tf.append(rowOf('pos', 'Posição', S.snap ? S.snapMove : 0.1, 'mm'), rowOf('rot', 'Rotação', S.snap ? S.snapRot : 1, '°'), rowOf('scl', 'Escala', 0.05, '×'));
  tf.append(h('div', { class: 'btnrow' },
    h('button', { onclick: () => { n.pos = [0, 0, 0]; n.rot = [0, 0, 0]; n.scl = [1, 1, 1]; live(); syncTransformFields(n); commit(); } }, 'Zerar'),
    h('button', { onclick: () => { const ho = S.objects.get(n.id); const b = new THREE.Box3().setFromObject(ho); n.pos[1] -= b.min.y; live(); syncTransformFields(n); commit(); } }, 'Apoiar no chão'),
    h('button', { onclick: () => vp.fit([S.objects.get(n.id)]) }, 'Enquadrar')));
  P.append(tf);

  // Parâmetros
  if (d && Object.keys(d.params).length) {
    const sec = h('div', { class: 'section' }, h('h4', {}, 'Parâmetros'));
    let t;
    const regen = (commitNow) => { clearTimeout(t); t = setTimeout(() => { rebuildNode(n.id); updateStatus(); if (commitNow) commit(); }, commitNow ? 0 : 60); };
    for (const [k, pd] of Object.entries(d.params)) {
      let input;
      if (pd.t === 'num') input = numInput(n.params[k], pd.step, v => { n.params[k] = Math.min(pd.max, Math.max(pd.min, v)); regen(false); }, () => regen(true), { min: pd.min, max: pd.max });
      else if (pd.t === 'sel') input = h('select', { onchange: e => { n.params[k] = e.target.value; regen(true); } }, pd.options.map(([v, l]) => h('option', { value: v, selected: String(n.params[k]) === String(v) }, l)));
      else if (pd.t === 'bool') input = h('input', { type: 'checkbox', checked: !!n.params[k], onchange: e => { n.params[k] = e.target.checked; regen(true); } });
      sec.append(field(pd.label, input, pd.unit));
    }
    P.append(sec);
  }

  // Material
  if (n.type !== 'group') {
    const ms = h('div', { class: 'section' }, h('h4', {}, 'Material e aparência'));
    const opts = [['', '— Original do componente —'], ...materialOptions().map(o => [o.value, o.label])];
    ms.append(field('Material', h('select', { onchange: e => { n.mat.preset = e.target.value || null; applyMaterials(n, S.objects.get(n.id)); commit(); renderProps(); } }, opts.map(([v, l]) => h('option', { value: v, selected: (n.mat.preset || '') === v }, l)))));
    const col = h('input', { type: 'color', value: n.mat.color || (n.mat.preset ? MATERIALS[n.mat.preset].color : '#888888'), oninput: e => { n.mat.color = e.target.value; applyMaterials(n, S.objects.get(n.id)); }, onchange: () => commit() });
    ms.append(field('Cor', h('div', { class: 'inline' }, col, h('button', { class: 'mini', onclick: () => { n.mat.color = null; applyMaterials(n, S.objects.get(n.id)); commit(); renderProps(); } }, 'Padrão'))));
    ms.append(field('Opacidade', h('input', { type: 'range', min: 0.05, max: 1, step: 0.01, value: n.mat.opacity ?? 1, oninput: e => { n.mat.opacity = +e.target.value; applyMaterials(n, S.objects.get(n.id)); }, onchange: () => commit() })));
    const quick = { vidro: 'Vidro', policarbonato: 'Policarbonato', acrilico: 'Acrílico', titanio: 'Titânio', aluminio: 'Alumínio', aluminio_preto: 'Alu. preto', fibra_carbono: 'Carbono', pcb_preto: 'PCB', abs_preto: 'ABS', pla_cinza: 'PLA' };
    ms.append(h('div', { class: 'chips' }, Object.entries(quick).map(([k, label]) =>
      h('button', { class: 'chip', title: MATERIALS[k].label, style: `--c:${MATERIALS[k].color}`, onclick: () => { n.mat.preset = k; n.mat.color = null; applyMaterials(n, S.objects.get(n.id)); commit(); renderProps(); } }, h('i'), label))));
    P.append(ms);
  }

  // Produção / custo
  const pr = h('div', { class: 'section' }, h('h4', {}, 'Produção'));
  if (n.type !== 'group') {
    pr.append(field('Custo unitário', numInput(n.cost || 0, 0.1, v => { n.cost = v; }, () => commit(), { min: 0 }), 'R$'));
    pr.append(field('Quantidade', numInput(n.qty || 1, 1, v => { n.qty = Math.max(1, Math.round(v)); }, () => commit(), { min: 1 }), 'un'));
    pr.append(field('Fornecedor', h('input', { value: n.supplier || '', placeholder: 'AliExpress, Mercado Livre…', onchange: e => { n.supplier = e.target.value; commit(); } })));
  }
  pr.append(field('Notas', h('textarea', { rows: 2, placeholder: 'Observações de engenharia', onchange: e => { n.notes = e.target.value; commit(); } }, n.notes || '')));
  P.append(pr);
  selectionDims(P);
}

function selectionDims(P) {
  const objs = S.sel.map(id => S.objects.get(id)).filter(Boolean);
  if (!objs.length) return;
  const b = vp.bounds(objs); if (b.isEmpty()) return;
  const s = b.getSize(new THREE.Vector3());
  let tris = 0; objs.forEach(o => o.traverse(m => { if (m.isMesh && m.geometry) { const c = m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count; tris += (c / 3) * (m.isInstancedMesh ? m.count : 1); } }));
  P.append(h('div', { class: 'section dims' }, h('h4', {}, 'Dimensões (caixa envolvente)'),
    h('div', { class: 'dimgrid' }, h('div', {}, h('i', {}, 'X'), fmt(s.x) + ' mm'), h('div', {}, h('i', {}, 'Y'), fmt(s.y) + ' mm'), h('div', {}, h('i', {}, 'Z'), fmt(s.z) + ' mm')),
    h('div', { class: 'muted' }, `${Math.round(tris).toLocaleString('pt-BR')} triângulos`)));
}

function renderBOM() {
  const B = $('#bom'); if (!B) return;
  const bom = buildBOM(S.doc, byType);
  const pr = S.doc.pricing = Object.assign({ assembly: 15, packaging: 8, shipping: 0, tax: 6, margin: 35, batch: 1 }, S.doc.pricing || {});
  const base = bom.total + pr.assembly + pr.packaging + pr.shipping;
  const denom = 1 - (pr.tax + pr.margin) / 100;
  const price = denom > 0 ? base / denom : NaN;
  const profit = price - base - price * pr.tax / 100;
  B.innerHTML = '';
  B.append(h('div', { class: 'section' }, h('h4', {}, 'Lista de materiais (BOM)'),
    h('p', { class: 'muted' }, 'Custos são estimativas de varejo; edite em Propriedades → Produção com o preço real do seu fornecedor.'),
    bom.list.length ? h('table', { class: 'bomt' }, h('thead', {}, h('tr', {}, h('th', {}, 'Item'), h('th', {}, 'Qtd'), h('th', {}, 'Subtotal'))),
      h('tbody', {}, bom.list.map(r => h('tr', {}, h('td', {}, h('div', {}, r.name), h('small', {}, r.cat + ' · ' + brl(r.cost))), h('td', {}, r.qty), h('td', {}, brl(r.cost * r.qty)))))) : h('div', { class: 'empty' }, 'Sem componentes ainda.'),
    h('div', { class: 'total' }, h('span', {}, 'Componentes'), h('b', {}, brl(bom.total)))));
  const inp = (k, label, unit) => field(label, numInput(pr[k], 1, v => { pr[k] = v; }, () => { commit(); renderBOM(); }, { min: 0 }), unit);
  B.append(h('div', { class: 'section' }, h('h4', {}, 'Precificação (por unidade)'),
    inp('assembly', 'Montagem / mão de obra', 'R$'), inp('packaging', 'Embalagem', 'R$'), inp('shipping', 'Frete embutido', 'R$'), inp('tax', 'Impostos / taxas', '%'), inp('margin', 'Margem desejada', '%'),
    h('div', { class: 'pricebox' },
      h('div', {}, h('span', {}, 'Custo total'), h('b', {}, brl(base))),
      h('div', { class: 'hl' }, h('span', {}, 'Preço sugerido'), h('b', {}, isFinite(price) ? brl(price) : '—')),
      h('div', {}, h('span', {}, 'Lucro por unidade'), h('b', {}, isFinite(profit) ? brl(profit) : '—'))),
    h('button', { class: 'wide', onclick: () => doExport('bom') }, h('span', { html: icon('bom', 15) }), 'Exportar BOM (CSV / Excel)')));
}

/* ============================== STATUS / TOAST / MODAL ============================== */
function updateStatus() {
  const st = $('#status'); if (!st) return;
  const n = S.sel[0] && get(S.doc, S.sel[0]);
  let dims = '';
  if (S.sel.length) { const b = vp.bounds(S.sel.map(id => S.objects.get(id)).filter(Boolean)); if (!b.isEmpty()) { const s = b.getSize(new THREE.Vector3()); dims = `${fmt(s.x, 1)} × ${fmt(s.y, 1)} × ${fmt(s.z, 1)} mm`; } }
  st.innerHTML = '';
  const parts = [
    h('span', {}, n ? (S.sel.length > 1 ? `${S.sel.length} selecionados` : n.name) : 'Nada selecionado'),
    dims ? h('span', { class: 'dim' }, dims) : null,
    h('span', { class: 'grow' }),
    h('span', {}, `${S.doc.nodes.length} objetos`),
    h('span', {}, `${(vp.renderer.info.render.triangles / 1000).toFixed(1)}k tri`),
    h('span', {}, 'Unidade: mm'),
    h('span', { class: 'brandmini' }, 'ZeyForge v0.1')];
  st.append(...parts.filter(Boolean));
}

let toastT;
function toast(msg, kind = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'show ' + kind;
  clearTimeout(toastT); toastT = setTimeout(() => t.className = '', kind === 'err' ? 4200 : 2200);
}

function modal(title, fields) {
  return new Promise(res => {
    const vals = {};
    const close = v => { m.remove(); res(v); };
    const form = h('form', { onsubmit: e => { e.preventDefault(); fields.forEach(f => vals[f.k] = form.elements[f.k].value); close(vals); } },
      h('h3', {}, title),
      ...fields.map(f => field(f.label, f.type === 'select' ? h('select', { name: f.k }, f.options.map(([v, l]) => h('option', { value: v, selected: v === f.value }, l))) : h('input', { name: f.k, type: f.type, value: f.value, step: 'any' }))),
      h('div', { class: 'btnrow' }, h('button', { type: 'button', onclick: () => close(null) }, 'Cancelar'), h('button', { type: 'submit', class: 'primary' }, 'Aplicar')));
    const m = h('div', { class: 'modal', onclick: e => { if (e.target === m) close(null); } }, form);
    document.body.append(m); form.querySelector('input,select')?.focus();
  });
}

/* ============================== TECLADO ============================== */
window.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
  if (c && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (c && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  else if (c && k === 's') { e.preventDefault(); saveProject(); }
  else if (c && k === 'o') { e.preventDefault(); openProject(); }
  else if (c && k === 'd') { e.preventDefault(); duplicateSel(); }
  else if (c && k === 'g') { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); }
  else if (c && k === 'a') { e.preventDefault(); select(S.doc.nodes.filter(n => !n.parent).map(n => n.id)); }
  else if (c) return;
  else if (k === 'delete' || k === 'backspace') deleteSel();
  else if (k === 'w') setTool('translate');
  else if (k === 'e') setTool('rotate');
  else if (k === 'r') setTool('scale');
  else if (k === 'q') setTool('select');
  else if (k === 'm') setTool('measure');
  else if (k === 'escape') { if (S.tool === 'measure') setTool('translate'); else select([]); }
  else if (k === 'f') vp.fit(S.sel.length ? S.sel.map(id => S.objects.get(id)) : null);
  else if (k === 'h') { S.sel.forEach(id => { const n = get(S.doc, id); n.visible = !n.visible; applyTransform(n, S.objects.get(id)); }); commit(); }
  else if (k === 'x') { S.xray = !S.xray; refreshMaterialsAll(); updateToolbar(); }
  else if (k === '1') vp.view('front'); else if (k === '3') vp.view('right'); else if (k === '7') vp.view('top'); else if (k === '0') vp.view('iso');
  else if (k === '5') $('#orthoBtn')?.click();
});

/* ============================== INICIALIZAÇÃO ============================== */
renderTopbar(); renderViewBar(); renderLeft(); renderRight(); applySnap();

let restored = false;
try {
  const saved = localStorage.getItem('zeyforge.autosave');
  if (saved) { const d = JSON.parse(saved); if (d.nodes?.length) { S.doc = Object.assign(newDoc(), d); restored = true; } }
} catch (e) { /* ignora autosave corrompido */ }
if (!restored) { S.doc = newDoc('Celular transparente'); TEMPLATES[0].build(S.doc); }
S.hist.reset(S.doc);
rebuildAll(false);
vp.fit(null, new THREE.Vector3(1, 0.9, 1.1));
updateTitle(); updateStatus();
setInterval(updateStatus, 1500);
toast(restored ? 'Projeto restaurado do salvamento automático' : 'Bem-vindo ao ZeyForge: explore o celular transparente (Raio-X, Explodir, Corte)');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});

window.ZeyForge = { S, vp, commit, rebuildAll, select, booleanOp, addComponent, addTemplate, doExport }; // acesso pelo console (debug/automação)
