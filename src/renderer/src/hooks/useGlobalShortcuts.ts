import { useEffect } from 'react'
import { useWorkbench } from '../store/workbench'
import { useUi } from '../store/ui'
import {
  closeDocumentTabCommand,
  copySelectionCommand,
  cutSelectionCommand,
  deleteSelectionCommand,
  deselectCommand,
  openFileCommand,
  openNewCanvasDialog,
  pasteCommand,
  saveProjectCommand,
  selectAllCommand
} from '../commands'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !!target.closest(
    'input, textarea, select, [contenteditable="true"], [contenteditable=""]'
  )
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return
      if (isTypingTarget(event.target)) return
      const ui = useUi.getState()
      if (ui.dialog || ui.confirm || ui.busy) return

      const state = useWorkbench.getState()
      const command = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (event.key === 'Escape') {
        if (state.selection) {
          deselectCommand()
          event.preventDefault()
        }
        return
      }

      if (command) {
        if (key === 'w') {
          event.preventDefault()
          void closeDocumentTabCommand(state.activeTabId)
          return
        }
        if (event.key === 'Tab') {
          event.preventDefault()
          const index = state.tabs.findIndex((tab) => tab.id === state.activeTabId)
          const direction = event.shiftKey ? -1 : 1
          const next = state.tabs[(index + direction + state.tabs.length) % state.tabs.length]
          if (next) state.switchTab(next.id)
          return
        }
        if (key === 'z') {
          event.preventDefault()
          if (event.shiftKey) state.redo()
          else state.undo()
          return
        }
        if (key === 'y') {
          event.preventDefault()
          state.redo()
          return
        }
        if (key === 's') {
          event.preventDefault()
          void saveProjectCommand(event.shiftKey)
          return
        }
        if (key === 'o') {
          event.preventDefault()
          void openFileCommand()
          return
        }
        if (key === 'n') {
          event.preventDefault()
          openNewCanvasDialog()
          return
        }
        if (key === 'e' && event.shiftKey) {
          event.preventDefault()
          ui.openDialog('export-image')
          return
        }
        if (key === 'c') {
          event.preventDefault()
          copySelectionCommand()
          return
        }
        if (key === 'x') {
          event.preventDefault()
          cutSelectionCommand()
          return
        }
        if (key === 'v') {
          event.preventDefault()
          pasteCommand()
          return
        }
        if (key === 'a') {
          event.preventDefault()
          selectAllCommand()
          return
        }
        if (key === '0') {
          event.preventDefault()
          state.fitView()
          return
        }
        return
      }

      if (event.altKey) return

      if (event.shiftKey) {
        if (key === 'g') {
          event.preventDefault()
          state.setShowGrid(!state.showGrid)
          return
        }
        if (event.key === '?') {
          event.preventDefault()
          ui.openDialog('shortcuts')
          return
        }
      }

      if (event.shiftKey) {
        if (event.key === '+') {
          event.preventDefault()
          state.zoomStep(1)
        }
        return
      }

      switch (key) {
        case 'b':
          state.setTool('pencil')
          event.preventDefault()
          break
        case 'e':
          state.setTool('eraser')
          event.preventDefault()
          break
        case 'g':
          state.setTool('bucket')
          event.preventDefault()
          break
        case 'i':
          state.setTool('eyedropper')
          event.preventDefault()
          break
        case 'l':
          state.setTool('line')
          event.preventDefault()
          break
        case 'r':
          state.setTool('rectangle')
          event.preventDefault()
          break
        case 'v':
          state.setTool('select')
          event.preventDefault()
          break
        case 'x':
          state.swapColors()
          event.preventDefault()
          break
        case 'delete':
        case 'backspace':
          if (state.selection) {
            event.preventDefault()
            deleteSelectionCommand()
          }
          break
        case '+':
        case '=':
          event.preventDefault()
          state.zoomStep(1)
          break
        case '-':
        case '_':
          event.preventDefault()
          state.zoomStep(-1)
          break
        case '[':
          event.preventDefault()
          state.setBrushSize(state.brushSize - 1)
          break
        case ']':
          event.preventDefault()
          state.setBrushSize(state.brushSize + 1)
          break
        case '?':
          event.preventDefault()
          ui.openDialog('shortcuts')
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
