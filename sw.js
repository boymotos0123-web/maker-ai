// Service worker: deixa o ZeyForge funcionando offline depois da primeira visita.
const VERSION = 'zeyforge-v0.1.0';
const FILES = [
  './',
  "./css/app.css",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./index.html",
  "./manifest.json",
  "./src/doc.js",
  "./src/geo.js",
  "./src/icons.js",
  "./src/library.js",
  "./src/main.js",
  "./src/materials.js",
  "./src/templates.js",
  "./src/tools.js",
  "./src/viewport.js",
  "./vendor/three-bvh-csg.js",
  "./vendor/three-mesh-bvh.js",
  "./vendor/three/addons/controls/OrbitControls.js",
  "./vendor/three/addons/controls/TransformControls.js",
  "./vendor/three/addons/environments/RoomEnvironment.js",
  "./vendor/three/addons/exporters/GLTFExporter.js",
  "./vendor/three/addons/exporters/OBJExporter.js",
  "./vendor/three/addons/exporters/STLExporter.js",
  "./vendor/three/addons/geometries/RoundedBoxGeometry.js",
  "./vendor/three/addons/loaders/GLTFLoader.js",
  "./vendor/three/addons/loaders/OBJLoader.js",
  "./vendor/three/addons/loaders/STLLoader.js",
  "./vendor/three/addons/renderers/CSS2DRenderer.js",
  "./vendor/three/addons/utils/BufferGeometryUtils.js",
  "./vendor/three/addons/utils/SkeletonUtils.js",
  "./vendor/three/three.core.js",
  "./vendor/three/three.module.js",
];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Rede primeiro (pega atualizações), cache como reserva (offline)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); if (r.ok) caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
