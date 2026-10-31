import { formatPrice } from '../data/products.js'
import { useCart } from '../store/cart.jsx'
import { BagIcon } from './icons.jsx'

export default function BottomBar({ onOpenCart }) {
  const { count, total } = useCart()
  return (
    <div className="bottombar">
      {count === 0 ? (
        <p className="bb-hint">Tocá cualquier prenda para verla de cerca, elegir tu talle y comprar.</p>
      ) : (
        <>
          <p className="bb-sum">
            <BagIcon />
            <span>
              {count} {count === 1 ? 'prenda' : 'prendas'} en tu carrito · <strong>{formatPrice(total)}</strong>
            </span>
          </p>
          <button type="button" className="btn-primary bb-btn" onClick={onOpenCart}>
            Ver carrito y pagar
          </button>
        </>
      )}
    </div>
  )
}
