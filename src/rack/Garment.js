import { Container, Graphics, Mesh, MeshPlane, Rectangle, Text, Texture } from 'pixi.js'

// Prenda "2.5D": la foto real va montada sobre una malla (MeshPlane) que deformamos
// cada frame. Arriba queda clavada a la percha y hacia abajo se comporta como tela:
// se hamaca (péndulo), se dobla con retraso (lag) y ondula un poco.

// 9 x 11 = 99 vértices: por debajo de 100 PixiJS junta todas las prendas en un solo
// "draw call" (batching). Con más vértices dibujaba cada prenda por separado.
const VX = 9 // columnas de la malla
const VY = 11 // filas de la malla

const smooth = (t) => t * t * (3 - 2 * t)

// Sombra "horneada" una sola vez por foto (silueta negra desenfocada en un canvas).
// Antes era un BlurFilter por prenda en cada frame: era lo más pesado de todo.
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
  const pad = 0.07
  ctx.filter = 'blur(5px)'
  ctx.drawImage(src, W * pad, H * pad, W * (1 - pad * 2), H * (1 - pad * 2))
  ctx.filter = 'none'
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  const t = Texture.from(c)
  shadowCache.set(tex, t)
  return t
}

export class Garment {
  constructor({ textures, side = 'front', width, height, tag = null, reducedMotion = false }) {
    this.textures = textures
    this.side = side
    this.w = width
    this.h = height
    this.reduced = reducedMotion
    this.phase = Math.random() * Math.PI * 2

    // física
    this.theta = 0 // giro rígido sobre el gancho
    this.omega = 0
    this.beta = 0 // flexión de la tela (retraso respecto a la percha)
    this.betaV = 0
    this.flip = null // animación frente/espalda

    this.yOff = 22 // dónde empieza la tela debajo del gancho
    this.view = new Container()
    this.view.sortableChildren = false

    this.arms = new Graphics()
    if (!textures[side]) this.side = side = 'front'
    this.cloth = new MeshPlane({ texture: textures[side], verticesX: VX, verticesY: VY })
    this.cloth.autoResize = false
    // la sombra usa LA MISMA malla que la tela: una sola actualización de vértices por frame
    this.shadow = new Mesh({ geometry: this.cloth.geometry, texture: shadowTexture(textures[side]) })
    this.hook = new Graphics()

    this.shadow.alpha = 0.6
    this.shadow.position.set(12, 18)

    this.view.addChild(this.shadow, this.arms, this.cloth, this.hook)

    if (tag) this._buildTag(tag)
    this._drawHanger()
    this._basePositions()
    this.view.hitArea = new Rectangle(-this.w / 2, 0, this.w, this.h + this.yOff)
    this._deform(0)
  }

  _drawHanger() {
    const w = this.w
    const y0 = this.yOff + 2
    const sh = this.yOff + this.h * 0.14
    // brazos de la percha (quedan detrás de la tela, se asoman por el cuello y los hombros)
    this.arms
      .moveTo(-w * 0.36, sh)
      .lineTo(0, y0 + 6)
      .lineTo(w * 0.36, sh)
      .stroke({ width: 5, color: 0x1a1916, cap: 'round', join: 'round' })
    // gancho metálico (delante, abraza el caño)
    this.hook
      .moveTo(0, this.yOff + 8)
      .lineTo(0, 10)
      .bezierCurveTo(0, 2, 9, 2, 9, -5)
      .bezierCurveTo(9, -13, -7, -13, -7, -4)
      .stroke({ width: 3.2, color: 0x8d867a, cap: 'round', join: 'round' })
      .moveTo(0.8, this.yOff + 6)
      .lineTo(0.8, 11)
      .stroke({ width: 1, color: 0xd9d1bf, alpha: 0.5, cap: 'round' })
  }

  _buildTag(label) {
    const g = new Container()
    const txt = new Text({
      text: label,
      style: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 13, fill: 0x14130f, letterSpacing: 1 },
    })
    const pw = txt.width + 18
    const ph = 24
    const card = new Graphics()
      .roundRect(0, 0, pw, ph, 3)
      .fill(0xefe7d4)
      .circle(7, ph / 2, 2.2)
      .fill(0x9b927f)
    txt.position.set(13, (ph - txt.height) / 2)
    g.addChild(card, txt)
    const thread = new Graphics()
    this.tag = g
    this.tagThread = thread
    this.tagAnchor = { x: this.w * 0.17, y: this.yOff + 10 }
    g.pivot.set(4, 0)
    g.position.set(this.tagAnchor.x + 6, this.tagAnchor.y + 30)
    this.view.addChild(thread, g)
  }

  _basePositions() {
    const n = VX * VY
    this.base = new Float32Array(n * 2)
    for (let j = 0; j < VY; j++) {
      for (let i = 0; i < VX; i++) {
        const k = (j * VX + i) * 2
        this.base[k] = (i / (VX - 1)) * this.w - this.w / 2
        this.base[k + 1] = (j / (VY - 1)) * this.h + this.yOff
      }
    }
  }

  impulse(v) {
    const max = 1.1
    this.omega = Math.max(-max, Math.min(max, this.omega + v))
    this.betaV += v * 0.9
  }

  get canFlip() {
    return !!this.textures.back
  }

  toggleSide() {
    const cur = this.flip ? this.flip.to : this.side
    this.setSide(cur === 'front' ? 'back' : 'front')
    return cur === 'front' ? 'back' : 'front'
  }

  setSide(side) {
    if (!this.textures[side]) return
    if (side === this.side && !this.flip) return
    this.flip = { p: 0, to: side, swapped: false }
  }

  // extAccel: aceleración horizontal del perchero (px/s²) — empuja el péndulo
  update(dt, time, extAccel = 0) {
    if (this.destroyed) return
    dt = Math.min(dt, 1 / 30)
    // péndulo rígido sobre el gancho
    const K = 11
    const C = 2.6
    const alpha = -K * this.theta - C * this.omega - extAccel * 0.00028
    this.omega += alpha * dt
    this.theta += this.omega * dt

    // tela que se dobla con retraso
    const Kb = 26
    const Cb = 3.2
    const bAcc = -Kb * this.beta - Cb * this.betaV - alpha * 0.55
    this.betaV += bAcc * dt
    this.beta += this.betaV * dt

    this.view.rotation = this.theta

    // vuelta frente / espalda
    let sx = 1
    if (this.flip) {
      this.flip.p += dt / 0.55
      const p = Math.min(this.flip.p, 1)
      if (p >= 0.5 && !this.flip.swapped) {
        this.flip.swapped = true
        this.side = this.flip.to
        this.cloth.texture = this.textures[this.side]
        this.shadow.texture = shadowTexture(this.textures[this.side])
        this.impulse(0.35)
      }
      sx = Math.max(0.04, Math.abs(Math.cos(p * Math.PI)))
      if (p >= 1) this.flip = null
    }

    if (this.view.visible) this._deform(time, sx)

    // sombreado: cuanto más se inclina, un poco más oscura (luz cenital de local)
    const lean = Math.min(0.2, Math.abs(this.theta * 0.6 + this.beta * 0.8))
    const f = 1 - lean - (1 - sx) * 0.25
    const r = Math.round(242 * f)
    const g = Math.round(236 * f)
    const b = Math.round(222 * f)
    this.cloth.tint = (r << 16) | (g << 8) | b

    if (this.tag) {
      this.tag.rotation = -this.betaV * 0.12 + Math.sin(time * 2.1 + this.phase) * 0.03
      this.tagThread
        .clear()
        .moveTo(this.tagAnchor.x, this.tagAnchor.y)
        .lineTo(this.tag.x, this.tag.y + 2)
        .stroke({ width: 1, color: 0xcfc6b2, alpha: 0.8 })
      this.tag.visible = sx > 0.5
      this.tagThread.visible = sx > 0.5
    }
  }

  _deform(time, sx = 1) {
    const pos = this.cloth.geometry.positions
    const base = this.base
    const motion = Math.abs(this.omega) + Math.abs(this.betaV) * 0.6
    const breeze = this.reduced ? 0 : 1.1
    const amp = breeze + Math.min(9, motion * 7)
    const ph = this.phase
    for (let j = 0; j < VY; j++) {
      const t = j / (VY - 1)
      const a = this.beta * smooth(t) * 0.9
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const ripple = amp * t * t * Math.sin(time * 1.7 + t * 4.4 + ph)
      const fold = (this.reduced ? 0 : 0.012) + motion * 0.02
      for (let i = 0; i < VX; i++) {
        const k = (j * VX + i) * 2
        const u = i / (VX - 1)
        let bx = base[k] * sx
        const by = base[k + 1]
        // pliegues verticales suaves que "respiran"
        bx += bx * fold * t * Math.sin(time * 1.15 + ph + t * 3.1 + u * 2.2)
        // el ruedo se abre un poco al moverse
        bx += bx * Math.min(0.06, Math.abs(this.betaV) * 0.025) * t * t * t
        const x = bx * ca - (by - this.yOff) * sa + ripple * (0.55 + 0.45 * Math.sin(u * Math.PI))
        const y = bx * sa + (by - this.yOff) * ca + this.yOff - Math.abs(ripple) * 0.05
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
