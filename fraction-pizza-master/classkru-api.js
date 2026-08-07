/* =========================================
   OFFLINE PRIVACY BOUNDARY
   This version deliberately performs no network request and stores no result.
   ========================================= */
(() => {
  'use strict';
  async function submitGameResult() {
    return Object.freeze({ submitted: false, stored: false, reason: 'offline-private-mode' });
  }
  window.ClassKruGameAPI = Object.freeze({ offline: true, submitGameResult });
})();
