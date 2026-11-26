/* ======================================================================
   Ersatz für die Speicher-Schnittstelle (notebookAppApi)
   Wird im Kopf der Seite geladen, bevor die App startet. Fehlt die Host-Schnittstelle,
   wird der Zustand im lokalen Browser-Speicher abgelegt.
   ====================================================================== */

/* Konto: lokaler Zwischenspeicher für den App-Zustand, nur aktiv wenn angemeldet (und nur wenn die Host-API fehlt) */
(function () {
  if (window.notebookAppApi) return;
  var K = 'rs_appstate_cache';
  window.__rsFallbackApi = true;
  window.notebookAppApi = {
    getAppState: async function () {
      try { var s = localStorage.getItem(K); return s ? JSON.parse(s) : null; } catch (e) { return null; }
    },
    setAppState: async function (st) {
      try { localStorage.setItem(K, JSON.stringify(st)); } catch (e) {}
    }
  };
})();
