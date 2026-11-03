import { useMemo, useState } from 'react'
import { SIZE_ORDER } from '../data/products.js'
import { FIT_PREFS, compareTee, fitOf, measuresOf, personChest, recommend, recommendFromTee } from '../fit/sizing.js'

// Calculadora de talle. Dos formas de usarla:
//  1. "Con mis datos": altura, peso (y pecho si lo sabe) + cómo le gusta que le quede.
//  2. "Con una remera mía": mide una remera propia que le queda bien y la comparamos talle por talle.
// Al tocar un talle, la foto de la izquierda muestra cómo le quedaría puesta.

function NumField({ label, value, onChange, min, max, step = 1, unit, optional }) {
  return (
    <label className="sf-field">
      <span className="field-label">
        {label} {optional && <small>(opcional)</small>}
      </span>
      <span className="sf-num">
        <button type="button" aria-label={`Menos ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, Number(value || min) - step))}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value ?? ''}
          placeholder={optional ? '—' : undefined}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
        <span className="sf-unit">{unit}</span>
        <button type="button" aria-label={`Más ${label.toLowerCase()}`} onClick={() => onChange(Math.min(max, Number(value || min) + step))}>
          +
        </button>
      </span>
    </label>
  )
}

const MODES = [
  ['datos', 'Con mis datos'],
  ['remera', 'Con mi remera'],
]

function HowTo({ mode }) {
  return (
    <details className="sf-how">
      <summary>¿Cómo me mido?</summary>
      {mode === 'datos' ? (
        <ol>
          <li>Con un centímetro de costura, rodeá el pecho por debajo de las axilas, a la altura de las tetillas.</li>
          <li>Que quede derecho y sin apretar, con los brazos relajados al costado.</li>
          <li>Si no tenés centímetro, dejalo vacío: lo calculamos con tu altura y peso.</li>
        </ol>
      ) : (
        <ol>
          <li>Buscá una remera tuya que te quede como te gusta y estirala sobre una mesa.</li>
          <li>
            <strong>Ancho:</strong> de axila a axila, de un costado al otro.
          </li>
          <li>
            <strong>Largo:</strong> desde el hombro, al lado del cuello, hasta el ruedo de abajo.
          </li>
        </ol>
      )}
    </details>
  )
}

export default function SizeFinder({ product, person, setPerson, size, onPickSize }) {
  const sizes = SIZE_ORDER.filter((s) => product.sizes[s] != null)
  const [mode, setMode] = useState(person.mode || 'datos')
  const tee = person.tee || { ancho: null, largo: null }
  const valid = person.height >= 140 && person.height <= 215 && person.weight >= 35 && person.weight <= 180
  const teeValid = tee.ancho >= 35 && tee.ancho <= 90 && tee.largo >= 50 && tee.largo <= 100
  const rec = useMemo(() => (valid ? recommend(product, person, sizes) : null), [product, person, valid]) // eslint-disable-line react-hooks/exhaustive-deps
  const teeRec = useMemo(() => (teeValid ? recommendFromTee(product, tee, sizes) : null), [product, tee.ancho, tee.largo, teeValid]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (v) => setPerson({ ...person, [k]: v })
  const setTee = (k) => (v) => setPerson({ ...person, tee: { ...tee, [k]: v } })
  const pickMode = (m) => {
    setMode(m)
    setPerson({ ...person, mode: m })
  }

  const best = mode === 'datos' ? rec : teeRec

  return (
    <section className="size-finder" aria-label="Calculadora de talle">
      <div className="sf-modes" role="tablist" aria-label="Cómo querés calcular tu talle">
        {MODES.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} className={'sf-mode' + (mode === id ? ' is-on' : '')} onClick={() => pickMode(id)}>
            {label}
          </button>
        ))}
      </div>

      {mode === 'datos' ? (
        <>
          <p className="sf-intro">Completá tus datos y te decimos cómo te queda cada talle.</p>
          <div className="sf-body" role="group" aria-label="Tipo de cuerpo">
            {[
              ['hombre', 'Hombre'],
              ['mujer', 'Mujer'],
            ].map(([id, label]) => (
              <button key={id} type="button" className={'sf-chip' + (person.body === id ? ' is-on' : '')} aria-pressed={person.body === id} onClick={() => set('body')(id)}>
                {label}
              </button>
            ))}
          </div>

          <div className="sf-grid">
            <NumField label="Altura" value={person.height} onChange={set('height')} min={140} max={215} unit="cm" />
            <NumField label="Peso" value={person.weight} onChange={set('weight')} min={35} max={180} unit="kg" />
            <NumField label="Contorno de pecho" value={person.chest} onChange={set('chest')} min={70} max={150} unit="cm" optional />
          </div>
          <HowTo mode="datos" />

          <p className="field-label">¿Cómo te gusta que te quede?</p>
          <div className="sf-prefs" role="group" aria-label="Cómo te gusta que te quede">
            {FIT_PREFS.map((p) => (
              <button key={p.id} type="button" className={'sf-pref' + (person.pref === p.id ? ' is-on' : '')} aria-pressed={person.pref === p.id} onClick={() => set('pref')(p.id)}>
                <strong>{p.label}</strong>
                <small>{p.hint}</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="sf-intro">Medí una remera tuya que te quede bien y la comparamos con cada talle de esta prenda.</p>
          <div className="sf-grid">
            <NumField label="Ancho de tu remera" value={tee.ancho} onChange={setTee('ancho')} min={35} max={90} unit="cm" />
            <NumField label="Largo de tu remera" value={tee.largo} onChange={setTee('largo')} min={50} max={100} unit="cm" />
          </div>
          <HowTo mode="remera" />
        </>
      )}

      {mode === 'datos' && !valid && <p className="warn">Revisá la altura y el peso.</p>}
      {mode === 'remera' && !teeValid && <p className="sf-note sf-wait">Poné el ancho y el largo de tu remera para ver el resultado.</p>}

      {best && (
        <>
          <div className="sf-result" role="status">
            <span className="sf-badge">{best.size}</span>
            <p>
              <strong>Te recomendamos el talle {best.size}.</strong>
              <br />
              {mode === 'datos'
                ? `${best.chestTxt[0].toUpperCase() + best.chestTxt.slice(1)}, ${best.lenTxt} y ${best.sleeveTxt}.`
                : `Comparada con tu remera: ${best.anchoTxt} y ${best.largoTxt}.`}
              {best.stock === 0 && <em> Ahora no hay stock de este talle: consultanos por WhatsApp.</em>}
            </p>
          </div>
          {mode === 'datos' && !person.chest && (
            <p className="sf-note">Calculamos tu pecho aproximado ({personChest(person)} cm) con tu altura y peso. Si lo medís, el resultado es más exacto.</p>
          )}

          <ul className="sf-sizes" aria-label="Cómo te queda cada talle">
            {sizes.map((s) => {
              const m = measuresOf(product, s)
              const stock = product.sizes[s] ?? 0
              let title
              if (mode === 'datos') {
                const f = fitOf(product, s, person)
                title = `${f.chestTxt}, ${f.lenTxt}`
              } else {
                const c = compareTee(product, s, tee)
                title = `${c.anchoTxt}, ${c.largoTxt}`
              }
              return (
                <li key={s}>
                  <button
                    type="button"
                    className={'sf-row' + (size === s ? ' is-on' : '') + (best.size === s ? ' is-rec' : '')}
                    aria-pressed={size === s}
                    onClick={() => onPickSize(s)}
                  >
                    <span className="sf-size">{s}</span>
                    <span className="sf-desc">
                      <strong>{title}</strong>
                      <small>
                        Ancho {m.ancho} cm · Largo {m.largo} cm · Manga {m.manga} cm{stock === 0 ? ' · sin stock' : ''}
                      </small>
                    </span>
                    {best.size === s && <span className="sf-tag">Recomendado</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="sf-note">Tocá un talle para elegirlo y ver en el dibujo cómo te queda. Medidas de la prenda estirada: ancho de axila a axila, largo desde el hombro.</p>
        </>
      )}
    </section>
  )
}
