/* MindStark CONNECT — service worker
   Goal: make the app installable and keep the shell available offline.
   This app is realtime/data-driven (Supabase), so we deliberately do NOT
   cache API calls — only the static shell (HTML/manifest/icons). Online,
   the shell itself is always fetched fresh (network-first) so people never
   get stuck on stale app code; offline, the last-cached shell is served. */

const CACHE_NAME='mindstark-shell-v1';
const SHELL_FILES=['./index.html','./manifest.json','./icon-192.png','./icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL_FILES)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);

  // Never intercept Supabase/API/websocket traffic — always go straight to the network.
  if(url.origin!==self.location.origin)return;

  // Navigations & the app shell: network-first, falling back to cache when offline.
  if(req.mode==='navigate'||SHELL_FILES.some(f=>url.pathname.endsWith(f.replace('./','/')))){
    e.respondWith(
      fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(req,copy));
        return res;
      }).catch(()=>caches.match(req).then(cached=>cached||caches.match('./index.html')))
    );
    return;
  }

  // Everything else same-origin (icons etc.): cache-first.
  e.respondWith(
    caches.match(req).then(cached=>cached||fetch(req).then(res=>{
      const copy=res.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put(req,copy));
      return res;
    }))
  );
});
