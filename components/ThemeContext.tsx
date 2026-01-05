/**
 * ThemeContext - Theme management with dark/light mode toggle
 * Persists preference to localStorage
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage on initial load
    const saved = localStorage.getItem('nec-theme') as Theme;
    return saved || 'dark';
  });

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('nec-theme', theme);

    // Apply theme class to document root
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(`theme-${theme}`);

    // Also update body background for immediate visual change
    document.body.style.backgroundColor = theme === 'dark' ? '#020617' : '#ffffff';
    document.body.style.color = theme === 'dark' ? '#e2e8f0' : '#111827';
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Theme Toggle Button Component - Industrial Schematic Style
 */
export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300
        ${isDark
          ? 'bg-slate-800/50 border-slate-700 hover:border-amber-500/50'
          : 'bg-white/80 border-gray-200 hover:border-amber-500'
        }
      `}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Toggle track */}
      <div className={`
        relative w-10 h-5 rounded-full transition-colors duration-300
        ${isDark ? 'bg-slate-700' : 'bg-gray-200'}
      `}>
        {/* Toggle knob */}
        <div className={`
          absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300
          ${isDark
            ? 'left-0.5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
            : 'left-5 bg-amber-500 shadow-lg'
          }
        `} />

        {/* Icons */}
        <Moon className={`
          absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity duration-300
          ${isDark ? 'opacity-100 text-amber-400' : 'opacity-30 text-gray-400'}
        `} />
        <Sun className={`
          absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity duration-300
          ${isDark ? 'opacity-30 text-slate-500' : 'opacity-100 text-amber-500'}
        `} />
      </div>

      {/* Label */}
      <span className={`
        text-[10px] font-mono uppercase tracking-wider hidden sm:block
        ${isDark ? 'text-slate-500' : 'text-gray-500'}
      `}>
        {isDark ? 'Dark' : 'Light'}
      </span>
    </button>
  );
};

export default ThemeContext;
