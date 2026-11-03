import { useEffect, useMemo, useRef, useState } from 'react'
import { getViewer } from '../rack/Viewer.js'
import { SIZE_ORDER, WHATSAPP_NUMBER, formatPrice } from '../data/products.js'
import { useCart } from '../store/cart.jsx'
import { renderFit } from '../fit/FitRenderer.js'
import { DEFAULT_PERSON, recommend } from '../fit/sizing.js'
import Sheet from './Sheet.jsx'
import SizeFinder from './SizeFinder.jsx'
import { CheckIcon, RulerIcon, TurnIcon, WhatsIcon } from './icons.jsx'

const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// prenda colgada con física (la misma del perchero)
function GarmentView({ product, startSide, side }) {
  const host = useRef(null)
  useEffect(() => {
    const el = host.current
    const v = getViewer()
    v.show(el, product, startSide, reduced)
    return () => v.hide(el)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])
  useEffect(() => {
    getViewer().setSide(side)
  }, [side])
  return <div className="viewer" ref={host} />
}

// imagen de la prenda puesta en el maniquí (se calcula una vez y queda guardada)
function useFit(product, view, size, person, side, enabled) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!enabled || !product) return
    let alive = true
    setUrl(null)
    renderFit({ product, view, size, person, side }).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, view, size, side, enabled, person.height, person.weight, person.body, person.chest])
  return url
}

const hasSaved = () => {
  try {
    return !!localStorage.getItem('mis-medidas')
  } catch {
    return false
  }
}

const loadPerson = () => {
  try {
    return { ...DEFAULT_PERSON, ...JSON.parse(localStorage.getItem('mis-medidas') || '{}') }
  } catch {
    return DEFAULT_PERSON
  }
}

function FitThumb({ product, view, side, size, person, label, active, onClick }) {
  const url = useFit(product, view, size, person, side, true)
  return (
    <button type="button" className={'thumb' + (active ? ' is-on' : '')} aria-pressed={active} onClick={onClick}>
      {url ? <img src={url} alt="" /> : <span className="thumb-loading" aria-hidden="true" />}
      <span>{label}</span>
    </button>
  )
}

export default function ProductSheet({ sel, open, onClose, onGoToCart }) {
  const product = sel?.product
  const { lines, dispatch } = useCart()
  const [view, setView] = useState('colgada')
  const [side, setSide] = useState(sel?.side || 'front')
  const [size, setSize] = useState(null)
  const [color, setColor] = useState(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [warn, setWarn] = useState(false)
  const [finder, setFinder] = useState(false)
  const [person, setPersonState] = useState(loadPerson)
  const [saved, setSaved] = useState(hasSaved)
  const galleryRef = useRef(null)
  const tryOn = product && product.tryOn !== false

  const setPerson = (p) => {
    setPersonState(p)
    try {
      localStorage.setItem('mis-medidas', JSON.stringify(p))
      setSaved(true)
    } catch {
      /* sin storage: se usa solo en esta visita */
    }
  }

  useEffect(() => {
    if (!sel) return
    const tryIt = sel.product.tryOn !== false
    setView(sel.finder && tryIt ? 'calce' : 'colgada')
    setSide(sel.side)
    setSize(sel.size || null)
    setColor(sel.color || sel.product.colors?.[0] || null)
    setQty(1)
    setAdded(false)
    setWarn(false)
    setFinder(!!sel.finder)
  }, [sel])

  const sizes = product ? SIZE_ORDER.filter((s) => product.sizes[s] != null) : []
  const rec = useMemo(() => (product ? recommend(product, person, sizes) : null), [product, person]) // eslint-disable-line react-hooks/exhaustive-deps
  const shownSize = size || rec?.size || 'M'

  // stock: lo que queda del talle menos lo que ya está en el carrito
  const stockOf = (s) => product?.sizes[s] ?? 0
  const inCart = (s) => lines.filter((l) => l.product.id === product?.id && l.size === s).reduce((a, l) => a + l.qty, 0)
  const available = size ? Math.max(0, stockOf(size) - inCart(size)) : 0
  useEffect(() => {
    if (size && qty > Math.max(1, available)) setQty(Math.max(1, available))
  }, [size, available]) // eslint-disable-line react-hooks/exhaustive-deps

  const mainView = view === 'calce' ? 'completo' : view
  const mainSide = view === 'espalda' ? 'back' : 'front'
  const mainUrl = useFit(product, mainView, shownSize, person, mainSide, tryOn && view !== 'colgada')

  const pickSize = (s) => {
    if (stockOf(s) <= 0 && !finder) return
    setSize(s)
    setWarn(false)
    setAdded(false)
  }

  const add = () => {
    if (!size) {
      setWarn(true)
      return
    }
    if (available <= 0) return
    dispatch({ type: 'add', product, size, color, qty: Math.min(qty, available) })
    setAdded(true)
  }

  // botón de la calculadora: prende y apaga
  const toggleFinder = () => {
    if (finder) {
      setFinder(false)
      if (view === 'calce') setView(tryOn ? 'pecho' : 'colgada')
    } else {
      setFinder(true)
      if (tryOn) setView('calce')
    }
  }

  const waText = product ? encodeURIComponent(`Hola! Quería consultar por "${product.name}"${size ? ' en talle ' + size : ''}.`) : ''
  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`

  const thumbs = tryOn
    ? [
        { id: 'pecho', label: 'Puesta', side: 'front' },
        product.back ? { id: 'espalda', label: 'Espalda', side: 'back' } : null,
        { id: 'brazo', label: 'Manga', side: 'front' },
      ].filter(Boolean)
    : []

  return (
    <Sheet open={open} onClose={onClose} label={product ? product.name : 'Prenda'} tall>
      {product && (
        <div className="product">
          <div className="gallery" ref={galleryRef}>
            <div className="gallery-main">
              {view === 'colgada' ? (
                <>
                  <GarmentView product={product} startSide={sel.side} side={side} />
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
                </>
              ) : (
                <figure className="fit-figure">
                  {mainUrl ? <img src={mainUrl} alt={`${product.name} puesta en un maniquí, talle ${shownSize}`} /> : <span className="fit-loading">Probando la prenda…</span>}
                  <figcaption>
                    {view === 'calce' ? `Así te queda el talle ${shownSize}` : `Talle ${shownSize} en maniquí · ${person.height} cm`}
                  </figcaption>
                </figure>
              )}
            </div>

            {tryOn && (
              <div className="thumbs" role="group" aria-label="Fotos de la prenda">
                <button type="button" className={'thumb' + (view === 'colgada' ? ' is-on' : '')} aria-pressed={view === 'colgada'} onClick={() => setView('colgada')}>
                  <img src={product.front} alt="" className="thumb-flat" />
                  <span>Colgada</span>
                </button>
                {thumbs.map((t) => (
                  <FitThumb
                    key={t.id}
                    product={product}
                    view={t.id}
                    side={t.side}
                    size={shownSize}
                    person={person}
                    label={t.label}
                    active={view === t.id}
                    onClick={() => setView(t.id)}
                  />
                ))}
                {finder && (
                  <FitThumb product={product} view="completo" side="front" size={shownSize} person={person} label="Tu talle" active={view === 'calce'} onClick={() => setView('calce')} />
                )}
              </div>
            )}
          </div>

          <div className="product-info">
            {product.tag && <span className="pill-tag">{product.tag}</span>}
            <h2 className="product-name">{product.name}</h2>
            <p className="product-price">
              {formatPrice(product.price)}
              {product.oldPrice && <s>{formatPrice(product.oldPrice)}</s>}
            </p>
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
              <legend>Elegí tu talle</legend>
              <div className="size-row">
                {sizes.map((s) => {
                  const out = stockOf(s) === 0
                  return (
                    <button
                      key={s}
                      type="button"
                      className={'size' + (size === s ? ' is-on' : '') + (out ? ' is-out' : '')}
                      disabled={out}
                      aria-pressed={size === s}
                      aria-label={out ? `${s}, sin stock` : s}
                      onClick={() => pickSize(s)}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
              {size && stockOf(size) > 0 && (
                <p className={'stock' + (available <= 3 ? ' low' : '')}>
                  {available === 0
                    ? `Ya tenés en el carrito todas las del talle ${size}`
                    : available === 1
                      ? `Queda 1 en talle ${size}`
                      : `Quedan ${available} en talle ${size}`}
                </p>
              )}
              {size && stockOf(size) === 0 && <p className="warn">El talle {size} no tiene stock: consultanos por WhatsApp.</p>}
              {warn && (
                <p className="warn" role="alert">
                  Primero elegí un talle
                </p>
              )}
            </fieldset>

            <button type="button" role="switch" aria-checked={finder} className={'fit-cta' + (finder ? ' is-on' : '')} onClick={toggleFinder}>
              <span className="fit-cta-icon">
                <RulerIcon />
              </span>
              <span className="fit-cta-text">
                <strong>{finder ? 'Calculadora de talle' : 'Calcular mi talle'}</strong>
                <small>
                  {finder
                    ? 'Tocá para apagarla'
                    : saved && rec
                      ? `Con tus medidas te va el talle ${rec.size}`
                      : 'Con tu altura y peso, o con una remera tuya'}
                </small>
              </span>
              <span className="fit-switch" aria-hidden="true">
                <i />
              </span>
            </button>

            {finder && (
              <SizeFinder
                product={product}
                person={person}
                setPerson={setPerson}
                size={size}
                onPickSize={(s) => {
                  pickSize(s)
                  if (tryOn) {
                    setView('calce')
                    // en celular la foto queda arriba: la mostramos para que se vea cómo queda
                    if (window.innerWidth < 860) galleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }}
              />
            )}

            <div className="qty-row">
              <span>Cantidad</span>
              <div className="qty">
                <button type="button" aria-label="Una menos" disabled={qty <= 1} onClick={() => setQty(Math.max(1, qty - 1))}>
                  −
                </button>
                <output aria-live="polite">{qty}</output>
                <button type="button" aria-label="Una más" disabled={!size || qty >= available} onClick={() => setQty(Math.min(available, qty + 1))}>
                  +
                </button>
              </div>
            </div>

            {!added ? (
              <button type="button" className="btn-primary" onClick={add} disabled={size != null && available <= 0}>
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
