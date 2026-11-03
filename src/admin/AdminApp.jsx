import { useCallback, useEffect, useState } from 'react'
import { API_URL, normalize } from '../data/catalog.js'
import { PRODUCTS as DEMO, formatPrice } from '../data/products.js'
import { deleteProduct, getToken, listProducts, login, logout, saveOrder, saveProduct, setActive } from './api.js'
import ProductForm from './ProductForm.jsx'

// Panel del local: entrar con la contraseña, ver las prendas, cargar / editar / esconder / borrar.
// Todo grande y con palabras simples: lo usa el dueño desde el celular.

function Login({ onIn }) {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!pw) return
    setBusy(true)
    setErr(null)
    try {
      await login(pw)
      onIn()
    } catch (x) {
      setErr(x.messages?.join(' ') || 'No se pudo entrar.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="a-login" onSubmit={submit}>
      <p className="a-brand">[MARCA]</p>
      <h1>Panel del local</h1>
      <p className="a-tip">Desde acá cargás las prendas que se ven en la tienda.</p>
      <label className="a-field">
        <span className="field-label">Contraseña</span>
        <span className="a-pw">
          <input type={show ? 'text' : 'password'} value={pw} autoComplete="current-password" autoFocus onChange={(e) => setPw(e.target.value)} />
          <button type="button" className="a-btn ghost" onClick={() => setShow(!show)}>
            {show ? 'Ocultar' : 'Ver'}
          </button>
        </span>
      </label>
      {err && (
        <p className="a-warn" role="alert">
          {err}
        </p>
      )}
      <button type="submit" className="a-btn primary big" disabled={busy || !pw}>
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
      {!API_URL && <p className="a-warn">Falta configurar VITE_API_URL: el panel no tiene a dónde conectarse.</p>}
    </form>
  )
}

const stockOf = (p) => Object.values(p.sizes || {}).reduce((a, n) => a + n, 0)

function ProductRow({ p, first, last, onEdit, onMove, onToggle, onDelete }) {
  const [confirm, setConfirm] = useState(false)
  const stock = stockOf(p)
  return (
    <li className={'a-item' + (p.active ? '' : ' is-off')}>
      <div className="a-thumb">
        <img src={normalize(p).front} alt="" loading="lazy" />
      </div>
      <div className="a-item-info">
        <strong>{p.name}</strong>
        <span>
          {formatPrice(p.price)}
          {p.oldPrice ? <s>{formatPrice(p.oldPrice)}</s> : null}
        </span>
        <small className={stock === 0 ? 'bad' : stock <= 3 ? 'low' : ''}>
          {stock === 0 ? 'Sin stock' : `${stock} en stock`} ·{' '}
          {Object.entries(p.sizes || {})
            .map(([s, n]) => `${s}: ${n}`)
            .join('  ')}
        </small>
        {!p.active && <small className="bad">Escondida: no se ve en la tienda</small>}
      </div>
      <div className="a-item-actions">
        <button type="button" className="a-btn" onClick={onEdit}>
          Editar
        </button>
        <button type="button" className="a-btn ghost" onClick={onToggle}>
          {p.active ? 'Esconder' : 'Mostrar'}
        </button>
        <div className="a-move" role="group" aria-label="Mover en el perchero">
          <button type="button" className="a-btn ghost" disabled={first} aria-label="Mover antes" onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" className="a-btn ghost" disabled={last} aria-label="Mover después" onClick={() => onMove(1)}>
            ↓
          </button>
        </div>
        {!confirm ? (
          <button type="button" className="a-btn ghost danger" onClick={() => setConfirm(true)}>
            Borrar
          </button>
        ) : (
          <span className="a-confirm">
            ¿Seguro?
            <button type="button" className="a-btn danger" onClick={onDelete}>
              Sí, borrar
            </button>
            <button type="button" className="a-btn ghost" onClick={() => setConfirm(false)}>
              No
            </button>
          </span>
        )}
      </div>
    </li>
  )
}

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => !!getToken())
  const [list, setList] = useState(null)
  const [err, setErr] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | product
  const [toast, setToast] = useState(null)
  const [importing, setImporting] = useState(false)

  const say = (msg) => {
    setToast(msg)
    clearTimeout(say.t)
    say.t = setTimeout(() => setToast(null), 3500)
  }

  const handle = useCallback((x) => {
    if (x.status === 401) setAuthed(false)
    setErr(x.messages?.join(' ') || 'Algo salió mal.')
  }, [])

  const load = useCallback(async () => {
    setErr(null)
    try {
      setList(await listProducts())
    } catch (x) {
      handle(x)
    }
  }, [handle])

  useEffect(() => {
    if (authed) load()
  }, [authed, load])

  const move = async (i, dir) => {
    const next = list.slice()
    const [it] = next.splice(i, 1)
    next.splice(i + dir, 0, it)
    setList(next)
    try {
      await saveOrder(next.map((p) => p.id))
    } catch (x) {
      handle(x)
      load()
    }
  }

  const toggle = async (p) => {
    try {
      const u = await setActive(p.id, !p.active)
      setList((l) => l.map((x) => (x.id === u.id ? u : x)))
      say(u.active ? 'Listo: ya se ve en la tienda.' : 'Listo: quedó escondida.')
    } catch (x) {
      handle(x)
    }
  }

  const remove = async (p) => {
    try {
      await deleteProduct(p.id)
      setList((l) => l.filter((x) => x.id !== p.id))
      say('Prenda borrada.')
    } catch (x) {
      handle(x)
    }
  }

  // carga las 4 prendas de prueba del boceto (sirve para probar el panel y la tienda con la API)
  const importDemo = async () => {
    setImporting(true)
    setErr(null)
    try {
      for (const d of [...DEMO].reverse()) {
        const blob = async (u) => (u ? (await fetch(u)).blob() : null)
        await saveProduct(
          null,
          {
            name: d.name,
            description: d.description,
            price: d.price,
            oldPrice: d.oldPrice || null,
            tag: d.tag && !d.tag.startsWith('-') ? d.tag : null,
            categories: d.categories,
            fitType: d.fitType,
            tryOn: d.tryOn !== false,
            colors: d.colors,
            sizes: d.sizes,
            active: true,
          },
          await blob(d.front),
          await blob(d.back)
        )
      }
      await load()
      say('Se cargaron las prendas de ejemplo.')
    } catch (x) {
      handle(x)
    } finally {
      setImporting(false)
    }
  }

  if (!authed) return <Login onIn={() => setAuthed(true)} />

  if (editing) {
    return (
      <div className="a-shell">
        <ProductForm
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onDone={(saved, isNew) => {
            setEditing(null)
            setList((l) => (isNew ? [saved, ...(l || [])] : (l || []).map((x) => (x.id === saved.id ? saved : x))))
            say(isNew ? '¡Listo! La prenda ya está en la tienda.' : 'Cambios guardados.')
            window.scrollTo({ top: 0 })
          }}
        />
        {toast && <div className="a-toast">{toast}</div>}
      </div>
    )
  }

  return (
    <div className="a-shell">
      <header className="a-top">
        <div>
          <p className="a-brand">[MARCA]</p>
          <h1>Mis prendas</h1>
        </div>
        <div className="a-top-actions">
          <a className="a-btn ghost" href="/" target="_blank" rel="noreferrer">
            Ver la tienda
          </a>
          <button
            type="button"
            className="a-btn ghost"
            onClick={() => {
              logout()
              setAuthed(false)
            }}
          >
            Salir
          </button>
        </div>
      </header>

      <button type="button" className="a-btn primary big a-new" onClick={() => setEditing('new')}>
        + Cargar prenda nueva
      </button>

      {err && (
        <div className="a-errors" role="alert">
          <p>{err}</p>
          <button type="button" className="a-btn ghost" onClick={load}>
            Reintentar
          </button>
        </div>
      )}

      {list === null && !err && <p className="a-tip">Cargando…</p>}

      {list?.length === 0 && (
        <div className="a-empty">
          <p>Todavía no cargaste ninguna prenda.</p>
          <button type="button" className="a-btn ghost" onClick={importDemo} disabled={importing}>
            {importing ? 'Cargando ejemplos…' : 'Cargar las 4 prendas de ejemplo'}
          </button>
        </div>
      )}

      {list?.length > 0 && (
        <>
          <p className="a-help">El orden de esta lista es el orden del perchero. Las prendas nuevas aparecen primero.</p>
          <ul className="a-list">
            {list.map((p, i) => (
              <ProductRow
                key={p.id}
                p={p}
                first={i === 0}
                last={i === list.length - 1}
                onEdit={() => setEditing(normalize(p))}
                onMove={(dir) => move(i, dir)}
                onToggle={() => toggle(p)}
                onDelete={() => remove(p)}
              />
            ))}
          </ul>
        </>
      )}
      {toast && (
        <div className="a-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
