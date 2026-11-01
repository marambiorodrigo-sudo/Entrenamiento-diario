// Service worker: guarda la app para usarla sin internet y sirve los videos guardados (con saltos por rango).
const SHELL = 'rutinas-app-v2';
const VIDEOS = 'rutinas-videos';
const ARCHIVOS = ['./', 'index.html', 'manifest.webmanifest', 'segmentos.json', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== VIDEOS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function desdeCache(req, guardado) {
  const rango = req.headers.get('range');
  if (!rango) return guardado;
  const blob = await guardado.blob();
  const m = /bytes=(\d+)-(\d*)/.exec(rango);
  const ini = +m[1], fin = m[2] ? Math.min(+m[2], blob.size - 1) : blob.size - 1;
  return new Response(blob.slice(ini, fin + 1), { status: 206, headers: {
    'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes',
    'Content-Range': `bytes ${ini}-${fin}/${blob.size}`, 'Content-Length': String(fin - ini + 1) } });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('.mp4')) {
    // videos: si están guardados se sirven del teléfono; si no, de internet
    e.respondWith(caches.open(VIDEOS).then(c => c.match(url.pathname)).then(g => g ? desdeCache(e.request, g) : fetch(e.request)));
    return;
  }
  // app: primero lo guardado (abre al instante y sin internet) y se actualiza en segundo plano
  e.respondWith(caches.open(SHELL).then(async c => {
    const g = await c.match(e.request, { ignoreSearch: true });
    const red = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r }).catch(() => g);
    return g || red;
  }));
});
