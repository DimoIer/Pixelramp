import { create } from 'zustand'

export type UiTheme = 'moss' | 'cobalt' | 'ember'
export type Language = 'zh' | 'en'

interface PreferencesState {
  theme: UiTheme
  canvasLight: boolean
  language: Language
  floatToolbar: boolean
  floatPalette: boolean
  toolbarOpen: boolean
  toolbarOrientation: 'vertical' | 'horizontal'
  setTheme: (theme: UiTheme) => void
  setCanvasLight: (value: boolean) => void
  setLanguage: (language: Language) => void
  setFloatToolbar: (value: boolean) => void
  setFloatPalette: (value: boolean) => void
  setToolbarOpen: (value: boolean) => void
  setToolbarOrientation: (value: 'vertical' | 'horizontal') => void
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
      language: parsed.language === 'en' ? 'en' : 'zh',
      floatToolbar: parsed.floatToolbar === true,
      floatPalette: parsed.floatPalette === true,
      toolbarOpen: parsed.toolbarOpen !== false,
      toolbarOrientation: parsed.toolbarOrientation === 'horizontal' ? 'horizontal' : 'vertical'
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
  floatToolbar: stored.floatToolbar ?? false,
  floatPalette: stored.floatPalette ?? false,
  toolbarOpen: stored.toolbarOpen ?? true,
  toolbarOrientation: stored.toolbarOrientation ?? 'vertical',
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
  },
  setFloatToolbar: (floatToolbar) => {
    set({ floatToolbar })
    persist()
  },
  setFloatPalette: (floatPalette) => {
    set({ floatPalette })
    persist()
  },
  setToolbarOpen: (toolbarOpen) => {
    set({ toolbarOpen })
    persist()
  },
  setToolbarOrientation: (toolbarOrientation) => {
    set({ toolbarOrientation })
    persist()
  }
}))

function persist(): void {
  if (typeof window === 'undefined') return
  const {
    theme,
    canvasLight,
    language,
    floatToolbar,
    floatPalette,
    toolbarOpen,
    toolbarOrientation
  } = usePreferences.getState()
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      theme,
      canvasLight,
      language,
      floatToolbar,
      floatPalette,
      toolbarOpen,
      toolbarOrientation
    })
  )
}
