import { useEffect, useRef, useState } from 'react'
import { cutout, loadBitmap } from './cutout.js'

// Campo de foto: elegir (o sacar con el celu) → se recorta el fondo solo → vista previa.
// value = { blob, url, removed, coverage } cuando hay foto nueva; existing = URL de la foto ya guardada.
export default function PhotoField({ label, hint, required, existing, value, onChange, onRemove, keepBackground = false }) {
  const input = useRef(null)
  const srcRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [tol, setTol] = useState(50)
  const [removeBg, setRemoveBg] = useState(true)
  const [err, setErr] = useState(null)

  const run = async (opts) => {
    if (!srcRef.current) return
    setBusy(true)
    setErr(null)
    try {
      // un respiro para que se vea el "Recortando…" antes del cálculo
      await new Promise((r) => setTimeout(r, 30))
      const r = await cutout(srcRef.current, { tolerance: opts.tol, removeBg: opts.removeBg })
      if (value?.url) URL.revokeObjectURL(value.url)
      onChange(r)
    } catch {
      setErr('No se pudo leer la foto. Probá con otra (JPG, PNG o WebP).')
    } finally {
      setBusy(false)
    }
  }

  const pick = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErr('Ese archivo no es una foto.')
      return
    }
    setBusy(true)
    try {
      srcRef.current = await loadBitmap(file)
    } catch {
      setBusy(false)
      setErr('No se pudo abrir la foto. Probá con otra (JPG, PNG o WebP).')
      return
    }
    setTol(50)
    setRemoveBg(!keepBackground)
    run({ tol: 50, removeBg: !keepBackground })
  }

  // el control deslizante recalcula cuando se suelta (no en cada píxel)
  const [tolDraft, setTolDraft] = useState(tol)
  useEffect(() => setTolDraft(tol), [tol])

  const shown = value?.url || existing
  const suspicious = value && value.removed && (value.coverage < 0.04 || value.coverage > 0.93)

  return (
    <div className={'photo' + (shown ? ' has-img' : '')}>
      <div className="photo-head">
        <span className="field-label">
          {label} {!required && <small>(opcional)</small>}
        </span>
        {hint && <small className="photo-hint">{hint}</small>}
      </div>

      <div
        className="photo-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          pick(e.dataTransfer.files?.[0])
        }}
      >
        {shown ? (
          <img src={shown} alt={`Vista previa: ${label.toLowerCase()}`} />
        ) : (
          <button type="button" className="photo-empty" onClick={() => input.current?.click()}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.6" />
            </svg>
            <strong>Elegir foto</strong>
            <small>o sacala con el celular</small>
          </button>
        )}
        {busy && <span className="photo-busy">{keepBackground ? 'Preparando la foto…' : 'Recortando el fondo…'}</span>}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {err && (
        <p className="a-warn" role="alert">
          {err}
        </p>
      )}
      {suspicious && (
        <p className="a-warn">
          Parece que el recorte no salió bien. Mové la barra de abajo, o sacá la foto de nuevo sobre un fondo liso que contraste con la prenda (si la prenda es clara, fondo oscuro).
        </p>
      )}

      {value && !value.alreadyClear && !keepBackground && (
        <div className="photo-tools">
          <label className="a-check">
            <input
              type="checkbox"
              checked={removeBg}
              onChange={(e) => {
                setRemoveBg(e.target.checked)
                run({ tol, removeBg: e.target.checked })
              }}
            />
            Quitar el fondo
          </label>
          {removeBg && (
            <label className="photo-range">
              <span>Cuánto fondo sacar</span>
              <input
                type="range"
                min="0"
                max="100"
                value={tolDraft}
                onChange={(e) => setTolDraft(Number(e.target.value))}
                onPointerUp={() => {
                  setTol(tolDraft)
                  run({ tol: tolDraft, removeBg })
                }}
                onKeyUp={() => {
                  setTol(tolDraft)
                  run({ tol: tolDraft, removeBg })
                }}
              />
              <span className="photo-range-ends">
                <small>Menos</small>
                <small>Más</small>
              </span>
            </label>
          )}
        </div>
      )}

      {shown && (
        <div className="photo-actions">
          <button type="button" className="a-btn ghost" onClick={() => input.current?.click()}>
            Cambiar foto
          </button>
          {onRemove && (
            <button
              type="button"
              className="a-btn ghost danger"
              onClick={() => {
                if (value?.url) URL.revokeObjectURL(value.url)
                srcRef.current = null
                onRemove()
              }}
            >
              Quitar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
