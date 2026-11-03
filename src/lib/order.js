import { API_URL } from '../data/catalog.js'
import { formatPrice } from '../data/products.js'
import { DEFAULT_PERSON, FIT_PREFS, measuresOf, personChest } from '../fit/sizing.js'

// ---------- medidas de la persona (si usó la calculadora) ----------
export function savedPerson() {
  try {
    const raw = localStorage.getItem('mis-medidas')
    return raw ? { ...DEFAULT_PERSON, ...JSON.parse(raw) } : null
  } catch {
    return null
  }
}

// "1,78 m · 75 kg · pecho ~96 cm · le gusta regular"  /  "su remera: ancho 57 · largo 73 cm"
export function personText(p) {
  if (!p) return null
  if (p.mode === 'remera' && p.tee?.ancho && p.tee?.largo) return `una remera suya que le queda bien mide ancho ${p.tee.ancho} · largo ${p.tee.largo} cm`
  if (!p.height || !p.weight) return null
  const pref = FIT_PREFS.find((x) => x.id === p.pref)?.label.toLowerCase()
  const chest = p.chest ? `pecho ${p.chest} cm` : `pecho ~${personChest(p)} cm`
  return [`${(p.height / 100).toFixed(2).replace('.', ',')} m`, `${p.weight} kg`, chest, pref && `le gusta ${pref}`].filter(Boolean).join(' · ')
}

export function measureText(product, size) {
  const m = measuresOf(product, size)
  if (!m) return null
  return `ancho ${m.ancho} · largo ${m.largo}${m.manga ? ` · manga ${m.manga}` : ''} cm`
}

// ---------- imagen del pedido (la vista previa que muestra WhatsApp) ----------
const W = 1200
const H = 630

function loadImg(src) {
  return new Promise((res) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => res(i)
    i.onerror = () => res(null)
    i.src = src
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fitText(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 3 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

export async function buildOrderImage(lines, total, { store = '[MARCA]', customer = '' } = {}) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  try {
    await document.fonts?.load('800 40px "Archivo Variable"')
  } catch {
    /* sin fuente: usa la del sistema */
  }
  const F = (w, px) => `${w} ${px}px "Archivo Variable", "Atkinson Hyperlegible", system-ui, sans-serif`

  // fondo: el grafito cálido del local con luz de spot
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1d1b15')
  g.addColorStop(1, '#0d0c09')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const spot = ctx.createRadialGradient(W / 2, 120, 40, W / 2, 200, 620)
  spot.addColorStop(0, 'rgba(255,226,160,0.16)')
  spot.addColorStop(1, 'rgba(255,226,160,0)')
  ctx.fillStyle = spot
  ctx.fillRect(0, 0, W, H)

  // encabezado
  ctx.fillStyle = '#d8c7a0'
  ctx.font = F(700, 22)
  ctx.fillText(store.toUpperCase().split('').join(' '), 48, 62)
  ctx.fillStyle = '#f0ebdd'
  ctx.font = F(800, 40)
  ctx.fillText(customer ? fitText(ctx, `Pedido de ${customer}`, 760) : 'Nuevo pedido', 48, 112)

  // prendas (hasta 4; si hay más, la última tarjeta dice "+N")
  const shown = lines.length > 4 ? lines.slice(0, 3) : lines
  const extra = lines.length - shown.length
  const cards = shown.length + (extra ? 1 : 0)
  const gap = 20
  const cw = Math.min(260, (W - 96 - gap * (cards - 1)) / cards)
  const ch = 380
  const x0 = (W - (cw * cards + gap * (cards - 1))) / 2
  const y0 = 150
  const imgs = await Promise.all(shown.map((l) => loadImg(l.product.front)))

  shown.forEach((l, i) => {
    const x = x0 + i * (cw + gap)
    roundRect(ctx, x, y0, cw, ch, 22)
    ctx.fillStyle = 'rgba(40,37,29,0.85)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(238,223,193,0.18)'
    ctx.lineWidth = 2
    ctx.stroke()
    const im = imgs[i]
    if (im) {
      const bw = cw - 36
      const bh = 250
      const k = Math.min(bw / im.width, bh / im.height)
      const iw = im.width * k
      const ih = im.height * k
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur = 24
      ctx.shadowOffsetY = 12
      ctx.drawImage(im, x + (cw - iw) / 2, y0 + 18 + (bh - ih) / 2, iw, ih)
      ctx.restore()
    }
    // talle grande, que se lea de un vistazo
    const pill = `TALLE ${l.size}${l.qty > 1 ? `  ×${l.qty}` : ''}`
    ctx.font = F(800, 24)
    const pw = ctx.measureText(pill).width + 32
    roundRect(ctx, x + (cw - pw) / 2, y0 + 282, pw, 42, 21)
    ctx.fillStyle = '#eedfc1'
    ctx.fill()
    ctx.fillStyle = '#1a1712'
    ctx.textAlign = 'center'
    ctx.fillText(pill, x + cw / 2, y0 + 311)
    ctx.font = F(600, 19)
    ctx.fillStyle = '#ede6d6'
    ctx.fillText(fitText(ctx, l.product.name, cw - 24), x + cw / 2, y0 + 356)
    ctx.textAlign = 'left'
  })
  if (extra) {
    const x = x0 + shown.length * (cw + gap)
    roundRect(ctx, x, y0, cw, ch, 22)
    ctx.strokeStyle = 'rgba(238,223,193,0.3)'
    ctx.setLineDash([10, 8])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#eedfc1'
    ctx.font = F(800, 64)
    ctx.textAlign = 'center'
    ctx.fillText(`+${extra}`, x + cw / 2, y0 + ch / 2 + 10)
    ctx.font = F(600, 20)
    ctx.fillText(extra === 1 ? 'prenda más' : 'prendas más', x + cw / 2, y0 + ch / 2 + 46)
    ctx.textAlign = 'left'
  }

  // total
  const count = lines.reduce((a, l) => a + l.qty, 0)
  ctx.font = F(600, 24)
  ctx.fillStyle = '#b9b09d'
  ctx.fillText(`${count} ${count === 1 ? 'prenda' : 'prendas'}`, 48, H - 42)
  ctx.font = F(800, 44)
  ctx.fillStyle = '#fffaf0'
  ctx.textAlign = 'right'
  ctx.fillText(formatPrice(total), W - 48, H - 38)
  ctx.textAlign = 'left'

  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86))
}

// ---------- crear el pedido en la API (devuelve el link /o/CODIGO) ----------
export async function createOrder(lines, total, data, extra) {
  if (!API_URL) return null
  let image = null
  try {
    image = await buildOrderImage(lines, total, { customer: data.name.trim().split(' ')[0] })
  } catch {
    /* sin imagen: el link igual sirve */
  }
  const form = new FormData()
  form.append(
    'data',
    JSON.stringify({
      name: data.name,
      phone: data.phone,
      delivery: data.delivery,
      payment: data.payment,
      address: [data.address, data.city].filter((s) => s?.trim()).join(', '),
      note: data.note,
      customerMeasures: extra.customerMeasures,
      items: lines.map((l) => ({ productId: l.product.id, size: l.size, color: l.color?.id || null, qty: l.qty })),
    })
  )
  if (image) form.append('image', image, 'pedido.jpg')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 25000)
  try {
    const res = await fetch(API_URL + '/api/orders', { method: 'POST', body: form, signal: ctrl.signal })
    if (!res.ok) {
      let msg = null
      try {
        msg = (await res.json()).errors?.[0]
      } catch {
        /* nada */
      }
      return { error: msg || 'No se pudo preparar el link con fotos.' }
    }
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}
