import { useEffect, useMemo, useState } from 'react'
import { WHATSAPP_NUMBER, formatPrice } from '../data/products.js'
import { useCart } from '../store/cart.jsx'
import Sheet from './Sheet.jsx'
import { CheckIcon, WhatsIcon } from './icons.jsx'

// Como en Bruzz: no hay pago online ni envíos. El pedido se arma acá
// y llega directo al WhatsApp del local, que coordina el pago y la entrega.

const STEPS = ['Tu carrito', 'Tus datos', 'Enviar pedido']

const PAYMENTS = [
  { id: 'Transferencia', text: 'Te pasamos el alias por WhatsApp.' },
  { id: 'Efectivo', text: 'Pagás en el local.' },
  { id: 'Mercado Pago', text: 'Te mandamos el link de pago.' },
]

function buildMessage(lines, total, data) {
  const items = lines
    .map((l) => `• ${l.qty} x ${l.product.name} — talle ${l.size} — ${formatPrice(l.product.price * l.qty)}`)
    .join('\n')
  return [
    '¡Hola! Quiero hacer este pedido 🛍️',
    '',
    items,
    '',
    `*Total: ${formatPrice(total)}*`,
    '',
    `Nombre: ${data.name.trim()}`,
    `Pago: ${data.payment}`,
    data.note.trim() ? `Nota: ${data.note.trim()}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

export default function CheckoutSheet({ open, onClose }) {
  const { lines, count, total, dispatch } = useCart()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [data, setData] = useState({ name: '', payment: 'Transferencia', note: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setStep(0)
      setDone(false)
      setError('')
    }
  }, [open])

  const message = useMemo(() => buildMessage(lines, total, data), [lines, total, data])
  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`

  const next = () => {
    if (step === 1 && !data.name.trim()) {
      setError('Escribí tu nombre así sabemos de quién es el pedido')
      return
    }
    setError('')
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
          <p>Se abrió WhatsApp con tu pedido. Solo tenés que tocar enviar y te respondemos para coordinar el pago y la entrega.</p>
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
                    <p>Tocá una prenda del perchero para verla y agregarla.</p>
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
                          <span>Talle {l.size}</span>
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
                  <h2>¿A nombre de quién?</h2>
                  <label className="field">
                    <span className="field-label">Nombre y apellido</span>
                    <input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} autoComplete="name" />
                  </label>
                  {error && (
                    <p className="warn" role="alert">
                      {error}
                    </p>
                  )}
                  <fieldset className="options-fs">
                    <legend className="field-label">¿Cómo preferís pagar?</legend>
                    <div className="options">
                      {PAYMENTS.map((p) => (
                        <label key={p.id} className={'option' + (data.payment === p.id ? ' is-on' : '')}>
                          <input
                            type="radio"
                            name="payment"
                            value={p.id}
                            checked={data.payment === p.id}
                            onChange={() => setData({ ...data, payment: p.id })}
                          />
                          <span>
                            <strong>{p.id}</strong>
                            <small>{p.text}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="field">
                    <span className="field-label">¿Algo más que nos quieras decir? (opcional)</span>
                    <input value={data.note} onChange={(e) => setData({ ...data, note: e.target.value })} placeholder="Ej: lo paso a buscar el sábado" />
                  </label>
                </div>
              )}

              {step === 2 && (
                <div className="form">
                  <h2>Así nos llega tu pedido</h2>
                  <p className="preview-hint">Al tocar el botón se abre WhatsApp con este mensaje listo. Solo tenés que enviarlo.</p>
                  <pre className="wa-preview">{message}</pre>
                </div>
              )}
            </div>

            {lines.length > 0 && (
              <aside className="checkout-side">
                <p className="sum-row">
                  <span>
                    {count} {count === 1 ? 'prenda' : 'prendas'}
                  </span>
                  <span>{formatPrice(total)}</span>
                </p>
                <p className="sum-total">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </p>
                {step < 2 ? (
                  <button type="button" className="btn-primary" onClick={next}>
                    Continuar
                  </button>
                ) : (
                  <button type="button" className="btn-primary wa-btn" onClick={send}>
                    <WhatsIcon /> Enviar por WhatsApp
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
