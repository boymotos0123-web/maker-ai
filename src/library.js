// Biblioteca de componentes paramétricos.
// Cada componente: { type, name, cat, cost (R$ estimado), defaultMat?, params, build(p) -> THREE.Object3D }
// Medidas reais em mm (datasheets / medições de referência). Custos são ESTIMATIVAS de varejo BR.
import * as THREE from 'three';
import {
  box, rbox, cyl, cylX, mesh, group, at, extrudeUp, roundedRectShape, squircleShape, circlePath,
  headerRow, chip, usbC, microUsb, smd, pcbBoard, DEG,
} from './geo.js';
import { mat } from './materials.js';

const n = (label, value, min = 0, max = 1000, step = 0.1, unit = 'mm') => ({ t: 'num', label, value, min, max, step, unit });
const s = (label, value, options) => ({ t: 'sel', label, value, options });
const b = (label, value) => ({ t: 'bool', label, value });

const PCB_COLORS = [['pcb_verde', 'Verde'], ['pcb_preto', 'Preto'], ['pcb_azul', 'Azul'], ['pcb_roxo', 'Roxo'], ['pcb_arduino', 'Teal']];

// Converte coordenada de placa (origem canto inferior esquerdo, mm) para coordenada local centrada
const P = (w, d) => (bx, by) => [bx - w / 2, d / 2 - by];

export const LIBRARY = [];
const def = (o) => { LIBRARY.push(o); return o; };

/* =========================== PRIMITIVAS =========================== */
def({
  type: 'box', name: 'Caixa', cat: 'Primitivas', cost: 0, defaultMat: 'pla_cinza',
  params: { w: n('Largura (X)', 40), h: n('Altura (Y)', 20), d: n('Profundidade (Z)', 30), r: n('Raio de borda', 0, 0, 200) },
  build: p => p.r > 0 ? rbox(p.w, p.h, p.d, p.r, 'pla_cinza') : box(p.w, p.h, p.d, 'pla_cinza'),
});
def({
  type: 'cylinder', name: 'Cilindro', cat: 'Primitivas', cost: 0, defaultMat: 'pla_cinza',
  params: { r: n('Raio', 10), h: n('Altura', 20), seg: n('Segmentos', 48, 3, 256, 1, '') },
  build: p => cyl(p.r, p.h, 'pla_cinza', 0, 0, 0, Math.round(p.seg)),
});
def({
  type: 'sphere', name: 'Esfera', cat: 'Primitivas', cost: 0, defaultMat: 'pla_cinza',
  params: { r: n('Raio', 10) },
  build: p => { const m = mesh(new THREE.SphereGeometry(p.r, 48, 32), 'pla_cinza'); m.position.y = p.r; return m; },
});
def({
  type: 'tube', name: 'Tubo', cat: 'Primitivas', cost: 0, defaultMat: 'aluminio',
  params: { ro: n('Raio externo', 10), ri: n('Raio interno', 8), h: n('Altura', 30) },
  build: p => { const sh = new THREE.Shape(); sh.absarc(0, 0, p.ro, 0, Math.PI * 2); sh.holes.push(circlePath(Math.min(p.ri, p.ro - 0.05))); return extrudeUp(sh, p.h, 'aluminio', 0, 48); },
});
def({
  type: 'cone', name: 'Cone / tronco', cat: 'Primitivas', cost: 0, defaultMat: 'pla_cinza',
  params: { r1: n('Raio base', 12), r2: n('Raio topo', 0, 0), h: n('Altura', 24) },
  build: p => cyl(p.r1, p.h, 'pla_cinza', 0, 0, 0, 48, p.r2),
});
def({
  type: 'torus', name: 'Toro / anel', cat: 'Primitivas', cost: 0, defaultMat: 'pla_cinza',
  params: { R: n('Raio maior', 15), r: n('Raio do tubo', 3) },
  build: p => { const m = mesh(new THREE.TorusGeometry(p.R, p.r, 24, 64), 'pla_cinza'); m.rotation.x = Math.PI / 2; m.position.y = p.r; return m; },
});
def({
  type: 'profile', name: 'Perfil extrudado', cat: 'Primitivas', cost: 0, defaultMat: 'aluminio',
  params: {
    shape: s('Perfil', 'squircle', [['rrect', 'Retângulo arredondado'], ['squircle', 'Squircle (estilo Apple)'], ['circle', 'Círculo'], ['poly', 'Polígono regular'], ['L', 'Perfil L'], ['slot', 'Oblongo / rasgo']]),
    w: n('Largura', 60), d: n('Profundidade', 30), h: n('Altura de extrusão', 8),
    r: n('Raio de canto', 6, 0), sides: n('Lados (polígono)', 6, 3, 64, 1, ''),
    wall: n('Parede (0 = sólido)', 0, 0), bevel: n('Chanfro', 0, 0, 20),
  },
  build: p => {
    const make = (w, d, r) => {
      switch (p.shape) {
        case 'squircle': return squircleShape(w, d, r);
        case 'circle': { const c = new THREE.Shape(); c.absellipse(0, 0, w / 2, d / 2, 0, Math.PI * 2); return c; }
        case 'poly': { const c = new THREE.Shape(); const k = Math.round(p.sides); for (let i = 0; i <= k; i++) { const a = i / k * Math.PI * 2; const x = Math.cos(a) * w / 2, y = Math.sin(a) * d / 2; i ? c.lineTo(x, y) : c.moveTo(x, y); } return c; }
        case 'L': { const c = new THREE.Shape(); const t = Math.max(1, r || w / 4); c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.lineTo(w / 2, -d / 2 + t); c.lineTo(-w / 2 + t, -d / 2 + t); c.lineTo(-w / 2 + t, d / 2); c.lineTo(-w / 2, d / 2); c.closePath(); return c; }
        case 'slot': return roundedRectShape(w, d, Math.min(w, d) / 2);
        default: return roundedRectShape(w, d, r);
      }
    };
    const sh = make(p.w, p.d, p.r);
    if (p.wall > 0 && p.shape !== 'L') {
      const inner = make(Math.max(0.1, p.w - 2 * p.wall), Math.max(0.1, p.d - 2 * p.wall), Math.max(0, p.r - p.wall));
      const hole = new THREE.Path(inner.getPoints(32).reverse());
      sh.holes.push(hole);
    }
    return extrudeUp(sh, p.h, 'aluminio', p.bevel, 32);
  },
});
def({
  type: 'enclosure', name: 'Gabinete (caixa p/ projeto)', cat: 'Primitivas', cost: 25, defaultMat: 'pla_cinza',
  params: {
    w: n('Largura interna', 80), d: n('Profundidade interna', 60), h: n('Altura', 30), wall: n('Parede', 2, 0.8, 10),
    r: n('Raio de canto', 4, 0), lid: b('Tampa', true), standoffs: b('Torres p/ parafuso M3', true),
  },
  build: p => {
    const g = new THREE.Group();
    const W = p.w + 2 * p.wall, D = p.d + 2 * p.wall;
    const outer = roundedRectShape(W, D, p.r + p.wall);
    outer.holes.push(new THREE.Path(roundedRectShape(p.w, p.d, p.r).getPoints(24).reverse()));
    g.add(at(extrudeUp(outer, p.h - p.wall, 'pla_cinza'), 0, p.wall, 0));
    g.add(extrudeUp(roundedRectShape(W, D, p.r + p.wall), p.wall, 'pla_cinza'));
    if (p.standoffs) {
      const ox = p.w / 2 - 4, oz = p.d / 2 - 4;
      [[ox, oz], [-ox, oz], [ox, -oz], [-ox, -oz]].forEach(([x, z]) => {
        const sh = new THREE.Shape(); sh.absarc(0, 0, 3, 0, Math.PI * 2); sh.holes.push(circlePath(1.25));
        g.add(at(extrudeUp(sh, 6, 'pla_cinza', 0, 20), x, p.wall, z));
      });
    }
    if (p.lid) g.add(at(extrudeUp(roundedRectShape(W, D, p.r + p.wall), p.wall, 'pla_cinza'), 0, p.h + 0.4, 0));
    return g;
  },
});

/* =========================== PLACAS =========================== */
def({
  type: 'pcb', name: 'PCB personalizada', cat: 'Placas', cost: 8,
  params: {
    w: n('Largura', 60), d: n('Profundidade', 40), t: n('Espessura', 1.6, 0.4, 3.2, 0.1),
    r: n('Raio de canto', 2, 0), color: s('Máscara de solda', 'pcb_verde', PCB_COLORS),
    holes: b('Furos de fixação', true), holeD: n('Ø furo', 3.2, 1, 6), inset: n('Distância da borda', 3.5, 1, 20),
    layers: s('Camadas', '2', [['1', '1 camada'], ['2', '2 camadas'], ['4', '4 camadas'], ['6', '6 camadas'], ['8', '8 camadas (celular)']]),
  },
  build: p => {
    const hs = p.holes ? [[p.w / 2 - p.inset, p.d / 2 - p.inset], [-p.w / 2 + p.inset, p.d / 2 - p.inset], [p.w / 2 - p.inset, -p.d / 2 + p.inset], [-p.w / 2 + p.inset, -p.d / 2 + p.inset]].map(([x, z]) => [x, z, p.holeD / 2]) : [];
    const g = group(pcbBoard(p.w, p.d, p.t, p.r, p.color, hs));
    hs.forEach(([x, z, r]) => { const ring = new THREE.Shape(); ring.absarc(0, 0, r + 0.8, 0, Math.PI * 2); ring.holes.push(circlePath(r)); g.add(at(extrudeUp(ring, 0.04, 'ouro', 0, 20), x, p.t, z)); });
    return g;
  },
});

def({
  type: 'arduino_uno', name: 'Arduino Uno R3', cat: 'Placas', cost: 45,
  params: { headers: b('Barras fêmea', true) },
  build: p => {
    const W = 68.6, D = 53.3, T = 1.6, c = P(W, D), g = new THREE.Group();
    const holes = [[13.97, 2.54], [15.24, 50.8], [66.04, 7.62], [66.04, 35.56]].map(([x, y]) => [...c(x, y), 1.6]);
    g.add(pcbBoard(W, D, T, 0.8, 'pcb_arduino', holes));
    // USB-B e jack DC (passam da borda esquerda)
    let [x, z] = c(6.35, 38.1); g.add(box(16, 10.9, 12, 'aco_inox', x - 0.6, T, z));
    [x, z] = c(4.5, 7.6); g.add(box(14, 11, 9, 'abs_preto', x - 1.5, T, z));
    // ATmega328P DIP-28
    [x, z] = c(48, 12); g.add(box(35.6, 3.8, 7.6, 'silicio', x, T + 3, z)); g.add(box(36, 0.5, 9.5, 'abs_preto', x, T, z));
    // ATmega16U2 (QFN), cristal, botão reset, regulador
    [x, z] = c(22, 38); g.add(chip(5, 5, 0.9, 0, 'qfn', x, T, z));
    [x, z] = c(28, 31); g.add(rbox(11, 3.5, 4.6, 1.5, 'aco_inox', x, T, z));
    [x, z] = c(6, 50); g.add(box(6, 3.5, 6, 'aco_inox', x, T, z)); g.add(cyl(1.7, 1.5, 'abs_preto', x, T + 3.5, z));
    [x, z] = c(8, 21); g.add(box(6.5, 2.3, 7, 'silicio', x, T, z));
    [x, z] = c(14, 14); g.add(cyl(3.2, 7, 'aluminio', x, T, z)); [x, z] = c(14, 23); g.add(cyl(3.2, 7, 'aluminio', x, T, z));
    // LEDs SMD
    [[25, 44], [25, 41.5], [25, 39], [27, 46]].forEach(([a, bb]) => { [x, z] = c(a, bb); g.add(smd(1.6, 0.8, 0.5, bb > 44 ? 'led_verde' : 'led_vermelho', x, T, z)); });
    if (p.headers) {
      [x, z] = c(29.72, 50.8); g.add(headerRow(10, true, x, T, z));
      [x, z] = c(54.61, 50.8); g.add(headerRow(8, true, x, T, z));
      [x, z] = c(36.83, 2.54); g.add(headerRow(8, true, x, T, z));
      [x, z] = c(57.15, 2.54); g.add(headerRow(6, true, x, T, z));
      [x, z] = c(64.4, 27.9); const icsp = headerRow(3, false, x, T + 2.5, z, 2); icsp.rotation.y = Math.PI / 2; g.add(icsp);
    }
    return g;
  },
});

def({
  type: 'arduino_nano', name: 'Arduino Nano', cat: 'Placas', cost: 30,
  params: { pins: b('Pinos soldados', true) },
  build: p => {
    const W = 43.18, D = 17.78, T = 1.6, g = new THREE.Group();
    g.add(pcbBoard(W, D, T, 0.5, 'pcb_azul', [[-W / 2 + 1.27, -D / 2 + 1.27, 0.9], [W / 2 - 1.27, -D / 2 + 1.27, 0.9], [-W / 2 + 1.27, D / 2 - 1.27, 0.9], [W / 2 - 1.27, D / 2 - 1.27, 0.9]]));
    g.add(box(9, 4, 7.6, 'aco_inox', -W / 2 + 3.5, T, 0)); // mini-USB
    g.add(chip(7, 7, 1.2, 8, 'qfp', 4, T, 0));
    g.add(box(6, 3.5, 3.5, 'aco_inox', W / 2 - 8, T, 0)); // reset
    g.add(smd(1.6, 0.8, 0.5, 'led_verde', -6, T, 5)); g.add(smd(1.6, 0.8, 0.5, 'led_vermelho', -6, T, -5));
    if (p.pins) { g.add(headerRow(15, false, 0, 0 - 2.5, D / 2 - 1.27)); g.add(headerRow(15, false, 0, -2.5, -D / 2 + 1.27)); }
    return g;
  },
});

def({
  type: 'esp32_devkit', name: 'ESP32 DevKit V1 (30 pinos)', cat: 'Placas', cost: 40,
  params: { pins: b('Pinos soldados', true), color: s('Cor da placa', 'pcb_preto', PCB_COLORS) },
  build: p => {
    // DOIT ESP32 DevKit V1: 51.8 x 28.2 mm, furos Ø2.8 mm
    const W = 51.8, D = 28.2, T = 1.6, g = new THREE.Group();
    const hr = 1.4, hx = W / 2 - 0.8 - hr, hz = D / 2 - 0.8 - hr;
    g.add(pcbBoard(W, D, T, 0.6, p.color, [[hx, hz, hr], [-hx, hz, hr], [hx, -hz, hr], [-hx, -hz, hr]]));
    // Módulo ESP32-WROOM-32 (18 x 25.5 x 3.1) com blindagem metálica e antena
    g.add(box(25.5, 0.8, 18, 'pcb_preto', W / 2 - 12.75 + 2, T, 0));
    g.add(box(17.6, 2.3, 15.8, 'aco_inox', W / 2 - 17.6 / 2 - 6.4, T + 0.8, 0));
    g.add(box(5.5, 0.05, 14, 'ouro', W / 2 - 1.5, T + 0.8, 0));
    g.add(microUsb(-W / 2 + 2.2, T, 0, -Math.PI / 2));
    g.add(chip(4, 4, 0.9, 0, 'qfn', -12, T, 0));           // CP2102 / CH340
    g.add(box(6, 3, 3.5, 'aco_inox', -W / 2 + 8, T, 9));  // BOOT
    g.add(box(6, 3, 3.5, 'aco_inox', -W / 2 + 8, T, -9)); // EN
    g.add(box(6.5, 1.6, 3.5, 'silicio', -2, T, 7));       // AMS1117
    g.add(smd(1.6, 0.8, 0.5, 'led_azul', 0, T, -8)); g.add(smd(1.6, 0.8, 0.5, 'led_vermelho', 3, T, -8));
    if (p.pins) { g.add(headerRow(15, false, -0.8, -2.5, D / 2 - 1.3)); g.add(headerRow(15, false, -0.8, -2.5, -D / 2 + 1.3)); }
    return g;
  },
});

def({
  type: 'rpi_pico', name: 'Raspberry Pi Pico', cat: 'Placas', cost: 35,
  params: { pins: b('Pinos soldados', false) },
  build: p => {
    const W = 51, D = 21, T = 1, g = new THREE.Group();
    g.add(pcbBoard(W, D, T, 0.4, 'pcb_verde', [[W / 2 - 2, 5.7, 1.05], [W / 2 - 2, -5.7, 1.05], [-W / 2 + 2, 5.7, 1.05], [-W / 2 + 2, -5.7, 1.05]]));
    for (let i = 0; i < 20; i++) { const x = -W / 2 + 1.61 + i * 2.54; g.add(cyl(0.8, 0.04, 'ouro', x, T, D / 2 - 1.6, 12)); g.add(cyl(0.8, 0.04, 'ouro', x, T, -D / 2 + 1.6, 12)); }
    g.add(microUsb(-W / 2 + 2.5, T, 0, -Math.PI / 2));
    g.add(chip(7, 7, 0.9, 0, 'qfn', 2, T, 0));
    g.add(chip(5.3, 5.3, 1.7, 4, 'soic', 12, T, 0));
    g.add(box(4.5, 2.5, 3.5, 'abs_branco', -12, T, 0));
    g.add(rbox(3.2, 0.8, 2.5, 0.3, 'aco_inox', 18, T, -4));
    if (p.pins) { g.add(headerRow(20, false, 0, -2.5, D / 2 - 1.6)); g.add(headerRow(20, false, 0, -2.5, -D / 2 + 1.6)); }
    return g;
  },
});

def({
  type: 'rpi4', name: 'Raspberry Pi 4 B', cat: 'Placas', cost: 450,
  params: { heatsink: b('Dissipador no SoC', false) },
  build: p => {
    const W = 85, D = 56, T = 1.4, c = P(W, D), g = new THREE.Group();
    const holes = [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]].map(([x, y]) => [...c(x, y), 1.375]);
    g.add(pcbBoard(W, D, T, 3, 'pcb_verde', holes));
    let [x, z] = c(29, 50.5); g.add(headerRow(20, false, x, T + 2.5, z, 2));
    [x, z] = c(25.75, 32.5); g.add(box(15, 2.4, 15, 'aco_inox', x, T, z));
    if (p.heatsink) for (let i = 0; i < 7; i++) g.add(box(14, 8, 1, 'aluminio_preto', x, T + 2.4, z - 6 + i * 2));
    [x, z] = c(46, 32); g.add(chip(15, 10, 1, 0, 'bga', x, T, z));
    [x, z] = c(76.5, 9); g.add(box(21.5, 13.5, 16, 'aco_inox', x + 2, T, z));
    [x, z] = c(78, 27); g.add(box(17, 16, 13.1, 'aco_inox', x + 2, T, z));
    [x, z] = c(78, 45.75); g.add(box(17, 16, 13.1, 'aco_inox', x + 2, T, z));
    [x, z] = c(11.2, 3); g.add(usbC(x, T, z + 1.5, 0));
    [x, z] = c(26, 3); g.add(box(6.5, 3, 7.5, 'aco_inox', x, T, z + 1.2));
    [x, z] = c(39.5, 3); g.add(box(6.5, 3, 7.5, 'aco_inox', x, T, z + 1.2));
    [x, z] = c(53.5, 4); g.add(cyl(3, 6, 'abs_preto', x, T, z));
    return g;
  },
});

def({
  type: 'protoboard', name: 'Protoboard', cat: 'Placas', cost: 12,
  params: { size: s('Tamanho', '400', [['400', '400 pontos (82×55)'], ['830', '830 pontos (165×55)']]) },
  build: p => {
    const big = p.size === '830', W = big ? 165 : 82, D = 55, H = 8.5, g = new THREE.Group();
    g.add(rbox(W, H, D, 0.6, 'abs_branco'));
    const cols = big ? 63 : 30;
    const rowsZ = [];
    for (let r = 0; r < 5; r++) rowsZ.push(-3.5 - r * 2.54 - 1.27 * 0 - 2); // metade de cima
    const zs = [-6.5, -9.04, -11.58, -14.12, -16.66, 6.5, 9.04, 11.58, 14.12, 16.66];
    const rails = [-22.5, -25.04, 22.5, 25.04];
    const count = cols * zs.length + Math.floor(cols * 0.8) * rails.length;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 1), mat('abs_preto'), count);
    const m4 = new THREE.Matrix4(); let k = 0;
    const x0 = -(cols - 1) * 2.54 / 2;
    for (let i = 0; i < cols; i++) zs.forEach(z => { m4.makeTranslation(x0 + i * 2.54, H + 0.01, z); im.setMatrixAt(k++, m4); });
    for (let i = 0; i < cols; i++) { if (i % 6 === 5) continue; rails.forEach(z => { if (k < count) { m4.makeTranslation(x0 + i * 2.54, H + 0.01, z); im.setMatrixAt(k++, m4); } }); }
    im.count = k;
    g.add(im);
    g.add(box(W - 6, 0.05, 0.6, 'abs_vermelho', 0, H, -20.5)); g.add(box(W - 6, 0.05, 0.6, 'abs_azul', 0, H, -27));
    g.add(box(W - 6, 0.05, 0.6, 'abs_vermelho', 0, H, 27)); g.add(box(W - 6, 0.05, 0.6, 'abs_azul', 0, H, 20.5));
    g.add(box(W - 2, 0.3, 2.6, 'abs_branco', 0, H - 0.6, 0));
    return g;
  },
});

/* =========================== ELETRÔNICOS =========================== */
const BAND = { 0: '#111', 1: '#7a4a1e', 2: '#d22', 3: '#f80', 4: '#ee2', 5: '#2a2', 6: '#22d', 7: '#a3c', 8: '#888', 9: '#fff' };
def({
  type: 'resistor', name: 'Resistor (PTH)', cat: 'Eletrônicos', cost: 0.1,
  params: { value: s('Valor', '220', [['100', '100 Ω'], ['220', '220 Ω'], ['330', '330 Ω'], ['1000', '1 kΩ'], ['4700', '4,7 kΩ'], ['10000', '10 kΩ'], ['100000', '100 kΩ']]), pitch: n('Passo dos terminais', 10.16, 5, 30, 0.01) },
  build: p => {
    const g = new THREE.Group(), y = 2.5;
    g.add(cylX(1.2, 6.3, mat('ceramica'), 0, y, 0));
    const v = String(Number(p.value)); const d1 = +v[0], d2 = +(v[1] || 0), mul = v.length - 2;
    [[-1.8, d1], [-0.9, d2], [0, Math.max(0, mul)], [1.9, 'gold']].forEach(([x, dg]) => {
      const m = new THREE.MeshStandardMaterial({ color: dg === 'gold' ? '#c9a227' : BAND[dg], roughness: 0.5 });
      g.add(cylX(1.25, 0.5, m, x, y, 0));
    });
    g.add(cylX(0.25, p.pitch, mat('estanho'), 0, y, 0));
    g.add(cyl(0.25, y + 3, 'estanho', -p.pitch / 2, -3, 0, 8)); g.add(cyl(0.25, y + 3, 'estanho', p.pitch / 2, -3, 0, 8));
    return g;
  },
});
def({
  type: 'led', name: 'LED (PTH)', cat: 'Eletrônicos', cost: 0.2,
  params: { d: s('Diâmetro', '5', [['3', '3 mm'], ['5', '5 mm'], ['10', '10 mm']]), color: s('Cor', 'led_vermelho', [['led_vermelho', 'Vermelho'], ['led_verde', 'Verde'], ['led_azul', 'Azul'], ['led_branco', 'Branco']]), leads: n('Comprimento terminais', 6, 0, 30) },
  build: p => {
    const r = +p.d / 2, H = +p.d * 1.72, g = new THREE.Group();
    g.add(cyl(r + 0.4, 1, p.color));
    g.add(cyl(r, H - r, p.color, 0, 1));
    const dome = mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), p.color); dome.position.y = 1 + H - r; g.add(dome);
    g.add(cyl(0.25, p.leads, 'estanho', -1.27, -p.leads, 0, 8)); g.add(cyl(0.25, p.leads + 1.5, 'estanho', 1.27, -p.leads - 1.5, 0, 8));
    return g;
  },
});
def({
  type: 'cap_elec', name: 'Capacitor eletrolítico', cat: 'Eletrônicos', cost: 0.3,
  params: { d: n('Diâmetro', 6.3, 3, 40), h: n('Altura', 11, 4, 80), sleeve: s('Capa', 'abs_azul', [['abs_azul', 'Azul'], ['abs_preto', 'Preta']]) },
  build: p => group(cyl(p.d / 2, p.h, p.sleeve), cyl(p.d / 2 - 0.3, 0.2, 'aluminio', 0, p.h), box(p.d * 0.15, 0.05, p.d * 0.8, 'abs_branco', -p.d / 2 + p.d * 0.1, p.h - 0.01, 0),
    cyl(0.3, 4, 'estanho', -1.25, -4, 0, 8), cyl(0.3, 4, 'estanho', 1.25, -4, 0, 8)),
});
def({
  type: 'ic', name: 'Circuito integrado (chip)', cat: 'Eletrônicos', cost: 5,
  params: { w: n('Largura', 7), d: n('Profundidade', 7), h: n('Altura', 0.9, 0.2, 10), style: s('Encapsulamento', 'qfp', [['qfn', 'QFN'], ['qfp', 'QFP'], ['soic', 'SOIC'], ['bga', 'BGA']]), pins: n('Pinos por lado', 8, 0, 64, 1, '') },
  build: p => chip(p.w, p.d, p.h, Math.round(p.pins), p.style),
});
def({
  type: 'soc', name: 'SoC de celular (PoP)', cat: 'Eletrônicos', cost: 400,
  params: { w: n('Largura', 13), d: n('Profundidade', 13), h: n('Altura (com RAM PoP)', 1.2, 0.5, 3) },
  build: p => group(box(p.w, 0.25, p.d, 'pcb_verde'), box(p.w - 0.6, p.h * 0.45, p.d - 0.6, 'silicio', 0, 0.25), box(p.w - 1, p.h * 0.3, p.d - 1, 'die', 0, 0.25 + p.h * 0.45)),
});
def({
  type: 'button', name: 'Botão tátil', cat: 'Eletrônicos', cost: 0.3,
  params: { size: s('Tamanho', '6', [['6', '6×6 mm'], ['12', '12×12 mm']]), h: n('Altura do atuador', 1.5, 0.5, 10) },
  build: p => { const S = +p.size; return group(box(S, S * 0.58, S, 'abs_preto'), box(S, 0.2, S, 'aco_inox', 0, S * 0.58), cyl(S * 0.29, p.h, 'abs_preto', 0, S * 0.58 + 0.2)); },
});
def({
  type: 'header', name: 'Barra de pinos', cat: 'Eletrônicos', cost: 1,
  params: { n: n('Pinos', 10, 1, 40, 1, ''), rows: n('Fileiras', 1, 1, 2, 1, ''), female: b('Fêmea', false) },
  build: p => headerRow(Math.round(p.n), p.female, 0, p.female ? 0 : 3, 0, Math.round(p.rows)),
});
def({
  type: 'to92', name: 'Transistor TO-92', cat: 'Eletrônicos', cost: 0.3,
  params: {},
  build: () => { const sh = new THREE.Shape(); sh.absarc(0, 0, 2.4, -0.25 * Math.PI, 1.25 * Math.PI); sh.closePath(); const m = extrudeUp(sh, 4.8, 'silicio', 0, 24); return group(m, [-1.27, 0, 1.27].map(x => cyl(0.22, 6, 'estanho', x, -6, 0, 8))); },
});
def({
  type: 'crystal', name: 'Cristal HC-49', cat: 'Eletrônicos', cost: 0.5,
  params: {}, build: () => group(rbox(11, 3.5, 4.6, 1.8, 'aco_inox'), cyl(0.2, 4, 'estanho', -2.44, -4, 0, 8), cyl(0.2, 4, 'estanho', 2.44, -4, 0, 8)),
});
def({
  type: 'buzzer', name: 'Buzzer 12 mm', cat: 'Eletrônicos', cost: 2,
  params: {}, build: () => group(cyl(6, 9.5, 'abs_preto'), cyl(1, 0.1, 'abs_preto' , 0, 9.5), cyl(0.3, 4, 'estanho', -3.8, -4, 0, 8), cyl(0.3, 4, 'estanho', 3.8, -4, 0, 8)),
});
def({
  type: 'servo_sg90', name: 'Servo SG90', cat: 'Eletrônicos', cost: 15,
  params: { angle: n('Ângulo do braço', 0, -90, 90, 1, '°') },
  build: p => {
    const g = group(box(22.5, 22.7, 12.2, 'abs_azul'), box(32.3, 2.5, 12.2, 'abs_azul', 0, 15.9), cyl(5.9, 4, 'abs_azul', 5.9 - 22.5 / 2 + 0.1, 22.7), cyl(2.4, 3.2, 'abs_branco', -5.35, 26.7));
    const arm = group(cyl(3.5, 1.5, 'abs_branco'), box(16, 1.5, 4, 'abs_branco', 7, 0, 0)); arm.position.set(-5.35, 29.9, 0); arm.rotation.y = p.angle * DEG; g.add(arm);
    return g;
  },
});
def({
  type: 'motor_bl', name: 'Motor brushless (FPV)', cat: 'Eletrônicos', cost: 70,
  params: { size: s('Tamanho', '2207', [['1404', '1404 (3")'], ['2004', '2004 (4")'], ['2207', '2207 (5")'], ['2806', '2806.5 (7")']]) },
  build: p => {
    const st = +p.size.slice(0, 2), sh = +p.size.slice(2, 4), R = st / 2 + 2.2, H = sh + 6.5;
    const g = group(cyl(R, 2, 'aluminio_preto'), cyl(R, H - 3.5, 'aluminio', 0, 2), cyl(R * 0.7, 1.5, 'aluminio_preto', 0, H - 1.5), cyl(2.5, 7, 'aco_inox', 0, H));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(box(R * 0.35, 0.3, 2, 'cobre', Math.cos(a) * R * 0.45, H - 1.6, Math.sin(a) * R * 0.45)); }
    return g;
  },
});
def({
  type: 'propeller', name: 'Hélice', cat: 'Eletrônicos', cost: 5,
  params: { inch: n('Diâmetro (pol)', 5, 2, 10, 0.1, 'in'), blades: n('Pás', 3, 2, 4, 1, ''), color: s('Cor', 'abs_laranja', [['abs_laranja', 'Laranja'], ['abs_vermelho', 'Vermelha'], ['abs_preto', 'Preta'], ['policarbonato', 'Transparente']]) },
  build: p => {
    const R = p.inch * 25.4 / 2, g = group(cyl(5, 6, p.color));
    for (let i = 0; i < Math.round(p.blades); i++) {
      const sh = new THREE.Shape(); sh.moveTo(0, -4); sh.quadraticCurveTo(R * 0.5, -9, R, -2); sh.quadraticCurveTo(R * 0.6, 4, 0, 4); sh.closePath();
      const bl = extrudeUp(sh, 1.2, p.color, 0, 16); const piv = new THREE.Group(); bl.rotation.x = 12 * DEG; bl.position.y = 2.5; piv.add(bl); piv.rotation.y = i / Math.round(p.blades) * Math.PI * 2; g.add(piv);
    }
    return g;
  },
});

/* =========================== CONECTORES =========================== */
def({ type: 'usb_c', name: 'USB-C fêmea', cat: 'Conectores', cost: 1.5, params: {}, build: () => usbC() });
def({ type: 'micro_usb', name: 'Micro-USB fêmea', cat: 'Conectores', cost: 0.8, params: {}, build: () => microUsb() });
def({
  type: 'jack35', name: 'Jack P2 3,5 mm', cat: 'Conectores', cost: 1, params: {},
  build: () => { const g = group(box(6, 5, 12, 'abs_preto', 0, 0, 0)); const t = mesh(new THREE.CylinderGeometry(3, 3, 2.5, 24), 'abs_preto'); t.rotation.x = Math.PI / 2; t.position.set(0, 2.5, 7.2); g.add(t); return g; },
});
def({
  type: 'flex', name: 'Cabo flex (FPC)', cat: 'Conectores', cost: 3,
  params: { w: n('Largura', 8, 1, 60), len: n('Comprimento', 40, 2, 300), t: n('Espessura', 0.15, 0.05, 1, 0.01), conn: b('Conector nas pontas', true) },
  build: p => { const g = group(box(p.w, p.t, p.len, 'flex')); if (p.conn) { g.add(box(p.w + 2, 1, 3, 'abs_preto', 0, 0, p.len / 2 - 1.5)); g.add(box(p.w + 2, 1, 3, 'abs_preto', 0, 0, -p.len / 2 + 1.5)); } return g; },
});
def({
  type: 'jst', name: 'Conector JST-PH', cat: 'Conectores', cost: 0.5,
  params: { pins: n('Vias', 2, 2, 8, 1, '') },
  build: p => box(2 * Math.round(p.pins) + 2, 6, 4.5, 'abs_branco'),
});

/* =========================== ENERGIA =========================== */
def({
  type: 'lipo', name: 'Bateria Li-Po (pouch)', cat: 'Energia', cost: 30,
  params: { w: n('Largura', 60), d: n('Comprimento', 40), h: n('Espessura', 5, 0.5, 40), mah: n('Capacidade', 2000, 50, 20000, 50, 'mAh') },
  build: p => group(rbox(p.w, p.h, p.d, Math.min(1.2, p.h / 2.2), 'bateria'), box(p.w * 0.5, Math.min(p.h, 4), 4, 'abs_preto', 0, (p.h - Math.min(p.h, 4)) / 2, p.d / 2 + 2), box(3, 0.2, 4, 'aluminio', -p.w * 0.12, p.h / 2, p.d / 2 + 5.5), box(3, 0.2, 4, 'cobre', p.w * 0.12, p.h / 2, p.d / 2 + 5.5)),
});
def({
  type: 'cell18650', name: 'Célula 18650', cat: 'Energia', cost: 20,
  params: { lying: b('Deitada', true) },
  build: p => { const g = group(cyl(9, 63, 'abs_azul'), cyl(8.6, 1, 'aco_inox', 0, 63), cyl(3, 1, 'aco_inox', 0, 64), cyl(8.6, 0.5, 'aco_inox', 0, -0.5)); if (p.lying) { const w = new THREE.Group(); g.rotation.z = Math.PI / 2; g.position.set(32, 9, 0); w.add(g); return w; } return g; },
});
def({ type: 'cr2032', name: 'Bateria CR2032', cat: 'Energia', cost: 3, params: {}, build: () => group(cyl(10, 3.2, 'aco_inox', 0, 0, 0, 48), cyl(9, 0.05, 'aco_inox', 0, 3.2, 0, 48)) });
def({
  type: 'qi_coil', name: 'Bobina de carregamento sem fio (Qi)', cat: 'Energia', cost: 15,
  params: { ro: n('Raio externo', 22, 5, 60), ri: n('Raio interno', 9, 1, 50), magsafe: b('Anel de ímãs (estilo MagSafe)', false) },
  build: p => {
    const g = new THREE.Group();
    const f = new THREE.Shape(); f.absarc(0, 0, p.ro + 1, 0, Math.PI * 2); g.add(extrudeUp(f, 0.3, 'ferrite', 0, 64));
    for (let r = p.ri; r < p.ro; r += 0.9) { const t = mesh(new THREE.TorusGeometry(r, 0.3, 6, 96), 'cobre'); t.rotation.x = Math.PI / 2; t.position.y = 0.6; g.add(t); }
    if (p.magsafe) { const ring = new THREE.Shape(); ring.absarc(0, 0, p.ro + 6, 0, Math.PI * 2); ring.holes.push(circlePath(p.ro + 2.5)); g.add(extrudeUp(ring, 0.6, 'aco_inox', 0, 96)); }
    return g;
  },
});

/* =========================== TELAS E CÂMERAS =========================== */
const ASPECTS = [['19.5:9', '19,5:9 (celular)'], ['20:9', '20:9 (celular)'], ['16:9', '16:9'], ['16:10', '16:10 (notebook)'], ['4:3', '4:3 (tablet)'], ['1:1', '1:1']];
export function screenDims(diag, aspect) {
  const [a, c] = aspect.split(':').map(Number);
  const k = diag * 25.4 / Math.hypot(a, c);
  return [a * k, c * k]; // [lado maior, lado menor]
}
def({
  type: 'display', name: 'Tela / display', cat: 'Telas e câmeras', cost: 250,
  params: {
    diag: n('Diagonal', 6.1, 0.5, 32, 0.1, 'pol'), aspect: s('Proporção', '19.5:9', ASPECTS), portrait: b('Retrato (vertical)', true),
    t: n('Espessura do painel', 1.2, 0.3, 8), r: n('Raio de canto', 9, 0, 40), on: b('Ligada', true), cover: b('Vidro de proteção', true),
  },
  build: p => {
    let [L, S] = screenDims(p.diag, p.aspect); const w = p.portrait ? S : L, d = p.portrait ? L : S;
    const g = group(extrudeUp(roundedRectShape(w, d, p.r), p.t, p.on ? 'tela_ligada' : 'tela', 0, 32));
    if (p.cover) g.add(at(extrudeUp(roundedRectShape(w + 0.6, d + 0.6, p.r + 0.3), 0.6, 'vidro', 0.15, 32), 0, p.t, 0));
    return g;
  },
});
def({
  type: 'oled096', name: 'Módulo OLED 0,96" I2C', cat: 'Telas e câmeras', cost: 18,
  params: {},
  build: () => {
    const W = 27.3, D = 27.8, T = 1.2, g = new THREE.Group();
    g.add(pcbBoard(W, D, T, 0.6, 'pcb_azul', [[W / 2 - 2, D / 2 - 2, 1], [-W / 2 + 2, D / 2 - 2, 1], [W / 2 - 2, -D / 2 + 2, 1], [-W / 2 + 2, -D / 2 + 2, 1]]));
    g.add(box(26.7, 1.5, 19.3, 'vidro_fume', 0, T, 1.2)); g.add(box(21.7, 0.05, 10.9, 'tela_ligada', 0, T + 1.5, 0.5));
    g.add(headerRow(4, false, 0, T + 2.5, -D / 2 + 1.5));
    return g;
  },
});
def({
  type: 'lcd1602', name: 'LCD 16x2', cat: 'Telas e câmeras', cost: 15,
  params: {},
  build: () => { const g = new THREE.Group(); g.add(pcbBoard(80, 36, 1.6, 0.5, 'pcb_verde', [[37.5, 15.5, 1.5], [-37.5, 15.5, 1.5], [37.5, -15.5, 1.5], [-37.5, -15.5, 1.5]])); g.add(box(71.2, 7, 24.2, 'abs_preto', 0, 1.6, 0)); g.add(box(64.5, 0.1, 14.5, 'tela_ligada', 0, 8.6, 0)); g.add(headerRow(16, false, -15, 4.1, -16.2)); return g; },
});
def({
  type: 'camera_mod', name: 'Módulo de câmera (celular)', cat: 'Telas e câmeras', cost: 40,
  params: { w: n('Largura', 11, 4, 30), d: n('Profundidade', 11, 4, 30), h: n('Altura', 6, 2, 15), lens: n('Ø da lente', 7, 1, 25), ois: b('OIS (estabilizador)', true) },
  build: p => {
    const g = group(box(p.w, p.h * 0.75, p.d, p.ois ? 'aco_inox' : 'abs_preto'), cyl(p.lens / 2 + 0.6, p.h * 0.25, 'abs_preto', 0, p.h * 0.75), cyl(p.lens / 2, 0.3, 'lente', 0, p.h));
    g.add(box(p.w * 0.6, 0.15, 12, 'flex', 0, 0.2, p.d / 2 + 6)); return g;
  },
});
def({
  type: 'fpv_cam', name: 'Câmera FPV micro (19 mm)', cat: 'Telas e câmeras', cost: 120,
  params: {},
  build: () => { const g = group(rbox(19, 19, 19, 1.5, 'aluminio_preto')); const l = mesh(new THREE.CylinderGeometry(6, 6, 7, 32), 'abs_preto'); l.rotation.x = Math.PI / 2; l.position.set(0, 9.5, 12); g.add(l); const lens = mesh(new THREE.CircleGeometry(4.5, 32), 'lente'); lens.position.set(0, 9.5, 15.6); g.add(lens); return g; },
});

/* =========================== MECÂNICA =========================== */
def({
  type: 'screw', name: 'Parafuso métrico', cat: 'Mecânica', cost: 0.3,
  params: { m: s('Rosca', '3', [['1.6', 'M1.6'], ['2', 'M2'], ['2.5', 'M2.5'], ['3', 'M3'], ['4', 'M4'], ['5', 'M5']]), len: n('Comprimento', 10, 2, 100), head: s('Cabeça', 'allen', [['allen', 'Allen (DIN 912)'], ['panela', 'Panela Phillips'], ['escareado', 'Escareada']]), mat: s('Material', 'aco_inox', [['aco_inox', 'Inox'], ['aluminio_preto', 'Preto'], ['titanio', 'Titânio']]) },
  build: p => {
    const M = +p.m, g = new THREE.Group();
    g.add(cyl(M / 2, p.len, p.mat, 0, -p.len, 0, 16));
    for (let y = -p.len + 0.5; y < -0.5; y += M * 0.5) { const t = mesh(new THREE.TorusGeometry(M / 2, M * 0.06, 4, 16), p.mat); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
    if (p.head === 'allen') { g.add(cyl(M * 0.8, M, p.mat, 0, 0, 0, 24)); g.add(cyl(M * 0.4, 0.05, 'abs_preto', 0, M, 0, 6)); }
    else if (p.head === 'panela') g.add(cyl(M, M * 0.6, p.mat, 0, 0, 0, 24, M * 0.85));
    else g.add(cyl(M / 2, M * 0.5, p.mat, 0, 0, 0, 24, M));
    return g;
  },
});
def({
  type: 'standoff', name: 'Espaçador sextavado', cat: 'Mecânica', cost: 0.5,
  params: { m: s('Rosca', '3', [['2', 'M2'], ['2.5', 'M2.5'], ['3', 'M3']]), len: n('Comprimento', 10, 2, 60), mat: s('Material', 'ouro', [['ouro', 'Latão'], ['aluminio_preto', 'Nylon preto'], ['aluminio', 'Alumínio']]) },
  build: p => cyl(+p.m * 0.95, p.len, p.mat, 0, 0, 0, 6),
});
def({
  type: 'nut', name: 'Porca sextavada', cat: 'Mecânica', cost: 0.1,
  params: { m: s('Rosca', '3', [['2', 'M2'], ['2.5', 'M2.5'], ['3', 'M3'], ['4', 'M4']]) },
  build: p => { const M = +p.m; const sh = new THREE.Shape(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2; const x = Math.cos(a) * M, y = Math.sin(a) * M; i ? sh.lineTo(x, y) : sh.moveTo(x, y); } sh.holes.push(circlePath(M / 2)); return extrudeUp(sh, M * 0.8, 'aco_inox', 0, 16); },
});
def({
  type: 'heatsink', name: 'Dissipador aletado', cat: 'Mecânica', cost: 5,
  params: { w: n('Largura', 20), d: n('Profundidade', 20), h: n('Altura', 10), fins: n('Aletas', 8, 2, 40, 1, ''), base: n('Base', 2, 0.5, 10) },
  build: p => { const g = group(box(p.w, p.base, p.d, 'aluminio_preto')); const k = Math.round(p.fins), ft = Math.max(0.4, p.w / k * 0.35); for (let i = 0; i < k; i++) g.add(box(ft, p.h - p.base, p.d, 'aluminio_preto', -p.w / 2 + ft / 2 + i * (p.w - ft) / (k - 1), p.base, 0)); return g; },
});
def({
  type: 'fan', name: 'Ventoinha / cooler', cat: 'Mecânica', cost: 15,
  params: { size: s('Tamanho', '40', [['25', '25 mm'], ['30', '30 mm'], ['40', '40 mm'], ['60', '60 mm'], ['80', '80 mm'], ['120', '120 mm']]), t: n('Espessura', 10, 3, 38), blower: b('Tipo blower (notebook)', false) },
  build: p => {
    const S = +p.size, g = new THREE.Group();
    const fr = roundedRectShape(S, S, S * 0.08); fr.holes.push(circlePath(S * 0.47, 0, 0, 64));
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, c]) => fr.holes.push(circlePath(S * 0.04, a * S * 0.4, c * S * 0.4)));
    if (!p.blower) g.add(extrudeUp(fr, p.t, 'abs_preto', 0, 48)); else g.add(extrudeUp(roundedRectShape(S, S, S * 0.3), p.t * 0.2, 'abs_preto'));
    g.add(cyl(S * 0.17, p.t * 0.9, 'abs_preto', 0, p.t * 0.05));
    const nb = p.blower ? 30 : 7;
    for (let i = 0; i < nb; i++) { const piv = new THREE.Group(); const bl = box(S * (p.blower ? 0.12 : 0.3), p.t * 0.7, S * 0.03, 'abs_preto', S * (p.blower ? 0.35 : 0.3), p.t * 0.12, 0); bl.rotation.x = p.blower ? 0 : 25 * DEG; piv.add(bl); piv.rotation.y = i / nb * Math.PI * 2; g.add(piv); }
    return g;
  },
});
def({
  type: 'hinge', name: 'Dobradiça de notebook', cat: 'Mecânica', cost: 20,
  params: { len: n('Comprimento', 30, 10, 80), r: n('Raio', 3, 1, 8) },
  build: p => group(cylX(p.r, p.len, mat('aco_inox'), 0, p.r, 0), box(p.len * 0.8, 1.2, 14, 'aco_inox', 0, 0, 8)),
});
def({
  type: 'carbon_plate', name: 'Placa de fibra de carbono', cat: 'Mecânica', cost: 40,
  params: { w: n('Largura', 100), d: n('Profundidade', 40), t: n('Espessura', 3, 0.5, 8), r: n('Raio de canto', 5, 0) },
  build: p => extrudeUp(roundedRectShape(p.w, p.d, p.r), p.t, 'fibra_carbono', Math.min(0.3, p.t / 4), 24),
});

/* =========================== CHASSI / CARCAÇA =========================== */
def({
  type: 'phone_frame', name: 'Moldura de celular (frame)', cat: 'Chassi', cost: 120, defaultMat: 'titanio',
  params: {
    w: n('Largura', 71.5, 40, 120), l: n('Altura', 147.6, 80, 220), t: n('Espessura', 8.25, 4, 15),
    r: n('Raio de canto', 11, 0, 40), wall: n('Espessura da parede', 1.6, 0.6, 5), squircle: b('Cantos squircle', true),
    btn: b('Botões laterais', true), midframe: b('Placa média (midframe)', true), mid: n('Altura da placa média', 1.9, 0, 12),
  },
  build: p => {
    const mk = (w, l, r) => p.squircle ? squircleShape(w, l, r) : roundedRectShape(w, l, r);
    const sh = mk(p.w, p.l, p.r);
    sh.holes.push(new THREE.Path(mk(p.w - 2 * p.wall, p.l - 2 * p.wall, Math.max(0.5, p.r - p.wall)).getPoints(48).reverse()));
    const g = group(extrudeUp(sh, p.t, 'titanio', 0.4, 48));
    if (p.midframe) g.add(box(p.w - 2 * p.wall, 0.6, p.l - 2 * p.wall - p.r, 'aluminio', 0, p.mid, 0)); // placa média
    if (p.btn) {
      g.add(rbox(1.2, 2.5, 18, 0.5, 'titanio', p.w / 2 + 0.4, p.t / 2 - 1.25, -p.l * 0.18));
      g.add(rbox(1.2, 2.5, 10, 0.5, 'titanio', -p.w / 2 - 0.4, p.t / 2 - 1.25, -p.l * 0.25));
      g.add(rbox(1.2, 2.5, 10, 0.5, 'titanio', -p.w / 2 - 0.4, p.t / 2 - 1.25, -p.l * 0.16));
    }
    return g;
  },
});
def({
  type: 'back_panel', name: 'Tampa traseira (vidro/policarbonato)', cat: 'Chassi', cost: 60, defaultMat: 'policarbonato',
  params: { w: n('Largura', 70), l: n('Altura', 146), t: n('Espessura', 0.8, 0.3, 4), r: n('Raio de canto', 10.5, 0, 40), camHole: b('Recorte p/ câmeras', true), cw: n('Recorte largura', 34), cl: n('Recorte altura', 34), cx: n('Recorte posição X', -14, -60, 60), cz: n('Recorte posição Z', -50, -110, 110) },
  build: p => {
    const sh = squircleShape(p.w, p.l, p.r);
    if (p.camHole) sh.holes.push(new THREE.Path(roundedRectShape(p.cw, p.cl, 7).getPoints(24).map(v => new THREE.Vector2(v.x + p.cx, v.y - p.cz)).reverse()));
    return extrudeUp(sh, p.t, 'policarbonato', Math.min(0.2, p.t / 3), 48);
  },
});
def({
  type: 'laptop_base', name: 'Chassi base de notebook', cat: 'Chassi', cost: 250, defaultMat: 'aluminio',
  params: { size: n('Tela (pol)', 14, 10, 18, 0.1, 'pol'), h: n('Espessura', 16, 8, 30), keyboard: b('Teclado e touchpad', true) },
  build: p => {
    const [L] = screenDims(p.size, '16:10'); const W = L + 14, D = W * 0.69;
    const g = group(rbox(W, p.h, D, 4, 'aluminio'));
    if (p.keyboard) {
      g.add(box(W * 0.86, 0.3, D * 0.42, 'abs_preto', 0, p.h - 0.2, -D * 0.12));
      const kw = W * 0.86 / 15;
      const keyGeo = new THREE.BoxGeometry(kw * 0.86, 0.8, kw * 0.86);
      const im = new THREE.InstancedMesh(keyGeo, mat('abs_preto'), 15 * 6); let k = 0; const m4 = new THREE.Matrix4();
      for (let r = 0; r < 6; r++) for (let c = 0; c < 15; c++) { m4.makeTranslation(-W * 0.43 + kw / 2 + c * kw, p.h + 0.3, -D * 0.12 - D * 0.21 + kw / 2 + r * (D * 0.42 / 6)); im.setMatrixAt(k++, m4); }
      g.add(im);
      g.add(rbox(W * 0.38, 0.2, D * 0.3, 2, 'vidro_fosco', 0, p.h - 0.1, D * 0.29));
    }
    return g;
  },
});
def({
  type: 'laptop_lid', name: 'Tampa de notebook com tela', cat: 'Chassi', cost: 600, defaultMat: null,
  params: { size: n('Tela (pol)', 14, 10, 18, 0.1, 'pol'), angle: n('Ângulo de abertura', 110, 0, 180, 1, '°'), t: n('Espessura', 5, 2.5, 12) },
  build: p => {
    const [L, S] = screenDims(p.size, '16:10'); const W = L + 14, H = S + 16;
    const lid = group(rbox(W, p.t, H, 3, 'aluminio'), box(L, 0.2, S, 'tela_ligada', 0, p.t, -1), box(W - 2, 0.1, H - 2, 'vidro', 0, p.t + 0.2, 0));
    lid.position.z = -H / 2; // gira em torno da borda (dobradiça)
    const piv = new THREE.Group(); piv.add(lid); piv.rotation.x = (180 - p.angle) * DEG;
    const w = new THREE.Group(); w.add(piv);
    return w;
  },
});

export const CATEGORIES = [...new Set(LIBRARY.map(c => c.cat))];
export const byType = Object.fromEntries(LIBRARY.map(c => [c.type, c]));

export function defaults(type) {
  const d = byType[type]; const o = {};
  for (const [k, v] of Object.entries(d.params)) o[k] = v.value;
  return o;
}

export function buildComponent(type, params) {
  const d = byType[type];
  if (!d) throw new Error('Componente desconhecido: ' + type);
  const p = { ...defaults(type), ...params };
  return d.build(p);
}
