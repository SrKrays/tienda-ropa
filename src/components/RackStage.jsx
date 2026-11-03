import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { COLLECTION_LABEL, COLLECTION_YEAR, SIZE_ORDER, formatPrice } from '../data/products.js'
import { useCart } from '../store/cart.jsx'
import { ArrowUpRight, CheckIcon, ChevronLeft, ChevronRight, PlusIcon, RulerIcon, TurnIcon } from './icons.jsx'

const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function RackStage({ products, headline, onSelect, frozen, apiRef, loading = false, waking = false }) {
  const hostRef = useRef(null)
  const rackRef = useRef(null)
  const editRef = useRef(null)
  const infoRef = useRef(null)
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const [ready, setReady] = useState(false)
  const [layout, setLayout] = useState(null)
  const [center, setCenter] = useState(null) // { p, side }
  const [picks, setPicks] = useState({}) // por prenda: { size, color }
  const picksRef = useRef(picks)
  picksRef.current = picks
  const [warn, setWarn] = useState(false)
  const [added, setAdded] = useState(false)
  const { lines, dispatch } = useCart()
  const [noStock, setNoStock] = useState(false)

  // ---- motor del perchero (PixiJS se carga aparte) ----
  useEffect(() => {
    let rack = null
    let alive = true
    for (const p of products) for (const u of [p.front, p.back]) if (u) new Image().src = u
    const fonts = document.fonts
      ? Promise.all([document.fonts.load('800 14px "Archivo Variable"')]).catch(() => {})
      : Promise.resolve()
    Promise.all([import('../rack/Rack.js'), fonts])
      .then(([{ Rack }]) => {
        if (!alive) return
        rack = new Rack(hostRef.current, {
          onSelect: (p, side) => selectRef.current?.(p, side, picksRef.current[p.id]),
          onCenter: (p, side) => setCenter(p ? { p, side } : null),
          onLayout: setLayout,
          reducedMotion: reduced,
        })
        return rack.init()
      })
      .then(() => {
        if (!alive || !rack) return
        rackRef.current = rack
        setReady(true)
      })
    return () => {
      alive = false
      rack?.destroy()
      rackRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // la interfaz le avisa al perchero cuánto lugar tiene (arriba el título, abajo la info y el carrito)
  const measure = useCallback(() => {
    const rack = rackRef.current
    if (!rack || !editRef.current || !infoRef.current) return
    const mobile = window.innerWidth < 760
    const top = editRef.current.getBoundingClientRect().bottom + (mobile ? 16 : 8)
    const bar = mobile ? 100 : 96
    const bottom = infoRef.current.offsetHeight + bar + (mobile ? 16 : 12)
    rack.setInsets({ top, bottom })
  }, [])

  useLayoutEffect(() => {
    if (!ready) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(editRef.current)
    ro.observe(infoRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ready, measure])

  useEffect(() => {
    if (ready && rackRef.current) {
      measure()
      rackRef.current.setProducts(products)
    }
  }, [products, ready, measure])

  useEffect(() => {
    rackRef.current?.setPaused(frozen)
  }, [frozen, ready])

  useEffect(() => {
    const rack = rackRef.current
    if (!rack) return
    if (!frozen) {
      rack.setActive(true)
      return
    }
    const t = setTimeout(() => rack.setActive(false), 450)
    return () => clearTimeout(t)
  }, [frozen, ready])

  // API para otros componentes (barra inferior)
  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      next: () => rackRef.current?.nudge(1),
      explore: () => {
        rackRef.current?.resumeTour()
        rackRef.current?.nudge(1)
      },
    }
  }, [apiRef])

  // flechas del teclado
  useEffect(() => {
    const onKey = (e) => {
      if (frozen) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') rackRef.current?.nudge(1)
      if (e.key === 'ArrowLeft') rackRef.current?.nudge(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [frozen])

  // al cambiar la prenda del centro se limpian los avisos
  const centerId = center?.p.id
  useEffect(() => {
    setWarn(false)
    setAdded(false)
    setNoStock(false)
  }, [centerId])

  const p = center?.p
  const pick = (p && picks[p.id]) || {}
  const color = p ? pick.color || p.colors?.[0] : null
  const setPick = (patch) => {
    setPicks((all) => ({ ...all, [p.id]: { ...pick, ...patch } }))
    rackRef.current?.holdCenter()
  }

  const addToCart = () => {
    if (!pick.size) {
      setWarn(true)
      rackRef.current?.holdCenter()
      return
    }
    const inCart = lines.filter((l) => l.product.id === p.id && l.size === pick.size).reduce((a, l) => a + l.qty, 0)
    if (inCart >= (p.sizes[pick.size] ?? 0)) {
      setNoStock(true)
      rackRef.current?.holdCenter()
      return
    }
    setNoStock(false)
    dispatch({ type: 'add', product: p, size: pick.size, color, qty: 1 })
    setAdded(true)
    setWarn(false)
    rackRef.current?.holdCenter()
    clearTimeout(addRef.current)
    addRef.current = setTimeout(() => setAdded(false), 2200)
  }
  const addRef = useRef(null)

  const flip = () => {
    const side = rackRef.current?.flipCenter()
    if (side) setCenter((c) => (c ? { ...c, side } : c))
  }

  const style = layout ? { top: layout.infoTop } : { visibility: 'hidden' }

  return (
    <section className="stage" aria-label={headline.title}>
      <div className="stage-canvas" ref={hostRef} />
      <div className="beams" aria-hidden="true" />
      {(!ready || loading) && (
        <p className="stage-loading" role="status">
          {waking ? 'Abriendo el local… un momento' : 'Colgando la ropa…'}
        </p>
      )}
      {ready && !loading && products.length === 0 && (
        <p className="stage-loading" role="status">
          Pronto vas a encontrar prendas nuevas acá.
        </p>
      )}

      <div className="editorial" ref={editRef}>
        <p className="ed-kicker">
          {COLLECTION_LABEL} <span>/ {COLLECTION_YEAR}</span>
          <i aria-hidden="true" />
        </p>
        <h1 className="ed-title">{headline.title}</h1>
        <p className="ed-sub">{headline.sub}</p>
        <p className="ed-meta">
          <span>
            {products.length} {products.length === 1 ? 'prenda' : 'prendas'}
          </span>
          <button type="button" onClick={() => apiRef?.current?.explore()}>
            Explorar colección <ArrowUpRight size={15} />
          </button>
        </p>
      </div>

      {layout && !layout.mobile && (
        <>
          <button type="button" className="nav-arrow left" style={{ top: layout.arrowsY }} aria-label="Prenda anterior" onClick={() => rackRef.current?.nudge(-1)}>
            <ChevronLeft />
          </button>
          <button type="button" className="nav-arrow right" style={{ top: layout.arrowsY }} aria-label="Prenda siguiente" onClick={() => rackRef.current?.nudge(1)}>
            <ChevronRight />
          </button>
        </>
      )}

      <div className="center-info" ref={infoRef} style={style} aria-live="polite">
        {p && (
          <>
            <h2 className="ci-name">{p.name}</h2>
            <p className="ci-price">
              {formatPrice(p.price)}
              {p.oldPrice && <s>{formatPrice(p.oldPrice)}</s>}
            </p>
            <button type="button" className="ci-fit" onClick={() => onSelect(p, center.side, { ...pick, finder: true })}>
              <RulerIcon size={17} /> ¿Qué talle soy?
            </button>
            <div className="ci-controls">
            <div className="ci-options">
              {p.colors?.length > 1 && (
                <>
                  <div className="ci-colors" role="group" aria-label="Color">
                    {p.colors.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={'dot' + (color?.id === c.id ? ' is-on' : '')}
                        style={{ '--sw': c.hex }}
                        aria-pressed={color?.id === c.id}
                        aria-label={'Color ' + c.name}
                        title={c.name}
                        onClick={() => setPick({ color: c })}
                      />
                    ))}
                  </div>
                  <span className="ci-sep" aria-hidden="true" />
                </>
              )}
              <div className="ci-sizes" role="group" aria-label="Talle">
                {SIZE_ORDER.map((sz) => {
                  const out = !(p.sizes[sz] > 0)
                  return (
                    <button
                      key={sz}
                      type="button"
                      className={'size-dot' + (pick.size === sz ? ' is-on' : '') + (out ? ' is-out' : '')}
                      disabled={out}
                      aria-pressed={pick.size === sz}
                      aria-label={out ? `Talle ${sz}, sin stock` : `Talle ${sz}`}
                      onClick={() => {
                        setPick({ size: sz })
                        setWarn(false)
                        setNoStock(false)
                      }}
                    >
                      {sz}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="ci-actions">
              {p.back && (
                <button type="button" className="pill-btn" onClick={flip}>
                  <TurnIcon /> {center.side === 'back' ? 'Ver frente' : 'Ver espalda'}
                </button>
              )}
              <button type="button" className={'pill-btn solid' + (added ? ' is-done' : '')} onClick={addToCart}>
                {added ? <CheckIcon /> : <PlusIcon />} {added ? 'Agregada' : 'Agregar'}
              </button>
            </div>
            </div>
            {warn && (
              <p className="ci-warn" role="alert">
                Elegí tu talle para agregarla
              </p>
            )}
            {noStock && (
              <p className="ci-warn" role="alert">
                Ya tenés en el carrito todas las del talle {pick.size}
              </p>
            )}
          </>
        )}
      </div>

      {/* Lista accesible: con teclado o lector de pantalla se puede elegir cualquier prenda */}
      <ul className="a11y-list" aria-label="Prendas en el perchero">
        {products.map((it) => (
          <li key={it.id}>
            <button type="button" onClick={() => onSelect(it)}>
              Ver {it.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
