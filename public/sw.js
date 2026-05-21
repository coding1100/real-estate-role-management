/* Minimal placeholder service worker.
 * Prevents /sw.js requests from falling through to dynamic slug routing.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // no-op: network behavior remains unchanged
});
