import { useEffect, useState } from 'react'
import { formatPrice } from '../data/products.js'
import { listOrders, setOrderStatus } from './api.js'

// Pedidos que llegaron por la tienda (los mismos que llegan por WhatsApp), para no perder ninguno.
const STATES = [
  ['nuevo', 'Nuevo'],
  ['confirmado', 'Confirmado'],
  ['entregado', 'Entregado'],
  ['cancelado', 'Cancelado'],
]

const when = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

// número argentino para wa.me: 351 123 4567 → 5493511234567
const waNumber = (phone) => {
  let n = phone.replace(/\D/g, '')
  if (n.startsWith('549')) return n
  if (n.startsWith('54')) return '549' + n.slice(2)
  if (n.startsWith('0')) n = n.slice(1)
  return '549' + n.replace(/^(\d{2,4})15/, '$1')
}

export default function OrdersList({ onError }) {
  const [list, setList] = useState(null)
  const [filter, setFilter] = useState('activos')

  const load = async () => {
    try {
      setList(await listOrders())
    } catch (x) {
      onError(x)
    }
  }
  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const change = async (o, status) => {
    setList((l) => l.map((x) => (x.id === o.id ? { ...x, status } : x)))
    try {
      await setOrderStatus(o.id, status)
    } catch (x) {
      onError(x)
      load()
    }
  }

  if (list === null) return <p className="a-tip">Cargando pedidos…</p>
  const shown = list.filter((o) => (filter === 'activos' ? o.status === 'nuevo' || o.status === 'confirmado' : true))

  return (
    <>
      <div className="a-chips a-filter" role="group" aria-label="Qué pedidos ver">
        {[
          ['activos', 'Por atender'],
          ['todos', 'Todos'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={'a-chip' + (filter === id ? ' is-on' : '')} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
        <button type="button" className="a-btn ghost" onClick={load}>
          Actualizar
        </button>
      </div>
      {shown.length === 0 && <div className="a-empty">{filter === 'activos' ? 'No hay pedidos por atender.' : 'Todavía no llegó ningún pedido.'}</div>}
      <ul className="a-list">
        {shown.map((o) => (
          <li key={o.id} className={'a-order st-' + o.status}>
            <div className="a-order-head">
              <span className="a-code">#{o.id}</span>
              <small>{when(o.createdAt)}</small>
              <strong className="a-order-total">{formatPrice(o.total)}</strong>
            </div>
            <p className="a-order-who">
              <b>{o.customerName}</b> · {o.phone}
              <br />
              <small>
                {o.delivery === 'envio' ? `Envío${o.address ? ': ' + o.address : ' (a coordinar)'}` : 'Retira en el local'} · {o.payment}
              </small>
            </p>
            <ul className="a-order-items">
              {o.items.map((i, k) => (
                <li key={k}>
                  <img src={i.image.startsWith('http') ? i.image : o.url.slice(0, o.url.indexOf('/o/')) + i.image} alt="" loading="lazy" />
                  <span>
                    <b>
                      {i.qty}x {i.name}
                    </b>
                    <small>
                      Talle {i.size}
                      {i.color ? ' · ' + i.color : ''}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
            {o.customerMeasures && <p className="a-help">Sus medidas: {o.customerMeasures}</p>}
            {o.note && <p className="a-help">Nota: {o.note}</p>}
            <div className="a-item-actions">
              <a className="a-btn" href={`https://wa.me/${waNumber(o.phone)}`} target="_blank" rel="noreferrer">
                Escribirle
              </a>
              <a className="a-btn ghost" href={o.url} target="_blank" rel="noreferrer">
                Ver pedido
              </a>
              <select className="a-status" value={o.status} aria-label="Estado del pedido" onChange={(e) => change(o, e.target.value)}>
                {STATES.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
