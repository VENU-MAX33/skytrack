import { useCallback, useState } from 'react';

const THEME_KEY = 'driver_theme';

function isDarkNow(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function useDarkMode(): { isDark: boolean; toggle: () => void } {
  const [isDark, setIsDark] = useState(isDarkNow);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    setIsDark(next);
  }, []);

  return { isDark, toggle };
}
