// Versioned app resources only. Original files/saves stay in OPFS/IndexedDB.
const BUILD = 'sgmobile-beta113-aim-zoom-v1-20261114';
const CACHE = 'sgmobile-beta-app-' + BUILD;
const BASE = new URL('./', self.location.href);
const manifestURL = new URL('release.json', BASE).href;
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const validPath = p => typeof p === 'string' && p.split('/').every(x => x && x !== '.' && x !== '..' && !/[\\:\0]/.test(x));
async function checked(response, entry) {
  if (!response.ok) throw Error('App resource unavailable: ' + entry.path);
  const bytes = await response.clone().arrayBuffer();
  if (bytes.byteLength !== entry.bytes || hex(await crypto.subtle.digest('SHA-256', bytes)) !== entry.sha256)
    throw Error('App resource version mismatch: ' + entry.path);
  return response;
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const response = await fetch(manifestURL, {cache:'no-store'});
  if (!response.ok) throw Error('Release manifest unavailable');
  const manifest = await response.clone().json();
  if (manifest.build !== BUILD || !Array.isArray(manifest.files) || !manifest.files.length)
    throw Error('Release manifest does not match this worker');
  const paths = new Set();
  for (const entry of manifest.files) {
    if (!validPath(entry.path) || paths.has(entry.path) || !/^[0-9a-f]{64}$/.test(entry.sha256)
        || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || /^(game|assets|saves|image)\//i.test(entry.path))
      throw Error('Invalid app-resource inventory');
    paths.add(entry.path);
  }
  const cache = await caches.open(CACHE);
  // This build's cache is never used by the previous active worker. An
  // interrupted install leaves the current worker and local game files intact.
  for (const entry of manifest.files) {
    const url = new URL(entry.path, BASE).href;
    await cache.put(url, await checked(await fetch(url, {cache:'no-store'}), entry));
  }
  await cache.put(manifestURL, response);
  // No skipWaiting: activate only after old app windows have closed.
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
async function manifest(cache) { const r = await cache.match(manifestURL); return r ? r.json() : null; }
self.addEventListener('message', event => {
  if (event.data?.type !== 'APP_STATUS') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE), info = await manifest(cache);
    let complete = !!info;
    if (info) for (const entry of info.files) if (!await cache.match(new URL(entry.path, BASE).href)) { complete = false; break; }
    event.source?.postMessage({type:'APP_STATUS', build:BUILD, complete});
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  const relative = url.pathname.slice(BASE.pathname.length);
  // Never act as a remote game/save store or cache user data.
  if (/^(game|assets|saves|image)\//i.test(relative)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = new URL(relative || 'index.html', BASE).href;
    const hit = await cache.match(key);
    if (hit) return hit;
    const info = await manifest(cache), entry = info?.files.find(f => f.path === (relative || 'index.html'));
    if (!entry) return fetch(event.request);
    // Repair an individually evicted resource only if it is this exact build;
    // never combine an old HTML/loader with a newer engine/data payload.
    try {
      const response = await checked(await fetch(key, {cache:'no-store'}), entry);
      await cache.put(key, response.clone()); return response;
    } catch (e) { return new Response('This app version is incomplete. Reconnect and update the app; local game files and saves are preserved.', {status:503}); }
  })());
});
