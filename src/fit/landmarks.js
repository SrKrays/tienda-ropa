// Detecta automáticamente los puntos clave de una prenda a partir de su silueta
// (la foto ya viene sin fondo): cuello, hombros, axilas, puños de las mangas y ruedo.
// Funciona con cualquier remera/buzo sacado de frente y estirado: no hay que marcar nada a mano.

const cache = new Map()

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

const median = (arr) => {
  const a = arr.filter((v) => v != null).sort((x, y) => x - y)
  return a.length ? a[Math.floor(a.length / 2)] : null
}

export async function detectLandmarks(src) {
  if (cache.has(src)) return cache.get(src)
  const p = (async () => {
    const img = await loadImage(src)
    const W = 320
    const k = W / img.naturalWidth
    const H = Math.round(img.naturalHeight * k)
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, W, H)
    const data = ctx.getImageData(0, 0, W, H).data
    const on = (x, y) => data[(y * W + x) * 4 + 3] > 128

    const L = new Array(H).fill(null)
    const R = new Array(H).fill(null)
    let top = -1
    let bottom = -1
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) if (on(x, y)) { L[y] = x; break }
      for (let x = W - 1; x >= 0; x--) if (on(x, y)) { R[y] = x; break }
      if (L[y] != null) {
        if (top < 0) top = y
        bottom = y
      }
    }
    const h = bottom - top
    const rowAt = (f) => Math.round(top + f * h)

    // cuerpo: bordes medianos en la parte baja (ahí no hay mangas)
    const bodyRows = []
    for (let y = rowAt(0.62); y <= rowAt(0.9); y++) bodyRows.push(y)
    const bodyL = median(bodyRows.map((y) => L[y]))
    const bodyR = median(bodyRows.map((y) => R[y]))
    const margin = Math.max(4, 0.035 * (bodyR - bodyL))

    // axilas: subiendo desde el medio, donde la silueta se ensancha de golpe (empieza la manga)
    const findPit = (side) => {
      const edge = side === 'l' ? L : R
      const body = side === 'l' ? bodyL : bodyR
      for (let y = rowAt(0.62); y > top; y--) {
        const out = side === 'l' ? body - edge[y] : edge[y] - body
        if (out > margin * 1.6) return [side === 'l' ? Math.min(edge[y + 2] ?? body, body) : Math.max(edge[y + 2] ?? body, body), y + 2]
      }
      return [body, rowAt(0.32)]
    }
    const pitL = findPit('l')
    const pitR = findPit('r')

    // primera fila con tela en una columna (para hombros y mangas)
    const colTop = (x) => { for (let y = 0; y < H; y++) if (on(x, y)) return y; return null }
    const colBot = (x, maxY = H - 1) => { for (let y = maxY; y >= 0; y--) if (on(x, y)) return y; return null }

    // hombros: borde superior justo sobre el borde del cuerpo
    const shL = [bodyL + margin * 0.5, colTop(Math.round(bodyL + margin * 0.5))]
    const shR = [bodyR - margin * 0.5, colTop(Math.round(bodyR - margin * 0.5))]

    // puños: sobre el contorno de cada manga, los dos puntos más lejanos en la dirección de la manga
    // (el borde del puño une la esquina de arriba con la de abajo)
    const sleeveCuff = (side) => {
      const sh = side === 'l' ? shL : shR
      const pit = side === 'l' ? pitL : pitR
      const body = side === 'l' ? bodyL : bodyR
      const pts = []
      for (let y = top; y <= pit[1] + Math.round(h * 0.25) && y < H; y++) {
        const e = side === 'l' ? L[y] : R[y]
        if (e == null) continue
        if (side === 'l' ? e < body - margin : e > body + margin) pts.push([e, y])
      }
      // también el borde de arriba y de abajo de la manga (columna por columna)
      const x0 = side === 'l' ? 0 : Math.round(body + margin)
      const x1 = side === 'l' ? Math.round(body - margin) : W - 1
      for (let x = x0; x <= x1; x++) {
        const t = colTop(x)
        if (t == null) continue
        pts.push([x, t])
        const b = colBot(x, pit[1] + Math.round(h * 0.25))
        if (b != null) pts.push([x, b])
      }
      if (!pts.length) return [sh, pit]
      const base = [(sh[0] + pit[0]) / 2, (sh[1] + pit[1]) / 2]
      let tip = pts[0]
      for (const p of pts) if ((side === 'l' ? -1 : 1) * (p[0] - tip[0]) > 0) tip = p
      let ax = tip[0] - base[0]
      let ay = tip[1] - base[1]
      const len = Math.hypot(ax, ay) || 1
      ax /= len
      ay /= len
      let tMax = -Infinity
      for (const p of pts) tMax = Math.max(tMax, (p[0] - base[0]) * ax + (p[1] - base[1]) * ay)
      const band = pts.filter((p) => (p[0] - base[0]) * ax + (p[1] - base[1]) * ay > tMax - len * 0.12)
      // perpendicular: "arriba" del eje = esquina superior del puño
      let topP = band[0]
      let botP = band[0]
      let sMin = Infinity
      let sMax = -Infinity
      for (const p of band) {
        const sv = (p[0] - base[0]) * -ay + (p[1] - base[1]) * ax
        if (sv < sMin) { sMin = sv; topP = p }
        if (sv > sMax) { sMax = sv; botP = p }
      }
      // en la manga derecha el perpendicular apunta al revés
      return side === 'l' ? [botP, topP].sort((a, b) => a[1] - b[1]) : [topP, botP].sort((a, b) => a[1] - b[1])
    }
    const [cuffTopL, cuffBotL] = sleeveCuff('l')
    const [cuffTopR, cuffBotR] = sleeveCuff('r')
    // puntos a mitad de manga (borde de arriba y de abajo), para que la manga siga al brazo sin inflarse
    const midTop = (a, b) => {
      const x = Math.round((a[0] + b[0]) / 2)
      return [x, colTop(x)]
    }
    const midBot = (pit, cuffB) => {
      const x = Math.round((pit[0] + cuffB[0]) / 2)
      return [x, colBot(x, Math.round(Math.max(pit[1], cuffB[1]) + 2))]
    }
    const slTopMidL = midTop(shL, cuffTopL)
    const slTopMidR = midTop(shR, cuffTopR)
    // más puntos sobre el borde de arriba de la manga y del hombro (para que la tela "abrace" el hombro)
    const along = (a, b, t) => {
      const x = Math.round(a[0] + (b[0] - a[0]) * t)
      return [x, colTop(x)]
    }
    const slTopQ1L = along(shL, cuffTopL, 0.25)
    const slTopQ3L = along(shL, cuffTopL, 0.75)
    const slTopQ1R = along(shR, cuffTopR, 0.25)
    const slTopQ3R = along(shR, cuffTopR, 0.75)
    const slBotMidL = midBot(pitL, cuffBotL)
    const slBotMidR = midBot(pitR, cuffBotR)

    // cuello: la primera franja de arriba (el borde del cuello de atrás)
    const y0 = rowAt(0.012)
    const collarL = [L[y0], top]
    const collarR = [R[y0], top]
    const slopeMid = (c, sh) => {
      const x = Math.round((c[0] + sh[0]) / 2)
      return [x, colTop(x)]
    }
    const shMidL = slopeMid(collarL, shL)
    const shMidR = slopeMid(collarR, shR)
    const center = (bodyL + bodyR) / 2

    // ruedo
    const yh = rowAt(0.985)
    const hemL = [L[yh], bottom]
    const hemR = [R[yh], bottom]
    const midY = Math.round((Math.max(pitL[1], pitR[1]) + bottom) / 2)

    const S = 1 / k // a píxeles de la foto original
    const sc = (pt) => [pt[0] * S, pt[1] * S]
    const out = {
      w: img.naturalWidth,
      h: img.naturalHeight,
      collarL: sc(collarL),
      collarR: sc(collarR),
      topC: sc([center, top]),
      shL: sc(shL),
      shR: sc(shR),
      shMidL: sc(shMidL),
      shMidR: sc(shMidR),
      pitL: sc(pitL),
      pitR: sc(pitR),
      cuffTopL: sc(cuffTopL),
      cuffBotL: sc(cuffBotL),
      cuffTopR: sc(cuffTopR),
      cuffBotR: sc(cuffBotR),
      slTopMidL: sc(slTopMidL),
      slTopMidR: sc(slTopMidR),
      slBotMidL: sc(slBotMidL),
      slBotMidR: sc(slBotMidR),
      slTopQ1L: sc(slTopQ1L),
      slTopQ3L: sc(slTopQ3L),
      slTopQ1R: sc(slTopQ1R),
      slTopQ3R: sc(slTopQ3R),
      chestC: sc([center, (pitL[1] + pitR[1]) / 2]),
      midL: sc([L[midY], midY]),
      midR: sc([R[midY], midY]),
      hemL: sc(hemL),
      hemR: sc(hemR),
      hemC: sc([center, bottom]),
      bodyW: (bodyR - bodyL) * S,
    }
    return out
  })()
  cache.set(src, p)
  return p
}
