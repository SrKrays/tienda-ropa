import { Application, Assets, Container, MeshPlane, Rectangle, RenderTexture } from 'pixi.js'
import { MANNEQUINS, lerpLine } from './mannequins.js'
import { detectLandmarks } from './landmarks.js'
import { makeTPS } from './tps.js'
import { DEFAULT_PERSON, fitOf } from './sizing.js'

// "Probador": toma la foto plana de la prenda y la calza sobre la foto del maniquí.
// 1) detecta los puntos de la prenda (landmarks.js)
// 2) calcula dónde tiene que caer cada punto sobre el maniquí según el talle y la persona
// 3) deforma la foto con una malla (Thin Plate Spline) y le aplica las luces y sombras del maniquí
// El resultado es una imagen (URL) que se cachea: se calcula una vez por prenda / vista / talle.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

let app = null
let ready = null
const results = new Map()
const views = new Map() // assets por maniquí
let queue = Promise.resolve()

function init() {
  if (!ready) {
    ready = (async () => {
      app = new Application()
      await app.init({ width: 16, height: 16, backgroundAlpha: 0, antialias: true, preference: 'webgl', autoStart: false })
      app.ticker.stop()
    })()
  }
  return ready
}

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

// desenfoque barato y compatible con todos los navegadores (achicar y volver a agrandar)
function softBlur(src, amount) {
  const w = src.width
  const h = src.height
  const k = Math.max(2, amount)
  const small = canvas(Math.max(1, Math.round(w / k)), Math.max(1, Math.round(h / k)))
  const sctx = small.getContext('2d')
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(src, 0, 0, small.width, small.height)
  const out = canvas(w, h)
  const octx = out.getContext('2d')
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(small, 0, 0, w, h)
  return out
}

// luces y sombras del maniquí, suavizadas (la tela no copia cada músculo)
async function viewAssets(name) {
  if (views.has(name)) return views.get(name)
  const p = (async () => {
    const M = MANNEQUINS[name]
    const img = await loadImg(M.src)
    const { w, h } = M
    const raw = canvas(w, h)
    raw.getContext('2d').drawImage(img, 0, 0, w, h)
    const rawData = raw.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h)
    // la tela no copia cada músculo: solo los volúmenes grandes (pecho, hombros, costados)
    const blurred = softBlur(softBlur(raw, 40), 6)
    const src = blurred.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h)
    const L = new Float32Array(w * h)
    let hi = 0
    for (let i = 0; i < w * h; i++) {
      const v = (src.data[i * 4] + src.data[i * 4 + 1] + src.data[i * 4 + 2]) / 3
      L[i] = v
      if (v > hi) hi = v
    }
    const lo = 150
    const shade = canvas(w, h)
    const light = canvas(w, h)
    const sd = shade.getContext('2d').createImageData(w, h)
    const ld = light.getContext('2d').createImageData(w, h)
    for (let i = 0; i < w * h; i++) {
      const t = clamp((L[i] - lo) / (hi - lo), 0, 1)
      const sv = 255 * (0.62 + 0.38 * Math.pow(t, 1.2))
      sd.data[i * 4] = sd.data[i * 4 + 1] = sd.data[i * 4 + 2] = sv
      sd.data[i * 4 + 3] = 255
      const g = 255 * 0.2 * clamp((L[i] - (hi - 40)) / 40, 0, 1)
      ld.data[i * 4] = ld.data[i * 4 + 1] = ld.data[i * 4 + 2] = g
      ld.data[i * 4 + 3] = 255
    }
    shade.getContext('2d').putImageData(sd, 0, 0)
    light.getContext('2d').putImageData(ld, 0, 0)

    // cuello: el maniquí "sale" del cuello de la remera (se dibuja por encima de la prenda)
    const neck = canvas(w, h)
    const nctx = neck.getContext('2d', { willReadFrequently: true })
    const [nlx, ny] = M.neck.l
    const [nrx] = M.neck.r
    const cx = (nlx + nrx) / 2
    const cy = ny + M.neck.dip * 2 - 6
    nctx.save()
    nctx.beginPath()
    nctx.moveTo(nlx - 8, 0)
    nctx.lineTo(nlx - 8, ny + 3)
    nctx.quadraticCurveTo(cx, cy, nrx + 8, ny + 3)
    nctx.lineTo(nrx + 8, 0)
    nctx.closePath()
    nctx.clip()
    nctx.drawImage(img, 0, 0, w, h)
    nctx.restore()
    // solo los píxeles del maniquí (no el fondo gris)
    const bgL = (rawData.data[(5 * w + 5) * 4] + rawData.data[(5 * w + 5) * 4 + 1] + rawData.data[(5 * w + 5) * 4 + 2]) / 3
    const nd = nctx.getImageData(0, 0, w, h)
    for (let i = 0; i < w * h; i++) {
      if (nd.data[i * 4 + 3] === 0) continue
      const v = (nd.data[i * 4] + nd.data[i * 4 + 1] + nd.data[i * 4 + 2]) / 3
      nd.data[i * 4 + 3] = Math.round(nd.data[i * 4 + 3] * clamp((Math.abs(v - bgL) - 2) / 5, 0, 1))
    }
    nctx.putImageData(nd, 0, 0)
    // sombra que hace el cuello de la remera sobre la piel (solo sobre el cuello)
    const band = canvas(w, h)
    const bctx = band.getContext('2d')
    bctx.strokeStyle = 'rgba(0,0,0,0.55)'
    bctx.lineWidth = 7
    bctx.beginPath()
    bctx.moveTo(nlx - 8, ny + 3)
    bctx.quadraticCurveTo(cx, cy, nrx + 8, ny + 3)
    bctx.stroke()
    nctx.globalCompositeOperation = 'source-atop'
    nctx.globalAlpha = 0.5
    nctx.drawImage(softBlur(band, 4), 0, 0)
    nctx.globalAlpha = 1
    nctx.globalCompositeOperation = 'source-over'

    return { M, img, shade, light, neck }
  })()
  views.set(name, p)
  return p
}

// ---- dónde cae cada punto de la prenda sobre el maniquí ----
function targets(view, lm, product, size, person) {
  const M = MANNEQUINS[view]
  const f = fitOf(product, size, person)
  const e = clamp(f.ease / f.chest, -0.06, 0.45)
  const wK = e >= 0 ? 1 + 0.85 * e : 1 + 0.4 * e
  const ny = M.neck.l[1]
  const cx = (M.neck.l[0] + M.neck.r[0]) / 2
  const cmV = (M.crotch - ny) / (0.385 * person.height)
  const upperArm = 0.19 * person.height
  // grosor de la tela: la prenda siempre queda un poco por fuera del cuerpo (así no asoma el maniquí)
  const px = (M.seam.r[0] - M.seam.l[0]) / 600
  const skin = 11 * px

  const pitHalf0 = (M.pit.r[0] - M.pit.l[0]) / 2
  const pitHalf = pitHalf0 * wK + skin * 0.5
  const pitDrop = Math.max(0, e - 0.08) * 0.12 * (M.crotch - ny)
  const pitY = (M.pit.l[1] + M.pit.r[1]) / 2 + pitDrop
  const hemY = ny + f.m.largo * cmV

  const gPitHalf = (lm.pitR[0] - lm.pitL[0]) / 2
  const gHemHalf = (lm.hemR[0] - lm.hemL[0]) / 2
  const gMidHalf = (lm.midR[0] - lm.midL[0]) / 2
  const torsoHalf = (y) => (lerpLine(M.torso.r, y) - lerpLine(M.torso.l, y)) / 2
  const torsoC = (y) => (lerpLine(M.torso.r, y) + lerpLine(M.torso.l, y)) / 2
  const hemHalf = Math.max(pitHalf * (gHemHalf / gPitHalf), torsoHalf(hemY) + skin)
  const midY = (pitY + hemY) / 2
  const midHalf = Math.max(pitHalf * (gMidHalf / gPitHalf), torsoHalf(midY) + skin)
  const hemC = torsoC(hemY)
  const midC = torsoC(midY)

  const seamHalf = (M.seam.r[0] - M.seam.l[0]) / 2
  const seamC = (M.seam.r[0] + M.seam.l[0]) / 2
  const drop = Math.max(0, e - 0.1) * 0.35 * seamHalf

  const src = []
  const dst = []
  const add = (s, d) => {
    if (!s || s[1] == null || Number.isNaN(s[1])) return
    src.push(s)
    dst.push(d)
  }

  add(lm.collarL, [M.neck.l[0] - 6, ny - 3])
  add(lm.collarR, [M.neck.r[0] + 6, ny - 3])
  add(lm.topC, [cx, ny - 3])
  add(lm.chestC, [(M.pit.l[0] + M.pit.r[0]) / 2, pitY])
  add(lm.midL, [midC - midHalf, midY])
  add(lm.midR, [midC + midHalf, midY])
  add(lm.hemL, [hemC - hemHalf, hemY])
  add(lm.hemR, [hemC + hemHalf, hemY])
  add(lm.hemC, [hemC, hemY + 4])

  // hombros: costura un poco por fuera y por arriba del hombro del maniquí, y la mitad del hombro
  // apoyada sobre la línea cuello → hombro (levantada por el grosor de la tela)
  const shoulder = (side, sh, shMid) => {
    const dir = side === 'l' ? -1 : 1
    const seam = M.seam[side]
    const neck = M.neck[side]
    const sx = seamC + dir * (seamHalf + drop) + dir * skin * 0.6
    const sy = seam[1] + drop * 0.35 - skin
    add(sh, [sx, sy])
    add(shMid, [(neck[0] + sx) / 2 + dir * 2, (neck[1] + sy) / 2 - skin * 0.9])
  }

  // manga sobre un brazo que cuelga: el borde de arriba sigue el contorno del hombro y del brazo
  const sleeveDown = (side, k) => {
    const arm = M.arm[side]
    const seamY = M.seam[side][1]
    const pitYs = M.pit[side][1]
    const y = seamY + (f.m.manga / upperArm) * (M.elbow - seamY)
    const yb = Math.max(y + 4, pitYs + 10)
    const ox = lerpLine(arm.outer, y)
    const ix = lerpLine(arm.inner, yb)
    const armW = Math.abs(ox - ix)
    const out = Math.max(0, e) * 0.35 * armW + armW * 0.06
    const dir = side === 'l' ? -1 : 1
    add(k.top, [ox + dir * (out + skin * 0.5), y])
    add(k.bot, [ix - dir * out * 0.25, yb])
    // tres puntos sobre el borde de arriba (25 %, 50 %, 75 %) pegados al contorno del hombro/brazo
    for (const [pt, t] of [[k.q1, 0.25], [k.mid, 0.5], [k.q3, 0.75]]) {
      const yy = seamY + (y - seamY) * t
      add(pt, [lerpLine(arm.outer, yy) + dir * (skin + out * t), yy - skin * (1 - t) * 0.6])
    }
    const ymb = (pitYs + yb) / 2
    add(k.botMid, [lerpLine(arm.inner, ymb) - dir * out * 0.15, ymb])
  }

  shoulder('r', lm.shR, lm.shMidR)
  sleeveDown('r', { top: lm.cuffTopR, bot: lm.cuffBotR, q1: lm.slTopQ1R, mid: lm.slTopMidR, q3: lm.slTopQ3R, botMid: lm.slBotMidR })
  add(lm.pitR, [(M.pit.l[0] + M.pit.r[0]) / 2 + pitHalf, pitY])

  if (M.reach) {
    // vista "brazo": la manga izquierda de la foto va sobre el brazo estirado
    const R = M.reach
    const sx = M.seam.l[0] - (f.m.manga / upperArm) * (M.seam.l[0] - R.elbowX)
    const tY = lerpLine(R.top, sx)
    const bY = lerpLine(R.bottom, sx)
    const out = Math.max(0, e) * 0.2 * (bY - tY) + (bY - tY) * 0.05
    add(lm.shL, [M.seam.l[0], M.seam.l[1] - skin])
    add(lm.shMidL, [(M.neck.l[0] + M.seam.l[0]) / 2, (M.neck.l[1] + M.seam.l[1]) / 2 - skin])
    add(lm.pitL, [M.pit.l[0] - skin * 0.3, M.pit.l[1] + skin * 0.5])
    add(lm.cuffTopL, [sx, tY - out - skin * 0.4])
    add(lm.cuffBotL, [sx, bY + out])
    for (const [pt, t] of [[lm.slTopQ1L, 0.25], [lm.slTopMidL, 0.5], [lm.slTopQ3L, 0.75]]) {
      const xx = M.seam.l[0] + (sx - M.seam.l[0]) * t
      add(pt, [xx, lerpLine(R.top, xx) - out * t - skin])
    }
    const mxb = (M.pit.l[0] + sx) / 2
    add(lm.slBotMidL, [mxb, lerpLine(R.bottom, mxb) + out])
  } else {
    shoulder('l', lm.shL, lm.shMidL)
    add(lm.pitL, [(M.pit.l[0] + M.pit.r[0]) / 2 - pitHalf, pitY])
    sleeveDown('l', { top: lm.cuffTopL, bot: lm.cuffBotL, q1: lm.slTopQ1L, mid: lm.slTopMidL, q3: lm.slTopQ3L, botMid: lm.slBotMidL })
  }
  return { src, dst, fit: f }
}

async function doRender({ product, view, size, person, side }) {
  await init()
  const A = await viewAssets(view)
  const M = A.M
  const url = side === 'back' ? product.back : product.front
  const lm = await detectLandmarks(url)
  await Assets.load(url)
  const tex = Assets.get(url)
  const { src, dst } = targets(view, lm, product, size, person)
  const tps = makeTPS(src, dst, 0.0004)

  const VX = 34
  const VY = 40
  const mesh = new MeshPlane({ texture: tex, verticesX: VX, verticesY: VY })
  mesh.autoResize = false
  const pos = mesh.geometry.positions
  for (let j = 0; j < VY; j++) {
    for (let i = 0; i < VX; i++) {
      const k = (j * VX + i) * 2
      const [x, y] = tps((i / (VX - 1)) * tex.width, (j / (VY - 1)) * tex.height)
      pos[k] = x
      pos[k + 1] = y
    }
  }
  mesh.geometry.getBuffer('aPosition').update()

  const { w, h } = M
  const rt = RenderTexture.create({ width: w, height: h, resolution: 1, antialias: true })
  const holder = new Container()
  holder.addChild(mesh)
  app.renderer.render({ container: holder, target: rt, clear: true })

  // la prenda deformada sale de la placa de video a un canvas, y el resto se compone en 2D
  const g = app.renderer.extract.canvas({ target: rt, frame: new Rectangle(0, 0, w, h), resolution: 1 })
  holder.destroy({ children: true })
  rt.destroy(true)
  const cloth = canvas(w, h)
  const cctx = cloth.getContext('2d')
  cctx.drawImage(g, 0, 0)
  // luces y sombras del maniquí, solo donde hay tela
  const masked = (layer) => {
    const c = canvas(w, h)
    const x = c.getContext('2d')
    x.drawImage(layer, 0, 0)
    x.globalCompositeOperation = 'destination-in'
    x.drawImage(g, 0, 0)
    return c
  }
  cctx.globalCompositeOperation = 'multiply'
  cctx.drawImage(masked(A.shade), 0, 0)
  cctx.globalCompositeOperation = 'screen'
  cctx.drawImage(masked(A.light), 0, 0)
  cctx.globalCompositeOperation = 'destination-in'
  cctx.drawImage(g, 0, 0)
  cctx.globalCompositeOperation = 'source-over'
  // nada de tela por encima de la base del cuello ni adentro del escote:
  // ahí se ve el cuello del maniquí (el interior del cuello de la remera queda "detrás")
  cctx.clearRect(0, 0, w, Math.max(0, M.neck.l[1] - 6))
  {
    const [nlx, ny] = M.neck.l
    const [nrx] = M.neck.r
    cctx.save()
    cctx.globalCompositeOperation = 'destination-out'
    cctx.beginPath()
    cctx.moveTo(nlx - 8, 0)
    cctx.lineTo(nlx - 8, ny + 3)
    cctx.quadraticCurveTo((nlx + nrx) / 2, ny + M.neck.dip * 2 - 6, nrx + 8, ny + 3)
    cctx.lineTo(nrx + 8, 0)
    cctx.closePath()
    cctx.fill()
    cctx.restore()
  }

  // sombra de la prenda sobre el maniquí
  const sh = canvas(w, h)
  const shctx = sh.getContext('2d')
  shctx.drawImage(g, 0, 0)
  shctx.globalCompositeOperation = 'source-in'
  shctx.fillStyle = '#000'
  shctx.fillRect(0, 0, w, h)

  const out = canvas(w, h)
  const o = out.getContext('2d')
  o.drawImage(A.img, 0, 0, w, h)
  o.globalAlpha = 0.34
  o.drawImage(softBlur(sh, 10), 5, 10)
  o.globalAlpha = 1
  o.drawImage(cloth, 0, 0)
  o.drawImage(A.neck, 0, 0)
  const blob = await new Promise((res) => out.toBlob(res, 'image/webp', 0.9))
  return URL.createObjectURL(blob)
}

export function renderFit({ product, view, size = 'M', person = DEFAULT_PERSON, side = 'front' }) {
  const key = [product.id, view, size, side, person.height, person.weight, person.body, person.chest || ''].join('|')
  if (results.has(key)) return results.get(key)
  const p = (queue = queue.then(() => doRender({ product, view, size, person, side })).catch((err) => {
    console.error('[probador]', err)
    results.delete(key)
    return null
  }))
  results.set(key, p)
  return p
}

export const FIT_VIEWS = [
  { id: 'pecho', label: 'Puesta', side: 'front' },
  { id: 'espalda', label: 'Espalda', side: 'back' },
  { id: 'brazo', label: 'Brazo', side: 'front' },
]
