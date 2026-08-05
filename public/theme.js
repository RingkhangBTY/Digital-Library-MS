// Shared theme toggle functionality
(function() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  const saved = localStorage.getItem('dlms-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved === 'dark' || (!saved && prefersDark);

  if (isDark) {
    document.body.classList.add('dark');
    updateThemeIcon(true);
  }

  toggle.addEventListener('click', () => {
    const isDarkMode = document.body.classList.toggle('dark');
    updateThemeIcon(isDarkMode);
    localStorage.setItem('dlms-theme', isDarkMode ? 'dark' : 'light');
  });

  function updateThemeIcon(isDark) {
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
