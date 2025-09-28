const CACHE_NAME = 'little-hero-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './index.css',
  './index.js', 
  './player.js', 
  './enemy.js',
  './npc.js',
  './quest.js',
  './boss.js',
  './items.js',  
  './maps/map.js',    
  './input.js', 
  './ui.js',    
  './game.js',
  './manifest.json',
  './game-config.json',
  './boss-config.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './maps/manifest.json',
  './maps/dungeon_entry_hall.json',
  './maps/dungeon_main_chamber.json',
  './maps/dungeon_treasure_room.json',
  './maps/field_area.json',
  './maps/field_south.json',
  './maps/field_west.json',
  './maps/room1.json',
  './maps/room2.json',
  './maps/room3.json',
  './maps/room4.json',
  './maps/secret_room.json',
  './maps/start_area.json',
  './maps/village_area.json',
  './maps/secret_boss_room.json',
  './maps/arena.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          response => {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});