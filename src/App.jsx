import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import TopBar from './components/TopBar.jsx'
import RackStage from './components/RackStage.jsx'

// Los paneles (y framer-motion) se cargan aparte: no hacen falta para ver el perchero.
const loadProduct = () => import('./components/ProductSheet.jsx')
const loadCheckout = () => import('./components/CheckoutSheet.jsx')
const ProductSheet = lazy(loadProduct)
const CheckoutSheet = lazy(loadCheckout)
import BottomBar from './components/BottomBar.jsx'
import { CATEGORIES, PRODUCTS } from './data/products.js'

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

  const products = useMemo(
    () => (category === 'todo' ? PRODUCTS : PRODUCTS.filter((p) => p.categories.includes(category))),
    [category]
  )
  const title = CATEGORIES.find((c) => c.id === category)?.label
  const select = useCallback((p, side = 'front') => {
    setSel({ product: p, side: p.back ? side : 'front' })
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
          title={category === 'todo' ? 'Toda la colección' : title}
        />
      </main>
      <BottomBar onOpenCart={() => setCartOpen(true)} />
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
