import { getIconSvg } from './icons';

export type ThemeMode = 'dark' | 'light' | 'auto';

const STORAGE_KEY = 'null-theme';

export class ThemeManager {
  private currentMode: ThemeMode = 'dark';
  private mediaQuery: MediaQueryList;

  constructor() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.currentMode = (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'auto';
    this.mediaQuery.addEventListener('change', () => {
      if (this.currentMode === 'auto') {
        this.applyEffectiveTheme();
      }
    });
  }

  public init(toggleButtonEl?: HTMLElement): void {
    this.applyEffectiveTheme();
    if (toggleButtonEl) {
      this.updateButtonUI(toggleButtonEl);
      toggleButtonEl.addEventListener('click', () => {
        this.cycleTheme();
        this.updateButtonUI(toggleButtonEl);
      });
    }
  }

  public getMode(): ThemeMode {
    return this.currentMode;
  }

  public setMode(mode: ThemeMode): void {
    this.currentMode = mode;
    localStorage.setItem(STORAGE_KEY, mode);
    this.applyEffectiveTheme();
  }

  public cycleTheme(): void {
    const sequence: ThemeMode[] = ['dark', 'light', 'auto'];
    const nextIndex = (sequence.indexOf(this.currentMode) + 1) % sequence.length;
    this.setMode(sequence[nextIndex]);
  }

  public updateButtonUI(btn: HTMLElement): void {
    let iconName = 'moon';
    let label = 'Dark';

    if (this.currentMode === 'light') {
      iconName = 'sun';
      label = 'Light';
    } else if (this.currentMode === 'auto') {
      iconName = 'laptop';
      label = 'Auto';
    }

    btn.innerHTML = `${getIconSvg(iconName, 16)} <span class="theme-label">${label}</span>`;
    btn.setAttribute('title', `Current Theme: ${label} (Click to toggle)`);
  }

  private applyEffectiveTheme(): void {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');

    let effectiveTheme = this.currentMode;
    if (effectiveTheme === 'auto') {
      effectiveTheme = this.mediaQuery.matches ? 'dark' : 'light';
    }

    root.classList.add(effectiveTheme);
  }
}

export const themeManager = new ThemeManager();
