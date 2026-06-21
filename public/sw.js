const CACHE_NAME = "meal-planner-v1";
const APP_SHELL = ["/", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      ),
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedResponse = await caches.match(event.request);

      if (cachedResponse) {
        return cachedResponse;
      }

      if (event.request.mode === "navigate") {
        return caches.match("/offline");
      }

      return new Response("Offline", {
        status: 503,
        statusText: "Offline",
      });
    }),
  );
});