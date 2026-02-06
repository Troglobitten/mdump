import { ref, readonly } from 'vue';

const AVAILABLE_THEMES = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
  'focus', // Custom hybrid theme
];

const currentTheme = ref('dark');

export function useTheme() {
  function setTheme(theme: string): void {
    if (!AVAILABLE_THEMES.includes(theme)) {
      console.warn(`Unknown theme: ${theme}, falling back to dark`);
      theme = 'dark';
    }

    currentTheme.value = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const mode = getThemeCategory(theme);
    document.documentElement.setAttribute('data-theme-mode', theme === 'focus' ? 'focus' : mode);
    localStorage.setItem('mdump-theme', theme);
  }

  function initTheme(savedTheme?: string): void {
    const theme =
      savedTheme || localStorage.getItem('mdump-theme') || 'dark';
    setTheme(theme);
  }

  function getThemeCategory(theme: string): 'light' | 'dark' {
    const lightThemes = [
      'light',
      'cupcake',
      'bumblebee',
      'emerald',
      'corporate',
      'retro',
      'valentine',
      'garden',
      'lofi',
      'pastel',
      'fantasy',
      'wireframe',
      'cmyk',
      'autumn',
      'acid',
      'lemonade',
      'winter',
    ];

    return lightThemes.includes(theme) ? 'light' : 'dark';
  }

  return {
    currentTheme: readonly(currentTheme),
    availableThemes: AVAILABLE_THEMES,
    setTheme,
    initTheme,
    getThemeCategory,
  };
}
