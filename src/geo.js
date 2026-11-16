// Helpers geométricos. Convenção: 1 unidade = 1 mm, eixo Y para cima,
// componentes com origem no centro da base (ficam "apoiados" no grid).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat } from './materials.js';

export const DEG = Math.PI / 180;

export function mesh(geometry, material) {
  const m = new THREE.Mesh(geometry, typeof material === 'string' ? mat(material) : material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Caixa apoiada: (x,z) = centro, y = base
export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function rbox(w, h, d, r, material, x = 0, y = 0, z = 0, seg = 4) {
  const rr = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const m = mesh(new RoundedBoxGeometry(w, h, d, seg, rr), material);
  m.position.set(x, y + h / 2, z);
  return m;
}

export function cyl(r, h, material, x = 0, y = 0, z = 0, seg = 32, rTop = null) {
  const m = mesh(new THREE.CylinderGeometry(rTop ?? r, r, h, seg), material);
  m.position.set(x, y + h / 2, z);
  return m;
}

// Cilindro deitado ao longo de X
export function cylX(r, len, material, x = 0, y = 0, z = 0, seg = 24) {
  const m = mesh(new THREE.CylinderGeometry(r, r, len, seg), material);
  m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

export function roundedRectShape(w, d, r) {
  const s = new THREE.Shape();
  r = Math.max(0, Math.min(r, w / 2, d / 2));
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  if (r) s.quadraticCurveTo(x + w, y, x + w, y + r); else s.lineTo(x + w, y);
  s.lineTo(x + w, y + d - r);
  if (r) s.quadraticCurveTo(x + w, y + d, x + w - r, y + d); else s.lineTo(x + w, y + d);
  s.lineTo(x + r, y + d);
  if (r) s.quadraticCurveTo(x, y + d, x, y + d - r); else s.lineTo(x, y + d);
  s.lineTo(x, y + r);
  if (r) s.quadraticCurveTo(x, y, x + r, y); else s.lineTo(x, y);
  return s;
}

// "Squircle" (continuidade de curvatura estilo Apple) aproximado por superelipse
export function squircleShape(w, d, r, n = 5) {
  const s = new THREE.Shape();
  r = Math.max(0.01, Math.min(r, w / 2, d / 2));
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= 12; i++) {
      const t = a0 + (i / 12) * (Math.PI / 2);
      const c = Math.cos(t), sn = Math.sin(t);
      pts.push(new THREE.Vector2(
        cx + r * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
        cy + r * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n)));
    }
  };
  corner(w / 2 - r, d / 2 - r, 0);
  corner(-w / 2 + r, d / 2 - r, Math.PI / 2);
  corner(-w / 2 + r, -d / 2 + r, Math.PI);
  corner(w / 2 - r, -d / 2 + r, Math.PI * 1.5);
  s.setFromPoints(pts);
  s.closePath();
  return s;
}

export function circlePath(r, x = 0, y = 0, seg = 32) {
  const p = new THREE.Path();
  p.absarc(x, y, r, 0, Math.PI * 2, true);
  return p;
}

// Extruda um Shape (definido no plano XY) para cima (eixo Y), base em y=0.
export function extrudeUp(shape, height, material, bevel = 0, curveSegments = 24) {
  const b = Math.max(0, Math.min(bevel, height / 2 - 0.001));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, height - 2 * b),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: b > 0 ? 3 : 0,
    curveSegments,
  });
  g.translate(0, 0, b);
  g.rotateX(-Math.PI / 2); // Z -> Y ; Y do shape vira -Z
  g.computeVertexNormals();
  return mesh(g, material);
}

export function group(...children) {
  const g = new THREE.Group();
  children.flat().filter(Boolean).forEach(c => g.add(c));
  return g;
}

export function at(obj, x = 0, y = 0, z = 0, ry = 0) {
  obj.position.set(x, y, z);
  if (ry) obj.rotation.y = ry;
  return obj;
}

// Barra de pinos (pitch 2.54 mm) ao longo de X, centrada.
export function headerRow(n, female = false, x = 0, y = 0, z = 0, rows = 1) {
  const g = new THREE.Group();
  const pitch = 2.54;
  const len = n * pitch;
  if (female) {
    g.add(box(len, 8.5, 2.54 * rows, 'abs_preto', 0, 0, 0));
    for (let i = 0; i < n; i++) for (let r = 0; r < rows; r++)
      g.add(box(1, 0.05, 1, 'abs_branco', -len / 2 + pitch / 2 + i * pitch, 8.5, -((rows - 1) * pitch) / 2 + r * pitch));
  } else {
    g.add(box(len, 2.5, 2.54 * rows, 'abs_preto', 0, 0, 0));
    for (let i = 0; i < n; i++) for (let r = 0; r < rows; r++)
      g.add(box(0.64, 8.5, 0.64, 'ouro', -len / 2 + pitch / 2 + i * pitch, -3, -((rows - 1) * pitch) / 2 + r * pitch));
  }
  g.position.set(x, y, z);
  return g;
}

// Chip genérico com pinos laterais (SOIC/QFP) ou sem (QFN/BGA)
export function chip(w, d, h, pinsPerSide = 0, style = 'qfn', x = 0, y = 0, z = 0, label = 'silicio') {
  const g = new THREE.Group();
  g.add(rbox(w, h, d, 0.2, label, 0, 0.05, 0, 2));
  if (pinsPerSide > 0 && style !== 'qfn' && style !== 'bga') {
    const sides = style === 'qfp' ? 4 : 2;
    const pitchW = w / (pinsPerSide + 1), pitchD = d / (pinsPerSide + 1);
    for (let i = 1; i <= pinsPerSide; i++) {
      g.add(box(0.35, 0.2, 1.0, 'estanho', -w / 2 + i * pitchW, 0, d / 2 + 0.45));
      g.add(box(0.35, 0.2, 1.0, 'estanho', -w / 2 + i * pitchW, 0, -d / 2 - 0.45));
      if (sides === 4) {
        g.add(box(1.0, 0.2, 0.35, 'estanho', w / 2 + 0.45, 0, -d / 2 + i * pitchD));
        g.add(box(1.0, 0.2, 0.35, 'estanho', -w / 2 - 0.45, 0, -d / 2 + i * pitchD));
      }
    }
  }
  // marcador do pino 1
  g.add(cyl(Math.min(w, d) * 0.06, 0.02, 'abs_branco', -w / 2 + Math.min(w, d) * 0.15, h + 0.05, -d / 2 + Math.min(w, d) * 0.15, 12));
  g.position.set(x, y, z);
  return g;
}

export function usbC(x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.Group();
  const s = roundedRectShape(8.94, 3.26, 1.5);
  const hole = roundedRectShape(8.3, 2.6, 1.2);
  s.holes.push(hole);
  const shell = extrudeUp(s, 7.35, 'aco_inox', 0, 16);
  shell.rotation.x = Math.PI / 2; // perfil no plano XY, comprimento ao longo de Z
  shell.position.set(0, 1.63, -3.675);
  g.add(shell);
  g.add(box(6.7, 0.7, 6, 'abs_preto', 0, 1.28, 0));
  return at(g, x, y, z, ry);
}

export function microUsb(x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.Group();
  g.add(box(7.5, 2.8, 5.5, 'aco_inox', 0, 0, 0));
  g.add(box(6.2, 1.6, 0.2, 'abs_preto', 0, 0.6, 2.76));
  return at(g, x, y, z, ry);
}

export function smd(w, d, h, material, x, y, z) {
  const g = new THREE.Group();
  g.add(box(w * 0.7, h, d, material, 0, 0, 0));
  g.add(box(w * 0.15, h, d, 'estanho', -w * 0.425, 0, 0));
  g.add(box(w * 0.15, h, d, 'estanho', w * 0.425, 0, 0));
  return at(g, x, y, z);
}

// Placa PCB com cantos arredondados e furos de fixação
export function pcbBoard(w, d, t, r, material, holes = []) {
  const s = roundedRectShape(w, d, r);
  holes.forEach(([hx, hz, hr]) => s.holes.push(circlePath(hr, hx, -hz)));
  return extrudeUp(s, t, material, 0, 20);
}
