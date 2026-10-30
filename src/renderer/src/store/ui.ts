import { create } from 'zustand'
import type { RecentFile } from '@shared/types'
import { makeId } from '../core/palette'
import * as platform from '../platform'

export type DialogKind =
  | 'new-canvas'
  | 'resize-canvas'
  | 'image-import'
  | 'shortcuts'
  | 'library'
  | 'export-image'
  | 'export-palette'
  | 'about'
  | null

export interface PendingImage {
  path: string
  name: string
  width: number
  height: number
  pixels: Uint32Array
}

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  kind: ToastKind
  message: string
  detail?: string
}

interface UiState {
  dialog: DialogKind
  pendingImage: PendingImage | null
  confirm: ConfirmState | null
  toasts: Toast[]
  busy: string | null
  recentFiles: RecentFile[]
  recentLoaded: boolean
  openDialog: (dialog: DialogKind) => void
  closeDialog: () => void
  setPendingImage: (image: PendingImage | null) => void
  askConfirm: (options: ConfirmOptions) => Promise<boolean>
  resolveConfirm: (value: boolean) => void
  toast: (message: string, kind?: ToastKind, detail?: string) => void
  dismissToast: (id: string) => void
  setBusy: (label: string | null) => void
  refreshRecent: () => Promise<void>
  clearRecent: () => Promise<void>
}

export const useUi = create<UiState>((set, get) => ({
  dialog: null,
  pendingImage: null,
  confirm: null,
  toasts: [],
  busy: null,
  recentFiles: [],
  recentLoaded: false,

  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null, ...(get().dialog === 'image-import' ? { pendingImage: null } : {}) }),
  setPendingImage: (image) => set({ pendingImage: image }),

  askConfirm: (options) =>
    new Promise<boolean>((resolve) => {
      set({ confirm: { ...options, resolve } })
    }),

  resolveConfirm: (value) => {
    const confirm = get().confirm
    if (!confirm) return
    confirm.resolve(value)
    set({ confirm: null })
  },

  toast: (message, kind = 'info', detail) => {
    const toast: Toast = { id: makeId(), message, kind, ...(detail ? { detail } : {}) }
    set((state) => ({ toasts: [...state.toasts, toast].slice(-4) }))
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((entry) => entry.id !== toast.id) }))
    }, kind === 'error' ? 6200 : 3600)
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((entry) => entry.id !== id) })),

  setBusy: (label) => set({ busy: label }),

  refreshRecent: async () => {
    try {
      const recentFiles = await platform.listRecent()
      set({ recentFiles, recentLoaded: true })
    } catch {
      set({ recentLoaded: true })
    }
  },

  clearRecent: async () => {
    await platform.clearRecent()
    set({ recentFiles: [] })
  }
}))
