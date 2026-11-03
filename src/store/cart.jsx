import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'

const CartCtx = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'add': {
      const color = action.color || null
      const key = action.product.id + '-' + action.size + (color ? '-' + color.id : '')
      const found = state.find((l) => l.key === key)
      if (found) return state.map((l) => (l.key === key ? { ...l, qty: l.qty + action.qty } : l))
      return [...state, { key, product: action.product, size: action.size, color, qty: action.qty }]
    }
    case 'qty':
      return state
        .map((l) => (l.key === action.key ? { ...l, qty: Math.max(0, l.qty + action.delta) } : l))
        .filter((l) => l.qty > 0)
    case 'remove':
      return state.filter((l) => l.key !== action.key)
    case 'clear':
      return []
    case 'sync': {
      const byId = new Map(action.products.map((p) => [p.id, p]))
      const next = state.filter((l) => byId.has(l.product.id)).map((l) => ({ ...l, product: byId.get(l.product.id) }))
      const same = next.length === state.length && next.every((l, i) => l.product === state[i].product)
      return same ? state : next
    }
    default:
      return state
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem('carrito') || '[]')
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [lines, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      localStorage.setItem('carrito', JSON.stringify(lines))
    } catch {
      /* sin storage: el carrito vive en memoria */
    }
  }, [lines])
  const value = useMemo(() => {
    const count = lines.reduce((a, l) => a + l.qty, 0)
    const total = lines.reduce((a, l) => a + l.qty * l.product.price, 0)
    return { lines, count, total, dispatch }
  }, [lines])
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>
}

export const useCart = () => useContext(CartCtx)
