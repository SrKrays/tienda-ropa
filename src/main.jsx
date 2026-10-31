import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// solo el subset latino (español): menos archivos de fuente
import '@fontsource/archivo/latin-500.css'
import '@fontsource/archivo/latin-700.css'
import '@fontsource/archivo/latin-800.css'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './styles.css'
import App from './App.jsx'
import { CartProvider } from './store/cart.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CartProvider>
      <App />
    </CartProvider>
  </StrictMode>
)
