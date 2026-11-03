// Recorte automático del fondo, en el navegador (sin servicios externos ni costos).
//
// Pensado para la foto que saca el local: la prenda estirada sobre una pared, sábana o mesa lisa.
// 1. Mira el borde de la foto para saber de qué color es el fondo.
// 2. "Pinta" desde los bordes hacia adentro todo lo que se parece a ese fondo (aunque tenga
//    sombras suaves o un degradé de luz), sin cruzar el contorno de la prenda.
// 3. Se queda con la pieza más grande (la prenda), suaviza el borde, recorta lo que sobra
//    y la deja del mismo tamaño que las fotos del perchero.
// Si la foto ya viene sin fondo (PNG transparente), solo la recorta y la achica.

const OUT_MAX = 1100 // lado más largo de la foto final (igual que las del perchero)
const WORK_MAX = 1400 // tamaño de trabajo para el recorte

export async function loadBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Safari viejo: por <img>
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function hasTransparency(d, w, h) {
  let clear = 0
  let n = 0
  const step = Math.max(1, Math.floor(Math.min(w, h) / 200))
  for (let x = 0; x < w; x += step) {
    for (const y of [0, h - 1]) {
      n++
      if (d[(y * w + x) * 4 + 3] < 200) clear++
    }
  }
  for (let y = 0; y < h; y += step) {
    for (const x of [0, w - 1]) {
      n++
      if (d[(y * w + x) * 4 + 3] < 200) clear++
    }
  }
  return clear / n > 0.3
}

// distancia de color (pesos aproximados a cómo vemos: el verde pesa más)
function dist(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db)
}

function median(arr) {
  const a = arr.slice().sort((x, y) => x - y)
  return a[a.length >> 1]
}

// color de fondo: la mediana de una franja del borde, por lado (por si la luz cambia de un lado a otro)
function borderModel(d, w, h) {
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.015))
  const samples = []
  const push = (x, y) => {
    const i = (y * w + x) * 4
    samples.push([d[i], d[i + 1], d[i + 2]])
  }
  const step = Math.max(1, Math.floor(Math.max(w, h) / 400))
  for (let x = 0; x < w; x += step) for (let k = 0; k < band; k++) push(x, k), push(x, h - 1 - k)
  for (let y = 0; y < h; y += step) for (let k = 0; k < band; k++) push(k, y), push(w - 1 - k, y)
  const r = median(samples.map((s) => s[0]))
  const g = median(samples.map((s) => s[1]))
  const b = median(samples.map((s) => s[2]))
  // qué tan "ruidoso" es el fondo (tela, textura de la pared): ajusta la tolerancia sola
  const spread = median(samples.map((s) => dist(s[0], s[1], s[2], r, g, b)))
  return { r, g, b, spread }
}

/**
 * @param {ImageBitmap|HTMLImageElement} src
 * @param {{ tolerance?: number, removeBg?: boolean }} opts  tolerance 0..100 (por defecto 50)
 * @returns {Promise<{ blob: Blob, url: string, width: number, height: number, removed: boolean, coverage: number }>}
 */
export async function cutout(src, { tolerance = 50, removeBg = true } = {}) {
  const sw = src.width
  const sh = src.height
  const k = Math.min(1, WORK_MAX / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * k))
  const h = Math.max(1, Math.round(sh * k))
  const c = canvas(w, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data

  const alreadyClear = hasTransparency(d, w, h)
  let removed = false

  if (removeBg && !alreadyClear) {
    removed = true
    const bg = borderModel(d, w, h)
    const t = 10 + (tolerance / 100) * 50 + bg.spread * 1.5 // tolerancia contra el color del fondo
    const tLocal = 4 + (tolerance / 100) * 10 // salto máximo entre dos píxeles vecinos del fondo

    const N = w * h
    const isBg = new Uint8Array(N)
    const queue = new Int32Array(N)
    let qh = 0
    let qt = 0
    const tryPush = (j, fromI) => {
      if (isBg[j]) return
      const p = j * 4
      const r = d[p]
      const g = d[p + 1]
      const b = d[p + 2]
      const dBg = dist(r, g, b, bg.r, bg.g, bg.b)
      let ok = dBg < t
      if (!ok && fromI >= 0 && dBg < t * 1.9) {
        // sombras y degradés: se acepta si casi no cambia respecto del vecino que ya es fondo
        const q = fromI * 4
        ok = dist(r, g, b, d[q], d[q + 1], d[q + 2]) < tLocal
      }
      if (ok) {
        isBg[j] = 1
        queue[qt++] = j
      }
    }
    for (let x = 0; x < w; x++) tryPush(x, -1), tryPush((h - 1) * w + x, -1)
    for (let y = 0; y < h; y++) tryPush(y * w, -1), tryPush(y * w + w - 1, -1)
    while (qh < qt) {
      const i = queue[qh++]
      const x = i % w
      const y = (i - x) / w
      if (x > 0) tryPush(i - 1, i)
      if (x < w - 1) tryPush(i + 1, i)
      if (y > 0) tryPush(i - w, i)
      if (y < h - 1) tryPush(i + w, i)
    }

    // la prenda = la pieza más grande que no es fondo (descarta pelusas, enchufes, bordes de la mesa)
    const label = new Int32Array(N)
    let best = 0
    let bestSize = 0
    let next = 1
    for (let s = 0; s < N; s++) {
      if (isBg[s] || label[s]) continue
      let size = 0
      qh = qt = 0
      queue[qt++] = s
      label[s] = next
      while (qh < qt) {
        const i = queue[qh++]
        size++
        const x = i % w
        const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]
        for (const j of nb) {
          if (j < 0 || j >= N || isBg[j] || label[j]) continue
          label[j] = next
          queue[qt++] = j
        }
      }
      if (size > bestSize) {
        bestSize = size
        best = next
      }
      next++
    }

    // máscara: 255 en la prenda; los huecos de fondo encerrados dentro de la prenda (el cuello por dentro)
    // quedan como prenda porque el relleno arrancó solo desde el borde de la foto
    const mask = new Float32Array(N)
    // (si no quedó nada en pie, best = 0: la máscara queda vacía y se avisa que el recorte falló)
    for (let i = 0; i < N; i++) mask[i] = best && label[i] === best ? 1 : 0

    // borde suave (desenfoque chico de la máscara, 2 pasadas de caja)
    const tmp = new Float32Array(N)
    const R = Math.max(1, Math.round(w / 700))
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) {
        let acc = 0
        for (let x = -R; x <= R; x++) acc += mask[y * w + Math.min(w - 1, Math.max(0, x))]
        for (let x = 0; x < w; x++) {
          tmp[y * w + x] = acc / (2 * R + 1)
          acc += mask[y * w + Math.min(w - 1, x + R + 1)] - mask[y * w + Math.max(0, x - R)]
        }
      }
      for (let x = 0; x < w; x++) {
        let acc = 0
        for (let y = -R; y <= R; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
        for (let y = 0; y < h; y++) {
          mask[y * w + x] = acc / (2 * R + 1)
          acc += tmp[Math.min(h - 1, y + R + 1) * w + x] - tmp[Math.max(0, y - R) * w + x]
        }
      }
    }
    for (let i = 0; i < N; i++) {
      // un poquito hacia adentro: así no queda un halo del color de la pared
      const a = Math.min(1, Math.max(0, (mask[i] - 0.18) / 0.64))
      d[i * 4 + 3] = Math.round(a * 255)
    }
    ctx.putImageData(img, 0, 0)
  }

  // recorte al contorno de la prenda + margen chico
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  let solid = 0
  const out = ctx.getImageData(0, 0, w, h).data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (out[(y * w + x) * 4 + 3] > 24) {
        solid++
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) {
    x0 = 0
    y0 = 0
    x1 = w - 1
    y1 = h - 1
  }
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.012)
  x0 = Math.max(0, x0 - pad)
  y0 = Math.max(0, y0 - pad)
  x1 = Math.min(w - 1, x1 + pad)
  y1 = Math.min(h - 1, y1 + pad)
  const cw = x1 - x0 + 1
  const ch = y1 - y0 + 1

  // tamaño final: el lado largo a 1100 px como máximo
  const s2 = Math.min(1, OUT_MAX / Math.max(cw, ch))
  const ow = Math.max(1, Math.round(cw * s2))
  const oh = Math.max(1, Math.round(ch * s2))
  const oc = canvas(ow, oh)
  const octx = oc.getContext('2d')
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(c, x0, y0, cw, ch, 0, 0, ow, oh)

  const blob = await new Promise((res) => oc.toBlob(res, 'image/webp', 0.9))
  // Safari viejo no sabe hacer WebP: devuelve PNG (la API acepta los dos)
  const final = blob && blob.type === 'image/webp' ? blob : await new Promise((res) => oc.toBlob(res, 'image/png'))
  return {
    blob: final,
    url: URL.createObjectURL(final),
    width: ow,
    height: oh,
    removed,
    alreadyClear,
    // qué parte de la foto quedó como prenda: si es muy poco o casi todo, el recorte probablemente falló
    coverage: solid / (w * h),
  }
}
