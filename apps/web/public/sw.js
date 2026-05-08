const STATIC_CACHE = "piko-protocol-static-v4";
const RUNTIME_CACHE = "piko-protocol-runtime-v4";
const STATIC_ASSETS = [
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/manifest.webmanifest",
];
const IS_LOCALHOST = ["localhost", "127.0.0.1", "::1"].includes(self.location.hostname);

self.addEventListener("install", (event) => {
  if (IS_LOCALHOST) {
    self.skipWaiting();
    return;
  }

  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  if (IS_LOCALHOST) {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => self.registration.unregister())
    );
    return;
  }

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (IS_LOCALHOST) {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate";
  const isNextAsset = requestUrl.pathname.startsWith("/_next/");
  const isStaticAsset =
    requestUrl.pathname.startsWith("/icons/") || requestUrl.pathname === "/manifest.webmanifest";
  const isApiRequest = requestUrl.pathname.startsWith("/api/");
  const isQuestRoute = requestUrl.pathname.startsWith("/quest/");

  if (isNextAsset || isApiRequest) {
    return;
  }

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
          }

          return response;
        })
        .catch(async () => {
          const cachedRoute = await caches.match(event.request);
          return cachedRoute || caches.match("/") || Response.error();
        })
    );
    return;
  }

  if (isStaticAsset || isQuestRoute) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          const copy = response.clone();
          caches.open(isStaticAsset ? STATIC_CACHE : RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, copy);
          });

          return response;
        });
      })
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NEARBY_REWARD") {
    self.registration.showNotification("Nearby incentive available", {
      body:
        event.data.body ||
        "A verified merchant incentive is available nearby. Open the map, review the receipt path, and settle instantly.",
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
    });
  }
});
