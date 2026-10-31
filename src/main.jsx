import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Archivo variable con eje de ancho (para el título extendido). El navegador solo baja el subset latino.
import '@fontsource-variable/archivo/wdth.css'
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
