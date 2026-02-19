import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeResolved = 'light' | 'dark';
type ThemeOption = 'light' | 'dark' | 'system';

const ThemeContext = createContext<{
  theme: ThemeResolved; // resolved effective theme
  themeOption: ThemeOption; // user's choice
  toggleTheme: () => void;
  setThemeOption: (opt: ThemeOption) => void;
}>({
  theme: 'light',
  themeOption: 'light',
  toggleTheme: () => {},
  setThemeOption: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getInitialOption = (): ThemeOption => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {}
    // default to system
    return 'system';
  };

  const [themeOption, setThemeOptionState] = useState<ThemeOption>(getInitialOption);

  // resolve effective theme
  const resolveTheme = (opt: ThemeOption): ThemeResolved => {
    if (opt === 'light' || opt === 'dark') return opt;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  const [theme, setTheme] = React.useState<ThemeResolved>(() => resolveTheme(getInitialOption()));

  useEffect(() => {
    // persist option
    try {
      localStorage.setItem('theme', themeOption);
    } catch {}
    // update resolved theme
    setTheme(resolveTheme(themeOption));

    const root = document.documentElement;
    if (resolveTheme(themeOption) === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // if system option, listen to changes
    let mq: MediaQueryList | null = null;
    const handleChange = () => {
      if (themeOption === 'system') {
        const resolved = resolveTheme('system');
        setTheme(resolved);
        if (resolved === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
      }
    };
    if (themeOption === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      try { mq.addEventListener('change', handleChange); } catch { mq.addListener(handleChange); }
    }
    return () => {
      if (mq) {
        try { mq.removeEventListener('change', handleChange); } catch { mq.removeListener(handleChange); }
      }
    };
  }, [themeOption]);

  const toggleTheme = () => {
    // if currently system, toggle based on resolved theme and set explicit option
    if (themeOption === 'system') {
      const next = theme === 'dark' ? 'light' : 'dark';
      setThemeOptionState(next);
      setTheme(next);
      try { localStorage.setItem('theme', next); } catch {}
    } else {
      const next = themeOption === 'dark' ? 'light' : 'dark';
      setThemeOptionState(next);
      setTheme(next);
      try { localStorage.setItem('theme', next); } catch {}
    }
  };

  const setThemeOption = (opt: ThemeOption) => {
    setThemeOptionState(opt);
  };

  return (
    <ThemeContext.Provider value={{ theme, themeOption, toggleTheme, setThemeOption }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

