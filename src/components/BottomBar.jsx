import { formatPrice } from '../data/products.js'
import { useCart } from '../store/cart.jsx'
import { ArrowUpRight, BagLargeIcon, HangerIcon, SparkleIcon } from './icons.jsx'

export default function BottomBar({ onOpenCart, onExplore }) {
  const { count, total } = useCart()
  return (
    <div className="bottombar">
      <p className="bb-side left">
        <span className="bb-ring">
          <SparkleIcon />
        </span>
        Compra segura
      </p>

      <div className="cart-pill">
        <span className="cp-icon">
          <BagLargeIcon />
        </span>
        <p className="cp-sum">
          {count === 0 ? (
            <>
              <span>Tu carrito</span>
              <strong>Está vacío</strong>
            </>
          ) : (
            <>
              <span>
                {count} {count === 1 ? 'prenda' : 'prendas'}
              </span>
              <strong>{formatPrice(total)}</strong>
            </>
          )}
        </p>
        <span className="cp-sep" aria-hidden="true" />
        <button type="button" className="cp-btn" onClick={onOpenCart}>
          {count === 0 ? 'Ver carrito' : 'Ir a pagar'} <ArrowUpRight size={17} />
        </button>
      </div>

      <button type="button" className="bb-side right" onClick={onExplore}>
        <HangerIcon />
        Seguí explorando
      </button>
    </div>
  )
}
