import { CATEGORIES } from '../data/products.js'
import { useCart } from '../store/cart.jsx'
import { BagIcon } from './icons.jsx'

export default function TopBar({ category, onCategory, onOpenCart }) {
  const { count } = useCart()
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="[MARCA] — inicio">
        [MARCA]
      </a>
      <nav className="cats" aria-label="Categorías">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={'cat' + (c.id === category ? ' is-on' : '')}
            aria-pressed={c.id === category}
            onClick={() => onCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </nav>
      <button type="button" className="cart-btn" onClick={onOpenCart}>
        <BagIcon />
        <span>Carrito</span>
        <span className="cart-count" aria-label={count + ' prendas'}>
          {count}
        </span>
      </button>
    </header>
  )
}
