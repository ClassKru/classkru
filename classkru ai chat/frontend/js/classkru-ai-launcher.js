(function configureClassKruAiLauncher() {
  const launcher = document.getElementById('classkru-ai-launcher');
  if (!launcher) return;

  launcher.addEventListener('click', () => {
    if (typeof window.openClassKruAi === 'function') {
      window.openClassKruAi();
      return;
    }
    if (typeof showToast === 'function') showToast('ClassKru AI กำลังพัฒนา', 'info');
  });
})();
