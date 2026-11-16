// Biblioteca de materiais PBR (unidades: mm). Cada preset vira um MeshPhysicalMaterial.
import * as THREE from 'three';

export const MATERIALS = {
  aluminio:        { label: 'Alumínio escovado',        color: '#c9ccd1', metalness: 1, roughness: 0.32 },
  aluminio_preto:  { label: 'Alumínio anodizado preto', color: '#2a2c30', metalness: 0.9, roughness: 0.4 },
  titanio:         { label: 'Titânio',                  color: '#8d8a85', metalness: 1, roughness: 0.38 },
  aco_inox:        { label: 'Aço inox',                 color: '#b4b8bd', metalness: 1, roughness: 0.22 },
  cobre:           { label: 'Cobre',                    color: '#c47a45', metalness: 1, roughness: 0.3 },
  ouro:            { label: 'Ouro (contatos)',          color: '#e3b54a', metalness: 1, roughness: 0.2 },
  estanho:         { label: 'Solda / estanho',          color: '#d9dcdf', metalness: 1, roughness: 0.35 },
  vidro:           { label: 'Vidro (Gorilla Glass)',    color: '#ffffff', metalness: 0, roughness: 0.03, transmission: 1, ior: 1.5, thickness: 0.8 },
  vidro_fosco:     { label: 'Vidro fosco',              color: '#f4f6f8', metalness: 0, roughness: 0.35, transmission: 0.95, ior: 1.5, thickness: 0.8 },
  vidro_fume:      { label: 'Vidro fumê',               color: '#7d8590', metalness: 0, roughness: 0.05, transmission: 0.85, ior: 1.5, thickness: 0.8 },
  policarbonato:   { label: 'Policarbonato transparente', color: '#f2f8ff', metalness: 0, roughness: 0.08, transmission: 0.97, ior: 1.58, thickness: 1 },
  acrilico:        { label: 'Acrílico',                 color: '#ffffff', metalness: 0, roughness: 0.02, transmission: 0.98, ior: 1.49, thickness: 2 },
  abs_preto:       { label: 'Plástico ABS preto',       color: '#1b1c1f', metalness: 0, roughness: 0.62 },
  abs_branco:      { label: 'Plástico ABS branco',      color: '#e9e9e6', metalness: 0, roughness: 0.55 },
  pla_cinza:       { label: 'PLA (impressão 3D) cinza', color: '#8e9399', metalness: 0, roughness: 0.7 },
  borracha:        { label: 'Borracha / silicone',      color: '#222326', metalness: 0, roughness: 0.9 },
  pcb_verde:       { label: 'PCB FR4 verde',            color: '#0d5f2a', metalness: 0, roughness: 0.45, clearcoat: 0.6 },
  pcb_preto:       { label: 'PCB FR4 preto',            color: '#121417', metalness: 0, roughness: 0.4, clearcoat: 0.6 },
  pcb_azul:        { label: 'PCB azul',                 color: '#0b4f8c', metalness: 0, roughness: 0.45, clearcoat: 0.6 },
  pcb_arduino:     { label: 'PCB Arduino (teal)',       color: '#00878f', metalness: 0, roughness: 0.45, clearcoat: 0.6 },
  pcb_roxo:        { label: 'PCB roxo (OSH)',           color: '#4b2a7a', metalness: 0, roughness: 0.45, clearcoat: 0.6 },
  silicio:         { label: 'Encapsulamento de chip',   color: '#18191b', metalness: 0.1, roughness: 0.35 },
  die:             { label: 'Die de silício',           color: '#3a3f55', metalness: 0.6, roughness: 0.2 },
  tela:            { label: 'Painel de tela (desligado)', color: '#050608', metalness: 0.2, roughness: 0.12, clearcoat: 1 },
  tela_ligada:     { label: 'Painel de tela (ligado)',  color: '#0a1020', metalness: 0, roughness: 0.2, emissive: '#2b5cff', emissiveIntensity: 0.35 },
  bateria:         { label: 'Bateria (pouch)',          color: '#4a505a', metalness: 0.6, roughness: 0.45 },
  ceramica:        { label: 'Cerâmica',                 color: '#d8c7a6', metalness: 0, roughness: 0.6 },
  ferrite:         { label: 'Ferrite (bobina)',         color: '#2b2b2b', metalness: 0.2, roughness: 0.7 },
  flex:            { label: 'Flex (poliimida)',         color: '#c98a1c', metalness: 0.2, roughness: 0.4, transmission: 0.3, thickness: 0.1 },
  lente:           { label: 'Lente de câmera',          color: '#0b0d18', metalness: 0.3, roughness: 0.02, clearcoat: 1 },
  led_vermelho:    { label: 'LED vermelho',             color: '#ff2a2a', metalness: 0, roughness: 0.1, transmission: 0.6, emissive: '#ff0000', emissiveIntensity: 0.4, thickness: 2 },
  led_verde:       { label: 'LED verde',                color: '#2aff6a', metalness: 0, roughness: 0.1, transmission: 0.6, emissive: '#00ff40', emissiveIntensity: 0.4, thickness: 2 },
  led_azul:        { label: 'LED azul',                 color: '#3a7bff', metalness: 0, roughness: 0.1, transmission: 0.6, emissive: '#0050ff', emissiveIntensity: 0.4, thickness: 2 },
  led_branco:      { label: 'LED branco',               color: '#ffffff', metalness: 0, roughness: 0.1, transmission: 0.6, emissive: '#ffffff', emissiveIntensity: 0.3, thickness: 2 },
  madeira:         { label: 'Madeira',                  color: '#8a5a33', metalness: 0, roughness: 0.75 },
  fibra_carbono:   { label: 'Fibra de carbono',         color: '#151618', metalness: 0.3, roughness: 0.3, clearcoat: 1 },
  abs_azul:        { label: 'Plástico azul',            color: '#2f6fd1', metalness: 0, roughness: 0.5 },
  abs_laranja:     { label: 'Plástico laranja',         color: '#ff7a1a', metalness: 0, roughness: 0.5 },
  abs_vermelho:    { label: 'Plástico vermelho',        color: '#d62828', metalness: 0, roughness: 0.5 },
};

const cache = new Map();
export const clipPlanes = []; // array compartilhado por todos os materiais do modelo (plano de corte)

export function makeMaterial(key, opts = {}) {
  const def = MATERIALS[key] || MATERIALS.abs_preto;
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.color || def.color),
    metalness: def.metalness ?? 0,
    roughness: def.roughness ?? 0.5,
    transmission: def.transmission ?? 0,
    ior: def.ior ?? 1.5,
    thickness: def.thickness ?? 0,
    clearcoat: def.clearcoat ?? 0,
    clearcoatRoughness: 0.1,
    emissive: new THREE.Color(def.emissive || '#000000'),
    emissiveIntensity: def.emissiveIntensity ?? 0,
  });
  m.userData.preset = key;
  m.userData.baseTransparent = (def.transmission ?? 0) > 0;
  m.clippingPlanes = clipPlanes;
  m.clipShadows = true;
  if (opts.opacity != null && opts.opacity < 1) {
    m.transparent = true;
    m.opacity = opts.opacity;
    m.depthWrite = false;
  }
  return m;
}

// Material "de fábrica" reaproveitado pelos componentes (clonado na hora de aplicar overrides)
export function mat(key) {
  if (!cache.has(key)) cache.set(key, makeMaterial(key));
  return cache.get(key);
}

export function materialOptions() {
  return Object.entries(MATERIALS).map(([k, v]) => ({ value: k, label: v.label }));
}
