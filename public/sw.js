// Service Worker — Manglar Vivo Atlántico (CRA)
// Patrón offline-first heredado de gestiones-electricas-actas:
// 1. App Shell + GeoJSON ligeros cacheados para abrir en frío en modo avión.
// 2. /api/* y supabase.co SIEMPRE van directo a red (IndexedDB gestiona mutaciones offline).
// 3. Bump obligatorio de VERSION cuando cambien assets críticos o lógica de captura.
const VERSION = "manglar-vivo-v4";

const SHELL_ASSETS = [
  "/",
  "/reportar",
  "/escuelas",
  "/turista",
  "/validar",
  "/cra",
  "/participacion",
  "/manifest.json",
  "/media/logo_cra_blanco.png",
  "/media/sat/z1_img.jpg",
  "/media/sat/z2_img.jpg",
  "/media/sat/z3_img.jpg",
  "/media/sat/z4_img.jpg",
  "/images/pwa-icon-192.png",
  "/images/pwa-icon-512.png",
  "/images/hero-manglar-atlantico.png",
  "/images/escuelas-guardianes.png",
  "/images/turista-qr-sendero.png",
  "/data/geo/cra_sectors.geojson",
  "/data/geo/cra_mangrove_layers.geojson",
  "/data/geo/coastal_priorities_light.geojson",
  "/data/geo/cra_ground_truth_pts.geojson",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) =>
        Promise.allSettled(
          SHELL_ASSETS.map((url) =>
            cache.add(url).catch(() => null)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Datos dinámicos y APIs: nunca cachear en SW (IndexedDB maneja offline)
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("openrouter.ai")
  ) {
    return;
  }

  // Navegación HTML: red primero con timeout corto, fallback a caché offline
  if (req.mode === "navigate") {
    event.respondWith(
      Promise.race([
        fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("network-timeout")), 2800)
        ),
      ]).catch(async () => {
        const exact = await caches.match(req);
        if (exact) return exact;
        const pathMatch = await caches.match(url.pathname);
        if (pathMatch) return pathMatch;
        const fallback = await caches.match("/reportar");
        return fallback || caches.match("/");
      })
    );
    return;
  }

  // Estáticos y GeoJSON: Stale-While-Revalidate para respuesta instantánea en campo
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
