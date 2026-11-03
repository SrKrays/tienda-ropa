import { useState } from 'react'
import { SIZE_ORDER, formatPrice } from '../data/products.js'
import { saveProduct } from './api.js'
import PhotoField from './PhotoField.jsx'

const CATS = [
  ['mujer', 'Mujer'],
  ['hombre', 'Hombre'],
  ['basicos', 'Básicos'],
  ['ofertas', 'Ofertas'],
]
const FITS = [
  ['remera', 'Remera (calce normal)'],
  ['oversize', 'Remera oversize'],
  ['camiseta', 'Camiseta deportiva'],
  ['buzo', 'Buzo / campera'],
]
const TAGS = ['', 'NUEVO', 'ÚLTIMOS', 'LIQUIDACIÓN']
const PRESET_COLORS = ['#1b1a18', '#f4f2ec', '#8f8d88', '#2b2a28', '#1f3a5f', '#1f8fe0', '#7a1f2b', '#3e5b3a', '#c9b48a', '#e8a0b4']

const toNum = (v) => (v === '' || v == null ? null : Math.round(Number(String(v).replace(/[^\d]/g, ''))))

function emptyForm() {
  return {
    name: '',
    description: '',
    price: '',
    oldPrice: '',
    sizes: { S: '', M: '', L: '', XL: '', XXL: '' },
    categories: [],
    fitType: 'remera',
    tag: '',
    tryOn: true,
    colors: [],
    measures: {},
    active: true,
  }
}

function fromProduct(p) {
  return {
    name: p.name,
    description: p.description || '',
    price: String(p.price),
    oldPrice: p.oldPrice ? String(p.oldPrice) : '',
    sizes: Object.fromEntries(SIZE_ORDER.map((s) => [s, p.sizes?.[s] != null ? String(p.sizes[s]) : ''])),
    categories: p.categories || [],
    fitType: p.fitType || 'remera',
    tag: p.tag && !p.tag.startsWith('-') ? p.tag : '',
    tryOn: p.tryOn !== false,
    colors: p.colors || [],
    measures: p.measures || {},
    active: p.active !== false,
  }
}

export default function ProductForm({ product, onDone, onCancel }) {
  const [f, setF] = useState(() => (product ? fromProduct(product) : emptyForm()))
  const [front, setFront] = useState(null)
  const [back, setBack] = useState(null)
  const [removeBack, setRemoveBack] = useState(false)
  // fotos reales opcionales (con fondo): la prenda puesta y un detalle
  const [worn, setWorn] = useState(null)
  const [detail, setDetail] = useState(null)
  const [removeWorn, setRemoveWorn] = useState(false)
  const [removeDetail, setRemoveDetail] = useState(false)
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))

  const price = toNum(f.price)
  const oldPrice = toNum(f.oldPrice)
  const discount = price && oldPrice && oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0

  const validate = () => {
    const e = []
    if (!product && !front) e.push('Falta la foto de frente.')
    if (f.name.trim().length < 2) e.push('Poné el nombre de la prenda.')
    if (!price) e.push('Poné el precio.')
    if (oldPrice && price && oldPrice <= price) e.push('El precio anterior tiene que ser mayor al precio de ahora.')
    if (!SIZE_ORDER.some((s) => f.sizes[s] !== '')) e.push('Cargá el stock de al menos un talle (si no hay, poné 0).')
    return e
  }

  const submit = async (ev) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (e.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const sizes = {}
    for (const s of SIZE_ORDER) if (f.sizes[s] !== '') sizes[s] = Math.max(0, toNum(f.sizes[s]) || 0)
    const measures = {}
    for (const s of Object.keys(sizes)) {
      const m = f.measures[s]
      if (m && toNum(m.ancho)) measures[s] = { ancho: toNum(m.ancho), largo: toNum(m.largo) || 0, manga: toNum(m.manga) || 0 }
    }
    const data = {
      name: f.name.trim(),
      description: f.description.trim(),
      price,
      oldPrice: oldPrice || null,
      tag: f.tag || null,
      categories: f.categories,
      fitType: f.fitType,
      tryOn: f.tryOn,
      colors: f.colors.filter((c) => c.name.trim()),
      sizes,
      measures: Object.keys(measures).length ? measures : null,
      active: f.active,
      removeBack: removeBack && !back,
      removeWorn: removeWorn && !worn,
      removeDetail: removeDetail && !detail,
    }
    setSaving(true)
    try {
      const saved = await saveProduct(product?.id, data, { front: front?.blob, back: back?.blob, worn: worn?.blob, detail: detail?.blob })
      onDone(saved, !product)
    } catch (err) {
      setErrors(err.messages || ['No se pudo guardar. Probá de nuevo.'])
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const backExisting = removeBack ? null : product?.back

  return (
    <form className="a-form" onSubmit={submit} noValidate>
      <div className="a-form-head">
        <button type="button" className="a-btn ghost" onClick={onCancel}>
          ← Volver
        </button>
        <h1>{product ? 'Editar prenda' : 'Nueva prenda'}</h1>
      </div>

      {errors.length > 0 && (
        <div className="a-errors" role="alert">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      <section className="a-card">
        <h2>1. Fotos</h2>
        <p className="a-tip">
          Sacá la foto con la prenda <strong>estirada sobre una pared, mesa o sábana lisa</strong>, de frente y con buena luz. Sin percha y sin
          nada alrededor. El fondo se saca solo. <strong>Prenda clara → fondo oscuro; prenda oscura → fondo claro.</strong>
        </p>
        <div className="a-photos">
          <PhotoField label="Foto de frente" required existing={product?.front} value={front} onChange={setFront} />
          <PhotoField
            label="Foto de espalda"
            hint="Si la tiene, se puede dar vuelta en el perchero"
            existing={backExisting}
            value={back}
            onChange={(v) => {
              setBack(v)
              setRemoveBack(false)
            }}
            onRemove={() => {
              setBack(null)
              setRemoveBack(true)
            }}
          />
        </div>
        <p className="a-tip a-tip-extra">
          <strong>Fotos extra (opcionales):</strong> la prenda <strong>puesta</strong> (en un maniquí o una persona) y un <strong>detalle</strong> de la tela o la estampa. Estas se muestran tal cual, con su fondo.
        </p>
        <div className="a-photos">
          <PhotoField
            label="Foto puesta"
            keepBackground
            existing={removeWorn ? null : product?.worn}
            value={worn}
            onChange={(v) => {
              setWorn(v)
              setRemoveWorn(false)
            }}
            onRemove={() => {
              setWorn(null)
              setRemoveWorn(true)
            }}
          />
          <PhotoField
            label="Foto de detalle"
            keepBackground
            existing={removeDetail ? null : product?.detail}
            value={detail}
            onChange={(v) => {
              setDetail(v)
              setRemoveDetail(false)
            }}
            onRemove={() => {
              setDetail(null)
              setRemoveDetail(true)
            }}
          />
        </div>
      </section>

      <section className="a-card">
        <h2>2. Datos</h2>
        <label className="a-field">
          <span className="field-label">Nombre</span>
          <input type="text" value={f.name} maxLength={120} placeholder="Ej: Remera Básica Blanca" onChange={(e) => set('name')(e.target.value)} />
        </label>
        <label className="a-field">
          <span className="field-label">Descripción</span>
          <textarea
            rows={4}
            value={f.description}
            maxLength={2000}
            placeholder="Tela, calce, detalles… Ej: Remera de algodón peinado, cuello redondo y calce regular."
            onChange={(e) => set('description')(e.target.value)}
          />
        </label>
        <div className="a-row">
          <label className="a-field">
            <span className="field-label">Precio</span>
            <span className="a-money">
              <span>$</span>
              <input type="text" inputMode="numeric" value={f.price} placeholder="12900" onChange={(e) => set('price')(e.target.value.replace(/[^\d]/g, ''))} />
            </span>
            {price ? <small className="a-help">Se ve así: {formatPrice(price)}</small> : null}
          </label>
          <label className="a-field">
            <span className="field-label">
              Precio anterior <small>(solo si está en oferta)</small>
            </span>
            <span className="a-money">
              <span>$</span>
              <input type="text" inputMode="numeric" value={f.oldPrice} placeholder="—" onChange={(e) => set('oldPrice')(e.target.value.replace(/[^\d]/g, ''))} />
            </span>
            {discount > 0 && <small className="a-help ok">Se muestra tachado y con la etiqueta -{discount}%</small>}
          </label>
        </div>
      </section>

      <section className="a-card">
        <h2>3. Talles y stock</h2>
        <p className="a-tip">Poné cuántas hay de cada talle. Si un talle no lo vendés, dejalo vacío. Si se agotó, poné 0.</p>
        <div className="a-sizes">
          {SIZE_ORDER.map((s) => (
            <label key={s} className="a-size">
              <strong>{s}</strong>
              <input
                type="text"
                inputMode="numeric"
                value={f.sizes[s]}
                placeholder="—"
                aria-label={`Stock talle ${s}`}
                onChange={(e) => set('sizes')({ ...f.sizes, [s]: e.target.value.replace(/[^\d]/g, '').slice(0, 4) })}
              />
            </label>
          ))}
        </div>
      </section>

      <details className="a-card a-more">
        <summary>
          <h2>4. Más opciones</h2>
          <small>Categorías, colores, etiqueta y medidas</small>
        </summary>

        <fieldset className="a-fieldset">
          <legend className="field-label">¿En qué secciones aparece?</legend>
          <div className="a-chips">
            {CATS.map(([id, label]) => (
              <label key={id} className={'a-chip' + (f.categories.includes(id) ? ' is-on' : '')}>
                <input
                  type="checkbox"
                  checked={f.categories.includes(id)}
                  onChange={(e) => set('categories')(e.target.checked ? [...f.categories, id] : f.categories.filter((c) => c !== id))}
                />
                {label}
              </label>
            ))}
          </div>
          <small className="a-help">Siempre aparece también en "Todo".</small>
        </fieldset>

        <div className="a-row">
          <label className="a-field">
            <span className="field-label">Tipo de prenda</span>
            <select value={f.fitType} onChange={(e) => {
              set('fitType')(e.target.value)
            }}>
              {FITS.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <small className="a-help">Lo usa la calculadora de talles.</small>
          </label>
          <label className="a-field">
            <span className="field-label">Etiqueta</span>
            <select value={f.tag} onChange={(e) => set('tag')(e.target.value)}>
              {TAGS.map((t) => (
                <option key={t} value={t}>
                  {t || (discount ? `Automática (-${discount}%)` : 'Ninguna')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="a-fieldset">
          <legend className="field-label">Colores disponibles</legend>
          {f.colors.map((c, i) => (
            <div key={i} className="a-color">
              <input type="color" value={c.hex} aria-label="Color" onChange={(e) => set('colors')(f.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} />
              <input
                type="text"
                value={c.name}
                placeholder="Nombre del color"
                maxLength={40}
                onChange={(e) => set('colors')(f.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <button type="button" className="a-btn ghost danger" onClick={() => set('colors')(f.colors.filter((_, j) => j !== i))}>
                Quitar
              </button>
            </div>
          ))}
          {f.colors.length < 8 && (
            <button
              type="button"
              className="a-btn ghost"
              onClick={() => set('colors')([...f.colors, { name: '', hex: PRESET_COLORS[f.colors.length % PRESET_COLORS.length] }])}
            >
              + Agregar color
            </button>
          )}
        </fieldset>

        <fieldset className="a-fieldset">
          <legend className="field-label">
            Medidas reales <small>(opcional, hace exacta la calculadora)</small>
          </legend>
          <p className="a-help">Con la prenda estirada: ancho de axila a axila, largo desde el hombro hasta abajo, manga desde la costura. En cm.</p>
          <div className="a-measures">
            <span />
            <small>Ancho</small>
            <small>Largo</small>
            <small>Manga</small>
            {SIZE_ORDER.filter((s) => f.sizes[s] !== '').map((s) => (
              <MeasureRow key={s} size={s} m={f.measures[s] || {}} onChange={(m) => set('measures')({ ...f.measures, [s]: m })} />
            ))}
          </div>
        </fieldset>
      </details>

      <section className="a-card">
        <label className="a-check big">
          <input type="checkbox" checked={f.active} onChange={(e) => set('active')(e.target.checked)} />
          <span>
            Visible en la tienda
            <small>Si la destildás, queda guardada pero no aparece en el perchero.</small>
          </span>
        </label>
      </section>

      <div className="a-submit">
        <button type="submit" className="a-btn primary big" disabled={saving}>
          {saving ? 'Guardando…' : product ? 'Guardar cambios' : 'Publicar prenda'}
        </button>
        <button type="button" className="a-btn ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function MeasureRow({ size, m, onChange }) {
  const field = (k) => (
    <input
      type="text"
      inputMode="numeric"
      value={m[k] ?? ''}
      placeholder="—"
      aria-label={`${k} talle ${size}`}
      onChange={(e) => onChange({ ...m, [k]: e.target.value.replace(/[^\d]/g, '').slice(0, 3) })}
    />
  )
  return (
    <>
      <strong>{size}</strong>
      {field('ancho')}
      {field('largo')}
      {field('manga')}
    </>
  )
}
