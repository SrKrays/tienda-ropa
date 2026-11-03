import { useEffect, useMemo, useRef, useState } from 'react'
import { WHATSAPP_NUMBER, formatPrice } from '../data/products.js'
import { useCart } from '../store/cart.jsx'
import Sheet from './Sheet.jsx'
import { CheckIcon, WhatsIcon } from './icons.jsx'
import { API_URL } from '../data/catalog.js'
import { createOrder, measureText, personText, savedPerson } from '../lib/order.js'

// Igual que en Bruzz: no hay pago online. El pedido se arma acá con todos los datos
// y llega directo al WhatsApp del local, listo para preparar.

const STORE_NAME = '[MARCA]'
const STEPS = ['Tu carrito', 'Tus datos', 'Enviar pedido']

// Todo se coordina por WhatsApp: acá la persona solo cuenta qué prefiere
const DELIVERY = [
  { id: 'retiro', title: 'Lo retiro / lo busco', text: 'Coordinamos por WhatsApp dónde y cuándo pasás a buscarlo.' },
  { id: 'envio', title: 'Envío a domicilio', text: 'El costo y el día de entrega los coordinamos por WhatsApp.' },
]

const PAYMENTS = [
  { id: 'transferencia', title: 'Transferencia', text: 'Te pasamos el alias por WhatsApp.' },
  { id: 'efectivo', title: 'Efectivo', text: 'Pagás al retirar o al recibir.' },
]

const fecha = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const colorOf = (l) => (l.color && l.product.colors?.length > 1 ? l.color.name.toLowerCase() : null)

// Formato simple para quien atiende, como el de Bruzz:
//   *PEDIDO [MARCA]* · 31/10 18:07
//   Rosa Pérez · 351 123 4567
//   *lo retira* (coordinar dónde)
//   pago: transferencia
//
//   *1x CAMISETA BELGRANO* — $ 54.900
//     talle M · celeste
//     medidas: ancho 52 · largo 72 · manga 21 cm
//
//   *TOTAL: $ 54.900*
//
//   mis medidas: 1,78 m · 75 kg · pecho ~96 cm · le gusta regular
//   foto del pedido: https://…/o/K7P2QX   ← WhatsApp muestra la imagen de las prendas
export function buildMessage(lines, total, data, { orderUrl, person } = {}) {
  const items = lines.map((l) => {
    const det = [`talle ${l.size}`, colorOf(l)].filter(Boolean).join(' · ')
    const med = measureText(l.product, l.size)
    return `*${l.qty}x ${l.product.name.toUpperCase()}* — ${formatPrice(l.product.price * l.qty)}\n  ${det}${med ? `\n  medidas: ${med}` : ''}`
  })
  const pago = PAYMENTS.find((p) => p.id === data.payment)?.title.toLowerCase()
  const entrega =
    data.delivery === 'envio'
      ? `*envío* a domicilio${data.address.trim() ? ': ' + data.address.trim() + (data.city.trim() ? ', ' + data.city.trim() : '') : ' (dirección a coordinar)'}`
      : '*lo retira* (coordinar dónde)'
  return [
    `*PEDIDO ${STORE_NAME}* · ${fecha()}`,
    `${data.name.trim()} · ${data.phone.trim()}`,
    entrega,
    `pago: ${pago}`,
    '',
    items.join('\n\n'),
    data.note.trim() ? `\nnota: ${data.note.trim()}` : null,
    '',
    data.delivery === 'envio' ? `*TOTAL: ${formatPrice(total)}* (+ envío a coordinar)` : `*TOTAL: ${formatPrice(total)}*`,
    person ? `\nmis medidas: ${person}` : null,
    orderUrl ? `\nfoto del pedido: ${orderUrl}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

function Options({ name, list, value, onChange, legend }) {
  return (
    <fieldset className="options-fs">
      <legend className="field-label">{legend}</legend>
      <div className="options">
        {list.map((o) => (
          <label key={o.id} className={'option' + (value === o.id ? ' is-on' : '')}>
            <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
            <span>
              <strong>{o.title}</strong>
              <small>{o.text}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function CheckoutSheet({ open, onClose }) {
  const { lines, count, total, dispatch } = useCart()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [data, setData] = useState({
    name: '',
    phone: '',
    delivery: 'retiro',
    address: '',
    city: '',
    payment: 'transferencia',
    note: '',
    sendMeasures: true,
  })
  const [errors, setErrors] = useState({})
  // pedido guardado en la API: da el link con la foto de las prendas para el mensaje
  const [order, setOrder] = useState({ status: 'idle' })
  const orderKey = useRef(null)
  const person = useMemo(() => (open ? personText(savedPerson()) : null), [open])

  useEffect(() => {
    if (open) {
      setStep(0)
      setDone(false)
      setErrors({})
    }
  }, [open])

  const set = (k) => (e) => setData((d) => ({ ...d, [k]: typeof e === 'string' ? e : e.target.value }))
  const extra = { person: data.sendMeasures ? person : null }
  const message = useMemo(
    () => buildMessage(lines, total, data, { ...extra, orderUrl: order.status === 'ok' ? order.url : null }),
    [lines, total, data, person, order] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // al llegar al último paso se crea el pedido (así el botón de WhatsApp abre al instante, sin bloqueos del navegador)
  useEffect(() => {
    if (step !== 2 || !API_URL || lines.length === 0) return
    const key = JSON.stringify([lines.map((l) => [l.key, l.qty]), data, person])
    if (orderKey.current === key && order.status !== 'error') return
    orderKey.current = key
    let alive = true
    setOrder({ status: 'loading' })
    const slow = setTimeout(() => alive && setOrder((o) => (o.status === 'loading' ? { status: 'slow' } : o)), 12000)
    createOrder(lines, total, data, { customerMeasures: data.sendMeasures ? person : null })
      .then((r) => {
        if (!alive) return
        if (r?.url) setOrder({ status: 'ok', url: r.url, id: r.id })
        else setOrder({ status: 'error', error: r?.error })
      })
      .catch(() => alive && setOrder({ status: 'error' }))
      .finally(() => clearTimeout(slow))
    return () => {
      alive = false
      clearTimeout(slow)
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps
  const preparing = order.status === 'loading'

  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`

  const validate = () => {
    const e = {}
    if (!data.name.trim()) e.name = 'Escribí tu nombre'
    if (data.phone.replace(/\D/g, '').length < 8) e.phone = 'Escribí un teléfono para poder contactarte'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (step === 1 && !validate()) return
    setStep(step + 1)
  }

  const send = () => {
    window.open(waHref, '_blank', 'noopener')
    setDone(true)
  }

  return (
    <Sheet open={open} onClose={onClose} label="Carrito y pedido">
      {done ? (
        <div className="done">
          <span className="done-icon">
            <CheckIcon />
          </span>
          <h2>¡Listo, {data.name.trim().split(' ')[0]}!</h2>
          <p>Se abrió WhatsApp con tu pedido. Solo tenés que tocar enviar y te respondemos para confirmar.</p>
          <a className="btn-ghost wa" href={waHref} target="_blank" rel="noreferrer">
            <WhatsIcon /> No se abrió, volver a intentar
          </a>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              dispatch({ type: 'clear' })
              onClose()
            }}
          >
            Volver a la tienda
          </button>
        </div>
      ) : (
        <div className="checkout">
          <ol className="steps" aria-label="Pasos del pedido">
            {STEPS.map((s, i) => (
              <li key={s} className={i === step ? 'is-on' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
                <span className="step-n">{i < step ? '✓' : i + 1}</span>
                <span className="step-t">{s}</span>
              </li>
            ))}
          </ol>

          <div className="checkout-grid">
            <div className="checkout-main">
              {step === 0 &&
                (lines.length === 0 ? (
                  <div className="empty">
                    <h2>Tu carrito está vacío</h2>
                    <p>Elegí un talle debajo de la prenda y tocá Agregar.</p>
                    <button type="button" className="btn-primary" onClick={onClose}>
                      Ver prendas
                    </button>
                  </div>
                ) : (
                  <ul className="lines">
                    {lines.map((l) => (
                      <li key={l.key} className="line">
                        <img src={l.product.front} alt="" width="88" height="84" />
                        <div className="line-info">
                          <strong>{l.product.name}</strong>
                          <span>
                            Talle {l.size}
                            {colorOf(l) ? ' · ' + l.color.name : ''}
                          </span>
                          <span className="line-price">{formatPrice(l.product.price * l.qty)}</span>
                        </div>
                        <div className="line-actions">
                          <div className="qty">
                            <button type="button" aria-label="Una menos" onClick={() => dispatch({ type: 'qty', key: l.key, delta: -1 })}>
                              −
                            </button>
                            <output>{l.qty}</output>
                            <button type="button" aria-label="Una más" onClick={() => dispatch({ type: 'qty', key: l.key, delta: 1 })}>
                              +
                            </button>
                          </div>
                          <button type="button" className="link" onClick={() => dispatch({ type: 'remove', key: l.key })}>
                            Quitar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ))}

              {step === 1 && (
                <div className="form">
                  <h2>Tus datos para el pedido</h2>
                  <p className="coord-note">
                    <WhatsIcon /> No pagás nada acá: con tu pedido te escribimos por WhatsApp para coordinar el pago y la entrega.
                  </p>
                  <label className="field">
                    <span className="field-label">Nombre y apellido</span>
                    <input value={data.name} onChange={set('name')} autoComplete="name" />
                  </label>
                  {errors.name && <p className="warn">{errors.name}</p>}
                  <label className="field">
                    <span className="field-label">Teléfono</span>
                    <input value={data.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="Ej: 351 123 4567" />
                  </label>
                  {errors.phone && <p className="warn">{errors.phone}</p>}

                  <Options name="delivery" legend="¿Cómo lo recibís?" list={DELIVERY} value={data.delivery} onChange={set('delivery')} />
                  {data.delivery === 'envio' && (
                    <>
                      <label className="field">
                        <span className="field-label">Dirección (opcional, también la podés pasar por WhatsApp)</span>
                        <input value={data.address} onChange={set('address')} autoComplete="street-address" />
                      </label>
                      {errors.address && <p className="warn">{errors.address}</p>}
                      <label className="field">
                        <span className="field-label">Barrio o ciudad (opcional)</span>
                        <input value={data.city} onChange={set('city')} autoComplete="address-level2" />
                      </label>
                    </>
                  )}

                  <Options name="payment" legend="¿Cómo preferís pagar?" list={PAYMENTS} value={data.payment} onChange={set('payment')} />

                  <label className="field">
                    <span className="field-label">¿Algo más? (opcional)</span>
                    <input value={data.note} onChange={set('note')} placeholder="Ej: es para regalo" />
                  </label>

                  {person && (
                    <label className="option send-meas">
                      <input type="checkbox" checked={data.sendMeasures} onChange={(e) => setData((d) => ({ ...d, sendMeasures: e.target.checked }))} />
                      <span>
                        <strong>Mandar mis medidas con el pedido</strong>
                        <small>{person}</small>
                      </span>
                    </label>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="form">
                  <h2>Así nos llega tu pedido</h2>
                  <p className="preview-hint">
                    Al tocar el botón se abre WhatsApp con este mensaje listo. Lo enviás y te respondemos para coordinar el pago y la entrega.
                  </p>
                  <pre className="wa-preview">{message}</pre>
                  {API_URL && (
                    <p className={'order-link' + (order.status === 'error' ? ' bad' : '')} role="status">
                      {preparing
                        ? 'Preparando la foto de tus prendas para el mensaje…'
                        : order.status === 'ok'
                          ? 'El mensaje lleva un link con la foto de tus prendas, talles y medidas.'
                          : order.status === 'slow'
                            ? 'La foto tarda más de lo normal: podés enviar igual, el pedido llega completo.'
                            : order.status === 'error'
                              ? (order.error || 'No se pudo preparar la foto.') + ' Podés enviar igual: el pedido llega completo.'
                              : null}
                    </p>
                  )}
                </div>
              )}
            </div>

            {lines.length > 0 && (
              <aside className="checkout-side">
                <p className="side-title">
                  Tu pedido · {count} {count === 1 ? 'prenda' : 'prendas'}
                </p>
                <ul className="side-lines">
                  {lines.map((l) => (
                    <li key={l.key}>
                      <img src={l.product.front} alt="" width="44" height="42" />
                      <span className="sl-info">
                        <strong>
                          {l.qty}x {l.product.name}
                        </strong>
                        <small>
                          Talle {l.size}
                          {colorOf(l) ? ' · ' + l.color.name : ''}
                        </small>
                      </span>
                      <span className="sl-price">{formatPrice(l.product.price * l.qty)}</span>
                    </li>
                  ))}
                </ul>
                {step >= 1 && data.name.trim() && (
                  <p className="side-meta">
                    {data.delivery === 'envio' ? 'Envío a domicilio' : 'Lo retira / lo busca'} ·{' '}
                    {PAYMENTS.find((p) => p.id === data.payment)?.title}
                  </p>
                )}
                <p className="sum-total">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </p>
                <p className="side-note">{data.delivery === 'envio' ? '+ envío · ' : ''}Pago y entrega se coordinan por WhatsApp</p>
                {step < 2 ? (
                  <button type="button" className="btn-primary" onClick={next}>
                    Continuar
                  </button>
                ) : (
                  <button type="button" className="btn-primary wa-btn" onClick={send} disabled={preparing}>
                    <WhatsIcon /> {preparing ? 'Preparando…' : 'Enviar por WhatsApp'}
                  </button>
                )}
                {step > 0 && (
                  <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>
                    Volver
                  </button>
                )}
              </aside>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}
