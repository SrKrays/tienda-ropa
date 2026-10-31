import { useEffect, useRef, useState } from 'react'
import { getViewer } from '../rack/Viewer.js'
import { SIZE_ORDER, WHATSAPP_NUMBER, formatPrice } from '../data/products.js'
import { useCart } from '../store/cart.jsx'
import Sheet from './Sheet.jsx'
import { CheckIcon, TurnIcon, WhatsIcon } from './icons.jsx'

const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function GarmentView({ sel, side }) {
  const host = useRef(null)
  useEffect(() => {
    const el = host.current
    const v = getViewer()
    v.show(el, sel.product, sel.side, reduced)
    return () => v.hide(el)
  }, [sel])
  useEffect(() => {
    getViewer().setSide(side)
  }, [side])
  return <div className="viewer" ref={host} />
}

export default function ProductSheet({ sel, open, onClose, onGoToCart }) {
  const product = sel?.product
  const { dispatch } = useCart()
  const [side, setSide] = useState(sel?.side || 'front')
  const [size, setSize] = useState(null)
  const [color, setColor] = useState(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [warn, setWarn] = useState(false)

  useEffect(() => {
    if (!sel) return
    setSide(sel.side)
    setSize(sel.size || null)
    setColor(sel.color || sel.product.colors?.[0] || null)
    setQty(1)
    setAdded(false)
    setWarn(false)
  }, [sel])

  const add = () => {
    if (!size) {
      setWarn(true)
      return
    }
    dispatch({ type: 'add', product, size, color, qty })
    setAdded(true)
  }

  const waText = product
    ? encodeURIComponent(`Hola! Quería consultar por "${product.name}"${size ? ' en talle ' + size : ''}.`)
    : ''
  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`

  return (
    <Sheet open={open} onClose={onClose} label={product ? product.name : 'Prenda'} tall>
      {product && (
        <div className="product">
          <div className="product-visual">
            <GarmentView sel={sel} side={side} />
            {product.back && (
              <div className="side-toggle" role="group" aria-label="Ver la prenda de">
                <button type="button" aria-pressed={side === 'front'} onClick={() => setSide('front')}>
                  Frente
                </button>
                <button type="button" aria-pressed={side === 'back'} onClick={() => setSide('back')}>
                  Espalda
                </button>
              </div>
            )}
            <p className="visual-hint">
              <TurnIcon /> Pasá el dedo o el mouse por la prenda para moverla
            </p>
          </div>

          <div className="product-info">
            {product.tag && <span className="pill-tag">{product.tag}</span>}
            <h2 className="product-name">{product.name}</h2>
            <p className="product-price">
              {formatPrice(product.price)}
              {product.oldPrice && <s>{formatPrice(product.oldPrice)}</s>}
            </p>
            <p className="product-note">[CUOTAS / DESCUENTO POR TRANSFERENCIA]</p>
            <p className="product-desc">{product.description}</p>

            {product.colors?.length > 1 && (
              <fieldset className="sizes">
                <legend>Color: {color?.name}</legend>
                <div className="size-row">
                  {product.colors.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={'swatch' + (color?.id === c.id ? ' is-on' : '')}
                      style={{ '--sw': c.hex }}
                      aria-pressed={color?.id === c.id}
                      aria-label={c.name}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="sizes">
              <legend>
                Elegí tu talle <a href="#guia-talles">Ver guía de talles</a>
              </legend>
              <div className="size-row">
                {SIZE_ORDER.map((s) => {
                  const stock = product.sizes[s] ?? 0
                  const out = stock === 0
                  return (
                    <button
                      key={s}
                      type="button"
                      className={'size' + (size === s ? ' is-on' : '') + (out ? ' is-out' : '')}
                      disabled={out}
                      aria-pressed={size === s}
                      aria-label={out ? `${s}, sin stock` : s}
                      onClick={() => {
                        setSize(s)
                        setWarn(false)
                        setAdded(false)
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
              {size && product.sizes[size] <= 3 && <p className="low">Quedan pocas en talle {size}</p>}
              {warn && (
                <p className="warn" role="alert">
                  Primero elegí un talle
                </p>
              )}
            </fieldset>

            <div className="qty-row">
              <span>Cantidad</span>
              <div className="qty">
                <button type="button" aria-label="Una menos" onClick={() => setQty(Math.max(1, qty - 1))}>
                  −
                </button>
                <output aria-live="polite">{qty}</output>
                <button type="button" aria-label="Una más" onClick={() => setQty(qty + 1)}>
                  +
                </button>
              </div>
            </div>

            {!added ? (
              <button type="button" className="btn-primary" onClick={add}>
                Agregar al carrito
              </button>
            ) : (
              <div className="added" role="status">
                <p>
                  <CheckIcon /> ¡Listo! La agregaste al carrito.
                </p>
                <div className="added-actions">
                  <button type="button" className="btn-primary" onClick={onGoToCart}>
                    Ir a pagar
                  </button>
                  <button type="button" className="btn-ghost" onClick={onClose}>
                    Seguir mirando
                  </button>
                </div>
              </div>
            )}
            <a className="btn-ghost wa" href={waHref} target="_blank" rel="noreferrer">
              <WhatsIcon /> Consultar por WhatsApp
            </a>
          </div>
        </div>
      )}
    </Sheet>
  )
}
