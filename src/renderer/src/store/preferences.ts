import { create } from 'zustand'

export type UiTheme = 'moss' | 'cobalt' | 'ember'
export type Language = 'zh' | 'en'

interface PreferencesState {
  theme: UiTheme
  canvasLight: boolean
  language: Language
  setTheme: (theme: UiTheme) => void
  setCanvasLight: (value: boolean) => void
  setLanguage: (language: Language) => void
}

const STORAGE_KEY = 'pixelramp.preferences'

function readStored(): Partial<PreferencesState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      theme:
        parsed.theme === 'cobalt' || parsed.theme === 'ember' || parsed.theme === 'moss'
          ? parsed.theme
          : 'moss',
      canvasLight: parsed.canvasLight === true,
      language: parsed.language === 'en' ? 'en' : 'zh'
    }
  } catch {
    return {}
  }
}

function apply(theme: UiTheme, canvasLight: boolean, language: Language = 'zh'): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.canvas = canvasLight ? 'light' : 'dark'
  document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN'
}

const stored = readStored()
apply(stored.theme ?? 'moss', stored.canvasLight ?? false, stored.language ?? 'zh')

export const usePreferences = create<PreferencesState>((set) => ({
  theme: stored.theme ?? 'moss',
  canvasLight: stored.canvasLight ?? false,
  language: stored.language ?? 'zh',
  setTheme: (theme) => {
    set({ theme })
    apply(theme, usePreferences.getState().canvasLight, usePreferences.getState().language)
    persist()
  },
  setCanvasLight: (canvasLight) => {
    set({ canvasLight })
    apply(usePreferences.getState().theme, canvasLight, usePreferences.getState().language)
    persist()
  },
  setLanguage: (language) => {
    set({ language })
    apply(usePreferences.getState().theme, usePreferences.getState().canvasLight, language)
    persist()
  }
}))

function persist(): void {
  if (typeof window === 'undefined') return
  const { theme, canvasLight, language } = usePreferences.getState()
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, canvasLight, language }))
}
