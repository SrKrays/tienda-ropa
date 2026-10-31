import { Container, Graphics, Mesh, MeshPlane, Rectangle, Sprite, Text, Texture } from 'pixi.js'

// Prenda "2.5D": la foto real va montada sobre una malla (MeshPlane) que deformamos
// cada frame. Cuelga de una percha real (foto) y hacia abajo se comporta como tela:
// se hamaca (péndulo), se dobla con retraso y ondula apenas.
// Además puede "girar" en falso 3/4 (perspectiva sobre la malla) para el efecto vidriera.

// 9 x 11 = 99 vértices: por debajo de 100 PixiJS junta todas las prendas en un solo draw call.
const VX = 9
const VY = 11

const smooth = (t) => t * t * (3 - 2 * t)

// Sombra "horneada" una sola vez por foto (silueta negra desenfocada en un canvas).
const shadowCache = new WeakMap()
export function shadowTexture(tex) {
  if (shadowCache.has(tex)) return shadowCache.get(tex)
  const src = tex.source.resource
  const W = Math.max(8, Math.round(tex.width / 3))
  const H = Math.max(8, Math.round(tex.height / 3))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const pad = 0.08
  ctx.filter = 'blur(6px)'
  ctx.drawImage(src, W * pad, H * pad, W * (1 - pad * 2), H * (1 - pad * 2))
  ctx.filter = 'none'
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  const t = Texture.from(c)
  shadowCache.set(tex, t)
  return t
}

// Proporciones de la foto de la percha (public/img/ui/percha.png, 640 x 405)
const HANGER_RATIO = 405 / 640
const HANGER_NECK = 0.47 // dónde empieza la prenda, en relación al alto de la percha (deja ver el puente de la percha)

// distancia desde el caño hasta el borde superior de la prenda, proporcional al ancho
export const HANGER_K = 0.62 * HANGER_RATIO * HANGER_NECK
export function hangerOverhead(gw) {
  return gw * HANGER_K - 6
}

export class Garment {
  constructor({ textures, hanger, side = 'front', width, height, tag = null, reducedMotion = false, small = false }) {
    this.textures = textures
    this.side = textures[side] ? side : 'front'
    this.w = width
    this.h = height
    this.reduced = reducedMotion
    this.phase = Math.random() * Math.PI * 2
    // cada prenda oscila con su propio ritmo: el conjunto se ve más natural
    this.freq = 0.85 + Math.random() * 0.35

    // física
    this.theta = 0
    this.omega = 0
    this.beta = 0
    this.betaV = 0
    this.flip = null

    // vidriera (lo maneja el perchero)
    this.turn = 0
    this.dim = 1

    this.view = new Container()

    // percha real: el gancho apoya sobre el caño, los brazos quedan detrás de la prenda
    this.hanger = new Sprite(hanger)
    const hw = width * 0.62
    this.hanger.anchor.set(0.5, 0)
    this.hanger.width = hw
    this.hanger.height = hw * HANGER_RATIO
    this.hanger.y = -6
    this.hangerBaseScaleX = this.hanger.scale.x
    this.yOff = hangerOverhead(width)

    this.cloth = new MeshPlane({ texture: textures[this.side], verticesX: VX, verticesY: VY })
    this.cloth.autoResize = false
    // la sombra usa la misma malla que la tela: una sola actualización de vértices por frame
    this.shadow = new Mesh({ geometry: this.cloth.geometry, texture: shadowTexture(textures[this.side]) })
    this.shadow.alpha = 0.7
    this.shadow.position.set(width * 0.035, height * 0.05)

    this.view.addChild(this.shadow, this.hanger, this.cloth)

    if (tag) this._buildTag(tag, small)
    this._basePositions()
    this.view.hitArea = new Rectangle(-this.w / 2, 0, this.w, this.h + this.yOff)
    this._deform(0)
  }

  // Etiqueta de cartón colgada con hilo, como en un local
  _buildTag(label, small) {
    const g = new Container()
    const fs = Math.round(Math.max(small ? 12 : 13, Math.min(17, this.w * 0.05)))
    const txt = new Text({
      text: label,
      style: { fontFamily: 'Archivo Variable', fontWeight: '800', fontSize: fs, fill: 0x1a1712, letterSpacing: 0.6 },
    })
    const padX = fs * 0.7
    const pw = txt.width + padX * 2
    const ph = fs * 2
    const card = new Graphics()
      .roundRect(0, 0, pw, ph, fs * 0.32)
      .fill(0xeedfc1)
      .roundRect(0, ph - 3, pw, 3, 1)
      .fill({ color: 0x000000, alpha: 0.08 })
    txt.position.set(padX, (ph - txt.height) / 2)
    const shadow = new Graphics().roundRect(2, 3, pw, ph, fs * 0.32).fill({ color: 0x000000, alpha: 0.35 })
    g.addChild(shadow, card, txt)
    this.tag = g
    this.tagThread = new Graphics()
    // el hilo sale del hombro derecho de la prenda
    this.tagAnchor = { x: this.w * 0.24, y: this.yOff + this.h * 0.07 }
    g.pivot.set(pw * 0.12, ph)
    g.position.set(this.w * 0.33, this.yOff - this.h * 0.02)
    this.view.addChild(this.tagThread, g)
  }

  _basePositions() {
    this.base = new Float32Array(VX * VY * 2)
    for (let j = 0; j < VY; j++) {
      for (let i = 0; i < VX; i++) {
        const k = (j * VX + i) * 2
        this.base[k] = (i / (VX - 1)) * this.w - this.w / 2
        this.base[k + 1] = (j / (VY - 1)) * this.h + this.yOff
      }
    }
  }

  impulse(v) {
    const max = 0.9
    this.omega = Math.max(-max, Math.min(max, this.omega + v))
    this.betaV += v * 0.8
  }

  toggleSide() {
    const cur = this.flip ? this.flip.to : this.side
    const next = cur === 'front' ? 'back' : 'front'
    this.setSide(next)
    return this.textures[next] ? next : cur
  }

  setSide(side) {
    if (!this.textures[side]) return
    if (side === this.side && !this.flip) return
    this.flip = { p: 0, to: side, swapped: false }
  }

  get shownSide() {
    return this.flip ? this.flip.to : this.side
  }

  // extAccel: aceleración horizontal del perchero (px/s²) — empuja el péndulo
  update(dt, time, extAccel = 0) {
    if (this.destroyed) return
    dt = Math.min(dt, 1 / 30)
    const K = 12
    const C = 3.0
    const alpha = -K * this.theta - C * this.omega - extAccel * 0.0002
    this.omega += alpha * dt
    this.theta += this.omega * dt

    const Kb = 28
    const Cb = 3.6
    const bAcc = -Kb * this.beta - Cb * this.betaV - alpha * 0.5
    this.betaV += bAcc * dt
    this.beta += this.betaV * dt

    this.view.rotation = this.theta

    let sx = 1
    if (this.flip) {
      this.flip.p += dt / 0.6
      const p = Math.min(this.flip.p, 1)
      if (p >= 0.5 && !this.flip.swapped) {
        this.flip.swapped = true
        this.side = this.flip.to
        this.cloth.texture = this.textures[this.side]
        this.shadow.texture = shadowTexture(this.textures[this.side])
        this.impulse(0.3)
      }
      sx = Math.max(0.04, Math.abs(Math.cos(p * Math.PI)))
      if (p >= 1) this.flip = null
    }

    if (!this.view.visible) return
    this._deform(time, sx)

    // luz: las prendas del costado quedan un poco en penumbra; al girar se oscurecen
    const lean = Math.min(0.16, Math.abs(this.theta * 0.5 + this.beta * 0.6))
    const f = this.dim * (1 - lean - (1 - sx) * 0.3)
    this.cloth.tint = rgb(248 * f, 243 * f, 232 * f)
    this.hanger.tint = rgb(255 * this.dim, 255 * this.dim, 255 * this.dim)
    this.hanger.scale.x = this.hangerBaseScaleX * Math.cos(this.turn) * Math.max(0.2, sx)

    if (this.tag) {
      this.tag.rotation = -this.betaV * 0.1 + Math.sin(time * 1.9 * this.freq + this.phase) * 0.035 + 0.05
      const tx = this.tag.x - this.tag.pivot.x + this.tag.width * 0.12
      this.tagThread
        .clear()
        .moveTo(this.tagAnchor.x * Math.cos(this.turn), this.tagAnchor.y)
        .lineTo(tx, this.tag.y)
        .stroke({ width: 1.2, color: 0xd9ccb0, alpha: 0.9 })
      const show = sx > 0.5
      this.tag.visible = show
      this.tagThread.visible = show
    }
  }

  _deform(time, sx = 1) {
    const pos = this.cloth.geometry.positions
    const base = this.base
    const motion = Math.abs(this.omega) + Math.abs(this.betaV) * 0.6
    const amp = (this.reduced ? 0 : 0.8) + Math.min(7, motion * 6)
    const ph = this.phase
    const tf = time * this.freq
    // giro falso 3/4: perspectiva sobre la malla (un lado se acerca, el otro se aleja)
    const ct = Math.cos(this.turn)
    const st = Math.sin(this.turn)
    const F = this.w * 2.4
    const yOff = this.yOff
    for (let j = 0; j < VY; j++) {
      const t = j / (VY - 1)
      const a = this.beta * smooth(t) * 0.9
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const ripple = amp * t * t * Math.sin(tf * 1.7 + t * 4.4 + ph)
      const fold = (this.reduced ? 0 : 0.01) + motion * 0.018
      for (let i = 0; i < VX; i++) {
        const k = (j * VX + i) * 2
        const u = i / (VX - 1)
        let bx = base[k] * sx
        const by = base[k + 1]
        bx += bx * fold * t * Math.sin(tf * 1.15 + ph + t * 3.1 + u * 2.2)
        bx += bx * Math.min(0.05, Math.abs(this.betaV) * 0.022) * t * t * t
        let x = bx * ca - (by - yOff) * sa + ripple * (0.55 + 0.45 * Math.sin(u * Math.PI))
        let y = bx * sa + (by - yOff) * ca - Math.abs(ripple) * 0.05
        // perspectiva: z según la posición horizontal y el giro
        const p = F / (F - x * st)
        x = x * ct * p
        y = y * p + yOff
        pos[k] = x
        pos[k + 1] = y
      }
    }
    this.cloth.geometry.getBuffer('aPosition').update()
  }

  destroy() {
    this.destroyed = true
    const geo = this.cloth.geometry
    this.view.destroy({ children: true })
    geo.destroy()
  }
}

function rgb(r, g, b) {
  return (Math.round(Math.min(255, r)) << 16) | (Math.round(Math.min(255, g)) << 8) | Math.round(Math.min(255, b))
}
