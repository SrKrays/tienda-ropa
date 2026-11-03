import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TopBar from './components/TopBar.jsx'
import RackStage from './components/RackStage.jsx'

// Los paneles (y framer-motion) se cargan aparte: no hacen falta para ver el perchero.
const loadProduct = () => import('./components/ProductSheet.jsx')
const loadCheckout = () => import('./components/CheckoutSheet.jsx')
const ProductSheet = lazy(loadProduct)
const CheckoutSheet = lazy(loadCheckout)
import BottomBar from './components/BottomBar.jsx'
import { HEADLINES } from './data/products.js'
import { useCatalog } from './data/catalog.js'
import { useCart } from './store/cart.jsx'

export default function App() {
  const [category, setCategory] = useState('todo')
  const [sel, setSel] = useState(null)
  const [productOpen, setProductOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [usedProduct, setUsedProduct] = useState(false)
  const [usedCart, setUsedCart] = useState(false)

  // precarga los paneles cuando el navegador está libre, así abren al instante
  useEffect(() => {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500))
    idle(() => {
      loadProduct()
      loadCheckout()
    })
  }, [])
  useEffect(() => {
    if (productOpen) setUsedProduct(true)
  }, [productOpen])
  useEffect(() => {
    if (cartOpen) setUsedCart(true)
  }, [cartOpen])

  const { products: catalog, status } = useCatalog()
  const { dispatch } = useCart()
  // el carrito guardado se actualiza con los precios y datos nuevos (y saca lo que ya no está)
  useEffect(() => {
    if (catalog && status === 'ok') dispatch({ type: 'sync', products: catalog })
  }, [catalog, status, dispatch])

  const products = useMemo(() => {
    if (!catalog) return []
    return category === 'todo' ? catalog : catalog.filter((p) => p.categories.includes(category))
  }, [catalog, category])
  const apiRef = useRef(null)
  const select = useCallback((p, side = 'front', pick) => {
    setSel({ product: p, side: p.back ? side : 'front', size: pick?.size, color: pick?.color, finder: !!pick?.finder })
    setProductOpen(true)
  }, [])

  return (
    <div className="shop">
      <div className="store-bg" aria-hidden="true" />
      <TopBar category={category} onCategory={setCategory} onOpenCart={() => setCartOpen(true)} />
      <main>
        <RackStage
          products={products}
          onSelect={select}
          frozen={productOpen || cartOpen}
          headline={HEADLINES[category]}
          apiRef={apiRef}
          loading={!catalog}
          waking={status === 'waking'}
        />
      </main>
      <BottomBar onOpenCart={() => setCartOpen(true)} onExplore={() => apiRef.current?.explore()} />
      <Suspense fallback={null}>
        {(usedProduct || productOpen) && (
          <ProductSheet
            sel={sel}
            open={productOpen}
            onClose={() => setProductOpen(false)}
            onGoToCart={() => {
              setProductOpen(false)
              setCartOpen(true)
            }}
          />
        )}
        {(usedCart || cartOpen) && <CheckoutSheet open={cartOpen} onClose={() => setCartOpen(false)} />}
      </Suspense>
    </div>
  )
}
