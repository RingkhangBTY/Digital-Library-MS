// Performance safeguard: automatically disable backdrop-filter blur on
// low-end devices, slow connections, or when the user has asked their
// browser/OS to reduce data or motion. Blur is a compositor-heavy effect;
// skipping it on constrained devices avoids jank/lag with no functional
// loss — cards just render with a solid background instead.
(function () {
  try {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isSlowConnection = !!(conn && (conn.saveData || /2g/.test(conn.effectiveType || "")));
    const isLowMemory = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
    const isLowCores = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;
    const prefersReducedData = window.matchMedia && window.matchMedia("(prefers-reduced-data: reduce)").matches;

    if (isSlowConnection || prefersReducedData || (isLowMemory && isLowCores)) {
      document.body.classList.add("no-blur");
    }
  } catch (e) {
    // If any of these APIs are unsupported, just leave blur on — no harm done.
  }
})();

// Shared theme toggle functionality (Defaults to Dark Mode)
(function() {
  const toggle = document.getElementById('themeToggle');
  const saved = localStorage.getItem('dlms-theme');
  // Default to Dark Mode in every circumstance unless user explicitly chose 'light'
  const isDark = saved ? saved === 'dark' : true;

  if (isDark) {
    document.body.classList.add('dark');
    document.documentElement.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
    document.documentElement.classList.remove('dark');
  }

  if (toggle) {
    updateThemeIcon(isDark);

    toggle.addEventListener('click', () => {
      const isDarkMode = document.body.classList.toggle('dark');
      document.documentElement.classList.toggle('dark', isDarkMode);
      updateThemeIcon(isDarkMode);
      localStorage.setItem('dlms-theme', isDarkMode ? 'dark' : 'light');
    });
  }

  function updateThemeIcon(isDark) {
    if (!toggle) return;
    const icon = toggle.querySelector('.theme-icon');
    if (icon) {
      icon.textContent = isDark ? '☀️' : '🌙';
    }
  }
})();

// Toggle with Cmd/Ctrl+Shift+L (desktop)
document.addEventListener('keydown', (e) => {
  try {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      const toggle = document.getElementById('themeToggle');
      if (toggle) toggle.click();
    }
  } catch (err) { /* ignore on server */ }
});
