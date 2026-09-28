const CACHE_NAME = "utopia-offline-v14";

const FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./player.js",
    "./battle.js",
    "./paths.js",
    "./forestPath.js",
    "./crystalCavePath.js",
    "./ashHillsPath.js",
    "./village.js",
    "./save.js",
    "./game.js",
    "./animation1.html",
    "./animationAsh.html"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            for (const file of FILES) {
                try {
                    const response = await fetch(file, { cache: "reload" });
                    if (response.ok) await cache.put(file, response);
                } catch (error) {
                    console.log("Could not cache:", file);
                }
            }
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET") return;

    event.respondWith(
        fetch(request, { cache: "no-cache" })
            .then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});