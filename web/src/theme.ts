/**
 * Appearance: the light/dark/system theme and the visual style, saved per browser.
 * The inline script in index.html applies the saved choice before the first paint, so keep its
 * storage keys, values and defaults in sync with this file. The colours themselves live in styles.css.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import type {IconName} from './a2ui/ui';

export type ThemePref = 'light' | 'dark' | 'system';
export type StyleId = 'indigo' | 'mono' | 'turquesa' | 'tienda';
export interface Appearance {
  theme: ThemePref;
  style: StyleId;
}

export const THEME_OPTIONS: {id: ThemePref; label: string; icon: IconName}[] = [
  {id: 'light', label: 'Claro', icon: 'sun'},
  {id: 'dark', label: 'Oscuro', icon: 'moon'},
  {id: 'system', label: 'Sistema', icon: 'monitor'},
];

interface Swatch {
  bg: string;
  ink: string;
  primary: string;
}
export interface StyleOption {
  id: StyleId;
  name: string;
  description: string;
  font: string;
  /** Preview colours for the picker (the same values as the style's tokens in styles.css). */
  swatch: Record<'light' | 'dark', Swatch>;
  favicon: {bg: string; ink: string};
}

export const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'indigo',
    name: 'Índigo',
    description: 'Tecnológico, con degradados suaves',
    font: "'Inter', sans-serif",
    swatch: {light: {bg: '#ffffff', ink: '#0e1122', primary: '#4f46e5'}, dark: {bg: '#121522', ink: '#eceef8', primary: '#5b5bf0'}},
    favicon: {bg: '#4f46e5', ink: '#ffffff'},
  },
  {
    id: 'mono',
    name: 'Mono',
    description: 'Minimalista, en blanco y negro',
    font: "'Geist', sans-serif",
    swatch: {light: {bg: '#ffffff', ink: '#09090b', primary: '#09090b'}, dark: {bg: '#121214', ink: '#fafafa', primary: '#fafafa'}},
    favicon: {bg: '#09090b', ink: '#ffffff'},
  },
  {
    id: 'turquesa',
    name: 'Turquesa',
    description: 'Los colores de la tienda: turquesa y ámbar',
    font: "'Plus Jakarta Sans', sans-serif",
    swatch: {light: {bg: '#ffffff', ink: '#0b2b29', primary: '#0f5c55'}, dark: {bg: '#0e1d1c', ink: '#e3f1ef', primary: '#2bbfad'}},
    favicon: {bg: '#0b3d3a', ink: '#ffb547'},
  },
  {
    id: 'tienda',
    name: 'Tienda',
    description: 'Tienda en azul con tipografía Montserrat',
    font: "'Montserrat', sans-serif",
    swatch: {light: {bg: '#ffffff', ink: '#000000', primary: '#005aaa'}, dark: {bg: '#14171b', ink: '#f2f4f7', primary: '#1769c9'}},
    favicon: {bg: '#005aaa', ink: '#ffffff'},
  },
];

export const DEFAULT_APPEARANCE: Appearance = {theme: 'system', style: 'indigo'};
const KEYS = {theme: 'eh-theme', style: 'eh-style'} as const;

/** A saved value, or the fallback when storage is blocked or holds something unknown. */
function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadAppearance(): Appearance {
  return {
    theme: readStored(
      KEYS.theme,
      THEME_OPTIONS.map((o) => o.id),
      DEFAULT_APPEARANCE.theme,
    ),
    style: readStored(
      KEYS.style,
      STYLE_OPTIONS.map((o) => o.id),
      DEFAULT_APPEARANCE.style,
    ),
  };
}

function saveAppearance(a: Appearance) {
  try {
    localStorage.setItem(KEYS.theme, a.theme);
    localStorage.setItem(KEYS.style, a.style);
  } catch {
    /* storage blocked (private mode): the choice lasts until the page is reloaded */
  }
}

const darkQuery = () => (typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null);

/** The mode actually shown: "system" follows the operating system. */
export const resolveTheme = (pref: ThemePref): 'light' | 'dark' => (pref === 'system' ? (darkQuery()?.matches ? 'dark' : 'light') : pref);

const faviconOf = ({bg, ink}: {bg: string; ink: string}) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${bg}'/><path d='M9 22V10h10M9 16h8M9 22h10' stroke='${ink}' stroke-width='3' fill='none' stroke-linecap='round'/></svg>`,
  )}`;

/** Sets the attributes styles.css keys on, plus the browser UI colour and the favicon. */
export function applyAppearance(a: Appearance) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(a.theme);
  root.dataset.style = a.style;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  if (bg) meta.content = bg;
  const style = STYLE_OPTIONS.find((o) => o.id === a.style);
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (style && icon) icon.href = faviconOf(style.favicon);
}

/** The current appearance and a setter that saves and applies it; follows the OS and other tabs. */
export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance);
  const current = useRef(appearance);
  current.current = appearance;

  useEffect(() => applyAppearance(appearance), [appearance]);

  // "System": follow the operating system live.
  useEffect(() => {
    const query = darkQuery();
    if (appearance.theme !== 'system' || !query) return;
    const onChange = () => applyAppearance(current.current);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [appearance.theme]);

  // A choice made in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEYS.theme || e.key === KEYS.style) setAppearance(loadAppearance());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((patch: Partial<Appearance>) => {
    const next = {...current.current, ...patch};
    saveAppearance(next);
    setAppearance(next);
  }, []);

  return [appearance, update] as const;
}
