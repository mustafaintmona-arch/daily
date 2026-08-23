const CACHE='daily-v30';
const ASSETS=['./','./index.html','./comps.json','./manifest.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',function(e){
 self.skipWaiting();
 e.waitUntil(caches.open(CACHE).then(function(c){
  return Promise.all(ASSETS.map(function(u){
   return c.add(u).catch(function(){});
  }));
 }));
});
self.addEventListener('activate',function(e){
 e.waitUntil(caches.keys().then(function(ks){
  return Promise.all(ks.map(function(k){if(k!==CACHE)return caches.delete(k);}));
 }).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch',function(e){
 var r=e.request;
 if(r.method!=='GET')return;
 if(new URL(r.url).origin!==self.location.origin)return;
 e.respondWith(
  fetch(r).then(function(res){
   var copy=res.clone();
   caches.open(CACHE).then(function(c){c.put(r,copy).catch(function(){});});
   return res;
  }).catch(function(){
   return caches.match(r).then(function(hit){
    return hit||caches.match('./index.html');
   });
  })
 );
});
self.addEventListener('message',function(e){
 if(e.data==='skipWaiting')self.skipWaiting();
});
