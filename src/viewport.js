// Viewport 3D: renderer, câmeras, controles, grid, seleção, plano de corte e medição.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { clipPlanes } from './materials.js';

export class Viewport extends EventTarget {
  constructor(el) {
    super();
    this.el = el;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.localClippingEnabled = true;
    el.appendChild(r.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'labels';
    el.appendChild(this.labels.domElement);

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#15181d');
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.9;

    this.sun = new THREE.DirectionalLight('#ffffff', 1.6);
    this.sun.position.set(150, 300, 200);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun, this.sun.target);
    scene.add(new THREE.HemisphereLight('#bcd3ff', '#20252c', 0.35));

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.28 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.renderOrder = -1;
    scene.add(this.ground);

    this.grid = new THREE.Group();
    const g1 = new THREE.GridHelper(1000, 100, '#3a4250', '#262b33');
    const g2 = new THREE.GridHelper(1000, 10, '#55607a', '#55607a');
    g1.material.depthWrite = g2.material.depthWrite = false;
    g2.material.transparent = true; g2.material.opacity = 0.6;
    this.grid.add(g1, g2);
    const axes = new THREE.AxesHelper(30);
    this.grid.add(axes);
    scene.add(this.grid);

    this.model = new THREE.Group(); this.model.name = 'model';
    scene.add(this.model);
    this.helpers = new THREE.Group(); scene.add(this.helpers);

    const aspect = el.clientWidth / Math.max(1, el.clientHeight);
    this.persp = new THREE.PerspectiveCamera(35, aspect, 0.1, 50000);
    this.ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, -50000, 50000);
    this.camera = this.persp;
    this.persp.position.set(180, 160, 220);

    this.orbit = new OrbitControls(this.camera, r.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.12;
    this.orbit.screenSpacePanning = true;
    this.orbit.zoomToCursor = true;
    this.orbit.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };

    this.gizmo = new TransformControls(this.camera, r.domElement);
    this.gizmo.setSize(0.85);
    this.gizmo.addEventListener('dragging-changed', e => {
      this.orbit.enabled = !e.value;
      this.dragging = e.value;
      if (!e.value) this.dispatchEvent(new CustomEvent('transform-end', { detail: this.gizmo.object }));
    });
    this.gizmo.addEventListener('objectChange', () => this.dispatchEvent(new CustomEvent('transform', { detail: this.gizmo.object })));
    scene.add(this.gizmo.getHelper());

    this.selBoxes = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.mode = 'select'; // select | measure
    this.measurements = [];
    this.pendingMeasure = null;

    // plano de corte
    this.clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.clipHelper = new THREE.PlaneHelper(this.clipPlane, 200, 0xff5a36);
    this.clipHelper.visible = false;
    this.helpers.add(this.clipHelper);

    this._bindPointer();
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    const loop = () => { requestAnimationFrame(loop); this.render(); };
    loop();
  }

  resize() {
    const w = this.el.clientWidth, h = Math.max(1, this.el.clientHeight);
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.persp.aspect = w / h; this.persp.updateProjectionMatrix();
    this._updateOrtho();
  }

  _updateOrtho() {
    const w = this.el.clientWidth, h = Math.max(1, this.el.clientHeight);
    const dist = this.persp.position.distanceTo(this.orbit.target);
    const H = Math.tan(this.persp.fov * Math.PI / 360) * dist;
    this.ortho.left = -H * w / h; this.ortho.right = H * w / h; this.ortho.top = H; this.ortho.bottom = -H;
    this.ortho.updateProjectionMatrix();
  }

  setOrtho(on) {
    const target = on ? this.ortho : this.persp;
    if (this.camera === target) return;
    if (on) { this._updateOrtho(); this.ortho.position.copy(this.persp.position); this.ortho.quaternion.copy(this.persp.quaternion); this.ortho.zoom = 1; this.ortho.updateProjectionMatrix(); }
    else { this.persp.position.copy(this.ortho.position); }
    this.camera = target;
    this.orbit.object = target;
    this.gizmo.camera = target;
  }

  render() {
    this.orbit.update();
    if (this.camera === this.persp) this._updateOrtho(); else this.persp.position.copy(this.ortho.position);
    this.selBoxes.forEach(b => b.update());
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  // ------- enquadramento
  bounds(objs) {
    const box = new THREE.Box3();
    (objs || [this.model]).forEach(o => box.expandByObject(o));
    return box;
  }

  fit(objs, dir) {
    const box = this.bounds(objs && objs.length ? objs : null);
    if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(100, 100, 100));
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length() || 100;
    const d = dir ? dir.clone().normalize() : this.camera.position.clone().sub(this.orbit.target).normalize();
    const aspect = this.el.clientWidth / Math.max(1, this.el.clientHeight);
    const dist = size / (2 * Math.tan(this.persp.fov * Math.PI / 360)) * 1.15 / Math.min(1, aspect);
    this.orbit.target.copy(c);
    this.camera.position.copy(c).addScaledVector(d, dist);
    if (this.camera.isOrthographicCamera) this.camera.zoom = 1;
    this.camera.near = this.camera.isPerspectiveCamera ? Math.max(0.05, dist / 2000) : -50000;
    this.camera.updateProjectionMatrix();
    this.updateShadowBounds();
  }

  view(name) {
    const dirs = {
      front: [0, 0, 1], back: [0, 0, -1], top: [0, 1, 0.0001], bottom: [0, -1, 0.0001],
      right: [1, 0, 0], left: [-1, 0, 0], iso: [1, 0.8, 1.1],
    };
    this.fit(null, new THREE.Vector3(...dirs[name]));
  }

  updateShadowBounds() {
    const box = this.bounds();
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const s = Math.max(50, box.getSize(new THREE.Vector3()).length());
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -s; cam.right = cam.top = s; cam.near = 1; cam.far = s * 6;
    cam.updateProjectionMatrix();
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).add(new THREE.Vector3(0.5, 1.2, 0.7).multiplyScalar(s * 2));
    this.ground.position.set(c.x, Math.min(0, box.min.y) - 0.02, c.z);
    this.ground.scale.set(s * 6, s * 6, 1);
    this.clipHelper.size = s * 0.7;
  }

  // ------- seleção visual
  showSelection(objs) {
    this.selBoxes.forEach(b => { this.helpers.remove(b); b.dispose?.(); });
    this.selBoxes = objs.map((o, i) => {
      const b = new THREE.BoxHelper(o, i === 0 ? 0x4da3ff : 0x9fd0ff);
      b.material.depthTest = false; b.material.transparent = true; b.renderOrder = 3;
      this.helpers.add(b); return b;
    });
  }

  attachGizmo(obj) { obj ? this.gizmo.attach(obj) : this.gizmo.detach(); }

  // ------- picking
  _bindPointer() {
    const dom = this.renderer.domElement;
    let down = null;
    dom.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    dom.addEventListener('pointerup', e => {
      if (!down || this.dragging) { down = null; return; }
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 5 || e.button !== 0) return;
      const hit = this.pick(e);
      if (this.mode === 'measure') { if (hit) this._measureClick(hit.point.clone()); return; }
      this.dispatchEvent(new CustomEvent('pick', { detail: { hit, shift: e.shiftKey || e.ctrlKey || e.metaKey } }));
    });
    dom.addEventListener('pointermove', e => {
      const hit = this.mode === 'measure' ? this.pick(e) : null;
      this.dispatchEvent(new CustomEvent('hover', { detail: hit }));
      if (this.mode === 'measure' && this.pendingMeasure && hit) this._updateRubber(hit.point);
    });
    dom.addEventListener('dblclick', e => { const hit = this.pick(e); if (hit) this.fit([hit.object]); });
  }

  pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.model, true).filter(h => {
      if (!h.object.visible) return false;
      let o = h.object; while (o) { if (!o.visible) return false; o = o.parent; }
      if (clipPlanes.length && clipPlanes[0].distanceToPoint(h.point) < 0) return false;
      return true;
    });
    return hits[0] || null;
  }

  // ------- plano de corte
  setClip(axis, t, flip) {
    clipPlanes.length = 0;
    if (!axis) { this.clipHelper.visible = false; this._forceMatUpdate(); return; }
    const box = this.bounds();
    const n = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
    const min = box.min[axis], max = box.max[axis];
    const pos = min + (max - min) * t;
    this.clipPlane.normal.copy(n).multiplyScalar(flip ? 1 : -1);
    this.clipPlane.constant = flip ? -pos : pos;
    clipPlanes.push(this.clipPlane);
    this.clipHelper.visible = true;
    this._forceMatUpdate(true);
  }

  _forceMatUpdate(doubleSide) {
    this.model.traverse(o => {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        m.side = doubleSide ? THREE.DoubleSide : THREE.FrontSide;
        m.needsUpdate = true;
      });
    });
  }

  // ------- medição
  setMode(mode) {
    this.mode = mode;
    this.renderer.domElement.style.cursor = mode === 'measure' ? 'crosshair' : '';
    if (mode !== 'measure') this._cancelPending();
  }

  _marker(p) {
    const r = this.camera.position.distanceTo(p) * 0.004;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc94d, depthTest: false }));
    m.renderOrder = 5; m.position.copy(p); return m;
  }

  _label(text) {
    const div = document.createElement('div');
    div.className = 'measure-label'; div.textContent = text;
    return new CSS2DObject(div);
  }

  _measureClick(p) {
    if (!this.pendingMeasure) {
      const g = new THREE.Group(); g.add(this._marker(p));
      const lineGeo = new THREE.BufferGeometry().setFromPoints([p, p.clone()]);
      const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: 0xffc94d, dashSize: 2, gapSize: 1, depthTest: false }));
      line.renderOrder = 5; g.add(line);
      const lbl = this._label('—'); g.add(lbl);
      this.helpers.add(g);
      this.pendingMeasure = { a: p, g, line, lbl };
    } else {
      const m = this.pendingMeasure; this.pendingMeasure = null;
      m.g.add(this._marker(p));
      this._setLine(m, p);
      this.measurements.push(m.g);
      this.dispatchEvent(new CustomEvent('measured', { detail: { a: m.a, b: p, d: m.a.distanceTo(p) } }));
    }
  }

  _setLine(m, p) {
    m.line.geometry.setFromPoints([m.a, p]);
    m.line.computeLineDistances();
    const d = m.a.distanceTo(p);
    const dx = Math.abs(p.x - m.a.x), dy = Math.abs(p.y - m.a.y), dz = Math.abs(p.z - m.a.z);
    m.lbl.element.innerHTML = `<b>${d.toFixed(2)} mm</b><span>ΔX ${dx.toFixed(2)} · ΔY ${dy.toFixed(2)} · ΔZ ${dz.toFixed(2)}</span>`;
    m.lbl.position.copy(m.a).add(p).multiplyScalar(0.5);
  }

  _updateRubber(p) { this._setLine(this.pendingMeasure, p); }

  _cancelPending() { if (this.pendingMeasure) { this._disposeGroup(this.pendingMeasure.g); this.pendingMeasure = null; } }

  _disposeGroup(g) { g.traverse(o => { if (o.isCSS2DObject) o.element.remove(); }); this.helpers.remove(g); }

  clearMeasurements() { this._cancelPending(); this.measurements.forEach(g => this._disposeGroup(g)); this.measurements = []; }

  screenshot() { this.render(); return this.renderer.domElement.toDataURL('image/png'); }
}
