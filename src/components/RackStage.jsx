import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FastIcon, PauseIcon, PlayIcon } from './icons.jsx'

const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function RackStage({ products, onSelect, frozen, title }) {
  const hostRef = useRef(null)
  const rackRef = useRef(null)
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const [mode, setMode] = useState(reduced ? 'pause' : 'play')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let rack = null
    let alive = true
    // las fotos empiezan a bajar en paralelo con el motor gráfico
    for (const p of products) for (const u of [p.front, p.back]) if (u) new Image().src = u
    // PixiJS se descarga aparte (import dinámico): la página pinta al instante
    // y el perchero aparece apenas llega el motor gráfico.
    const fonts = document.fonts
      ? Promise.all([document.fonts.load('800 13px Archivo'), document.fonts.load('17px "Atkinson Hyperlegible"')]).catch(() => {})
      : Promise.resolve()
    Promise.all([import('../rack/Rack.js'), fonts])
      .then(([{ Rack }]) => {
        if (!alive) return
        rack = new Rack(hostRef.current, {
          onSelect: (p, side) => selectRef.current?.(p, side),
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

  useEffect(() => {
    if (ready && rackRef.current) rackRef.current.setProducts(products)
  }, [products, ready])

  useEffect(() => {
    rackRef.current?.setMode(frozen ? 'pause' : mode)
  }, [mode, frozen, ready])

  // con un panel abierto, el perchero deja de dibujarse (después de que el panel termina de subir)
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

  return (
    <section className="stage" aria-label={title}>
      <div className="stage-canvas" ref={hostRef} />
      {!ready && (
        <p className="stage-loading" aria-hidden="true">
          Colgando la ropa…
        </p>
      )}

      <h1 className="stage-title">
        <span className="kicker">Recién colgado en el local</span>
        {title}
      </h1>

      <div className="rack-controls">
        <button type="button" className="ctl round" aria-label="Prenda anterior" onClick={() => rackRef.current?.nudge(-1)}>
          <ChevronLeft />
        </button>
        <button
          type="button"
          className="ctl"
          aria-pressed={mode === 'pause'}
          onClick={() => setMode(mode === 'pause' ? 'play' : 'pause')}
        >
          {mode === 'pause' ? <PlayIcon /> : <PauseIcon />}
          <span>{mode === 'pause' ? 'Mover' : 'Pausar'}</span>
        </button>
        <button
          type="button"
          className={'ctl' + (mode === 'fast' ? ' is-on' : '')}
          aria-pressed={mode === 'fast'}
          onClick={() => setMode(mode === 'fast' ? 'play' : 'fast')}
        >
          <FastIcon />
          <span>{mode === 'fast' ? 'Velocidad normal' : 'Ver más rápido'}</span>
        </button>
        <button type="button" className="ctl round" aria-label="Prenda siguiente" onClick={() => rackRef.current?.nudge(1)}>
          <ChevronRight />
        </button>
      </div>

      {/* Lista accesible: con teclado o lector de pantalla se puede elegir cualquier prenda */}
      <ul className="a11y-list" aria-label="Prendas en el perchero">
        {products.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onSelect(p)}>
              Ver {p.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
