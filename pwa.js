// Add <script src="/assets/pwa.js" defer></script> to your pages.
// Optional: add <button id="installBtn" hidden>অ্যাপ ইনস্টল করুন</button> anywhere.
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(console.error));
  }
  let deferred;
  const btn = () => document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferred = e;
    if (btn()) btn().hidden = false;
  });
  document.addEventListener('click', async e => {
    if (e.target.id !== 'installBtn' || !deferred) return;
    deferred.prompt(); await deferred.userChoice; deferred = null; e.target.hidden = true;
  });
  window.addEventListener('appinstalled', () => { if (btn()) btn().hidden = true; });
})();
