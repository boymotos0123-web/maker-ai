// Montagens prontas (templates). Cada uma adiciona nós ao documento e retorna o id do grupo raiz.
import { makeNode } from './doc.js';

function builder(doc) {
  const add = (type, params = {}, extra = {}) => { const n = makeNode(type, params, extra); doc.nodes.push(n); return n.id; };
  const grp = (name, parent = null, pos = [0, 0, 0]) => add('group', {}, { name, parent, pos });
  return { add, grp };
}

export const TEMPLATES = [
  {
    id: 'phone_clear', name: 'Celular transparente (conceito)',
    desc: '6,1" · moldura de titânio · traseira de policarbonato transparente · placa 8 camadas · 3 câmeras · Qi/MagSafe',
    build(doc) {
      const { add, grp } = builder(doc);
      const root = grp('Celular transparente');
      // Tela virada para baixo: traseira transparente fica voltada para a câmera
      add('display', { diag: 6.1, aspect: '19.5:9', t: 1.2, r: 9.5 }, { name: 'Tela OLED 6,1" + vidro', parent: root, pos: [0, 1.8, 0], rot: [180, 0, 0] });
      add('phone_frame', { w: 71.5, l: 147.6, t: 8.25, r: 11, wall: 1.6, mid: 1.9 }, { name: 'Moldura de titânio', parent: root });
      const board = grp('Placa principal (logic board)', root, [8, 2.6, -40]);
      add('pcb', { w: 46, d: 54, t: 0.8, r: 3, color: 'pcb_preto', holes: true, holeD: 1.4, inset: 2.2, layers: '8' }, { name: 'PCB 8 camadas (HDI)', parent: board, cost: 90 });
      add('soc', { w: 13, d: 13, h: 1.2 }, { name: 'SoC + RAM (PoP)', parent: board, pos: [4, 0.8, -4] });
      add('ic', { w: 11.5, d: 13, h: 1, style: 'bga', pins: 0 }, { name: 'Armazenamento UFS', parent: board, pos: [-10, 0.8, -6], cost: 120 });
      add('ic', { w: 8, d: 8, h: 0.8, style: 'bga', pins: 0 }, { name: 'Modem 5G', parent: board, pos: [6, 0.8, 14], cost: 150 });
      add('ic', { w: 5, d: 5, h: 0.7, style: 'qfn', pins: 0 }, { name: 'PMIC (gerenciamento de energia)', parent: board, pos: [-10, 0.8, 12], cost: 25 });
      add('box', { w: 9, h: 2.6, d: 4, r: 0.4 }, { name: 'Motor de vibração (taptic)', parent: board, pos: [-12, 0.8, 22], mat: 'aco_inox', cost: 12 });
      const cams = grp('Câmeras', root, [0, 3.4, 0]);
      add('camera_mod', { w: 11, d: 11, h: 5, lens: 8, ois: true }, { name: 'Câmera principal 50 MP', parent: cams, pos: [-22, 0, -58], cost: 120 });
      add('camera_mod', { w: 11, d: 11, h: 5, lens: 7, ois: false }, { name: 'Câmera ultra-wide', parent: cams, pos: [-22, 0, -42], cost: 60 });
      add('camera_mod', { w: 9, d: 9, h: 5, lens: 6, ois: true }, { name: 'Câmera tele 3x', parent: cams, pos: [-6, 0, -58], cost: 90 });
      add('led', { d: '3', color: 'led_branco', leads: 0 }, { name: 'Flash LED', parent: cams, pos: [-6, 0, -43], cost: 2 });
      add('lipo', { w: 60, d: 68, h: 3.9, mah: 4000 }, { name: 'Bateria 4000 mAh', parent: root, pos: [0, 2.6, 31], rot: [0, 180, 0], cost: 60 });
      add('qi_coil', { ro: 20, ri: 8, magsafe: true }, { name: 'Bobina Qi + ímãs', parent: root, pos: [0, 6.5, 18], cost: 25 });
      add('flex', { w: 10, len: 22, t: 0.12 }, { name: 'Flex da bateria', parent: root, pos: [16, 6.5, -6], cost: 4 });
      add('flex', { w: 8, len: 30, t: 0.12 }, { name: 'Flex da tela', parent: root, pos: [-24, 2.5, -6], cost: 4 });
      add('usb_c', {}, { name: 'Porta USB-C', parent: root, pos: [0, 2.6, 70], cost: 2 });
      add('box', { w: 16, h: 3, d: 7, r: 0.5 }, { name: 'Alto-falante', parent: root, pos: [18, 2.6, 67], mat: 'abs_preto', cost: 8 });
      add('back_panel', { w: 68.2, l: 144.3, t: 0.8, r: 9.4, camHole: true, cw: 34, cl: 34, cx: -14, cz: -50 }, { name: 'Traseira transparente', parent: root, pos: [0, 7.45, 0] });
      return root;
    },
  },
  {
    id: 'arduino_starter', name: 'Arduino + protoboard + LED',
    desc: 'Kit de bancada: Uno R3, protoboard 400 pontos, LED e resistor 220 Ω',
    build(doc) {
      const { add, grp } = builder(doc);
      const root = grp('Kit Arduino');
      add('arduino_uno', {}, { parent: root, pos: [-45, 0, 0] });
      add('protoboard', { size: '400' }, { parent: root, pos: [45, 0, 0] });
      add('led', { d: '5', color: 'led_vermelho', leads: 6 }, { parent: root, pos: [40.6, 8.5, -9] });
      add('resistor', { value: '220', pitch: 7.62 }, { parent: root, pos: [48, 8.5, -16], rot: [0, 90, 0] });
      return root;
    },
  },
  {
    id: 'esp32_box', name: 'ESP32 em gabinete com bateria',
    desc: 'Gabinete impresso em 3D, ESP32 DevKit, célula 18650, USB-C e tampa de acrílico',
    build(doc) {
      const { add, grp } = builder(doc);
      const root = grp('Dispositivo ESP32');
      add('enclosure', { w: 80, d: 50, h: 32, wall: 2, r: 4, lid: false, standoffs: true }, { name: 'Gabinete PLA', parent: root });
      add('esp32_devkit', { pins: true }, { parent: root, pos: [6, 13, 8] });
      add('cell18650', { lying: true }, { parent: root, pos: [0, 2, -14] });
      add('usb_c', {}, { parent: root, pos: [-37, 8, 8], rot: [0, -90, 0] });
      add('box', { w: 84, h: 2, d: 54, r: 4 }, { name: 'Tampa de acrílico', parent: root, pos: [0, 32.4, 0], mat: 'acrilico', cost: 15 });
      return root;
    },
  },
  {
    id: 'fpv5', name: 'Drone FPV 5"',
    desc: 'Frame X de carbono 220 mm, motores 2207, hélices 5", stack 30,5 mm, câmera micro e Li-Po',
    build(doc) {
      const { add, grp } = builder(doc);
      const root = grp('Drone FPV 5"');
      add('carbon_plate', { w: 234, d: 14, t: 5, r: 7 }, { name: 'Braço 1', parent: root, rot: [0, 45, 0] });
      add('carbon_plate', { w: 234, d: 14, t: 5, r: 7 }, { name: 'Braço 2', parent: root, rot: [0, -45, 0] });
      add('carbon_plate', { w: 90, d: 40, t: 2, r: 6 }, { name: 'Placa superior', parent: root, pos: [0, 30, 0], rot: [0, 90, 0] });
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, c], i) => {
        add('motor_bl', { size: '2207' }, { name: `Motor ${i + 1}`, parent: root, pos: [a * 77.8, 5, c * 77.8] });
        add('propeller', { inch: 5.1, blades: 3, color: 'abs_laranja' }, { name: `Hélice ${i + 1}`, parent: root, pos: [a * 77.8, 17, c * 77.8], rot: [0, i * 37, 0] });
        add('standoff', { m: '3', len: 25, mat: 'aluminio' }, { name: `Espaçador ${i + 1}`, parent: root, pos: [a * 15.25, 5, c * 15.25] });
      });
      add('pcb', { w: 36, d: 36, t: 1.6, r: 3, color: 'pcb_preto', holes: true, holeD: 3.2, inset: 2.75 }, { name: 'ESC 4 em 1', parent: root, pos: [0, 9, 0], cost: 280 });
      add('pcb', { w: 36, d: 36, t: 1.6, r: 3, color: 'pcb_azul', holes: true, holeD: 3.2, inset: 2.75 }, { name: 'Controladora de voo (FC)', parent: root, pos: [0, 17, 0], cost: 250 });
      add('ic', { w: 7, d: 7, h: 1, style: 'qfp', pins: 10 }, { name: 'MCU STM32 F7', parent: root, pos: [0, 18.6, 0], cost: 40 });
      add('fpv_cam', {}, { parent: root, pos: [0, 7, 36] });
      add('lipo', { w: 35, d: 75, h: 34, mah: 1300 }, { name: 'Li-Po 6S 1300 mAh', parent: root, pos: [0, 32, 0], cost: 230 });
      return root;
    },
  },
  {
    id: 'laptop14', name: 'Notebook 14"',
    desc: 'Chassi unibody de alumínio, tela 16:10, placa-mãe, bateria e ventoinhas blower',
    build(doc) {
      const { add, grp } = builder(doc);
      const root = grp('Notebook 14"');
      add('laptop_base', { size: 14, h: 16, keyboard: true }, { parent: root });
      add('laptop_lid', { size: 14, angle: 110, t: 5 }, { parent: root, pos: [0, 16, -108.9] });
      const inside = grp('Interno', root, [0, 1.5, 0]);
      add('pcb', { w: 200, d: 80, t: 1.2, r: 4, color: 'pcb_verde', holes: true, inset: 4, layers: '8' }, { name: 'Placa-mãe', parent: inside, pos: [0, 0, -55], cost: 900 });
      add('soc', { w: 30, d: 25, h: 1.6 }, { name: 'Processador', parent: inside, pos: [0, 1.2, -55], cost: 1200 });
      add('heatsink', { w: 60, d: 30, h: 8, fins: 18, base: 1.5 }, { name: 'Dissipador de cobre', parent: inside, pos: [0, 2.8, -55], mat: 'cobre' });
      add('fan', { size: '60', t: 8, blower: true }, { name: 'Ventoinha esquerda', parent: inside, pos: [-75, 1.2, -60] });
      add('fan', { size: '60', t: 8, blower: true }, { name: 'Ventoinha direita', parent: inside, pos: [75, 1.2, -60] });
      add('lipo', { w: 250, d: 80, h: 6, mah: 6000 }, { name: 'Bateria 70 Wh', parent: inside, pos: [0, 0, 55], cost: 450 });
      return root;
    },
  },
];
