/* ======================================================================
   Offline-Nutzung
   Registriert den Service Worker (Datei sw.js liegt im Hauptordner).
   ====================================================================== */

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
