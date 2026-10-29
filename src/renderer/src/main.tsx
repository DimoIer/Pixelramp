import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/space-grotesk/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/layout.css'
import './styles/palette.css'
import './styles/canvas.css'
import './styles/dialogs.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
