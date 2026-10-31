import { Application, Assets, Container, Graphics, Rectangle, Text } from 'pixi.js'
import { Garment } from './Garment.js'
import { formatPrice } from '../data/products.js'

// El perchero: un caño a todo el ancho, prendas colgadas que se desplazan solas en loop.
// Cada prenda tiene su propia física (ver Garment.js). El movimiento del caño
// (arrancar, frenar, acelerar) las hace hamacarse como en un local de verdad.

const SPEED = { play: 42, fast: 340, pause: 0 }

export async function loadTextures(products) {
  const urls = [...new Set(products.flatMap((p) => [p.front, p.back]).filter(Boolean))]
  await Assets.load(urls)
  const map = {}
  for (const p of products) {
    const front = Assets.get(p.front)
    const back = p.back ? Assets.get(p.back) : null
    for (const t of [front, back]) {
      // mipmaps: la foto se ve más chica que su tamaño real; sin esto "titila" al moverse
      if (t && !t.source.autoGenerateMipmaps) {
        t.source.autoGenerateMipmaps = true
        t.source.updateMipmaps?.()
      }
    }
    map[p.id] = { front, back }
  }
  return map
}

const ratioOf = (tex) => tex.height / tex.width

// Calidad de render según el dispositivo. En celulares con pantalla 3x dibujar a 3x
// es 9 veces más píxeles por frame: con 1.5–2x se ve igual de nítido y vuela.
export function renderQuality() {
  const dpr = window.devicePixelRatio || 1
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  const resolution = Math.min(dpr, small ? 1.75 : 2)
  // el antialias (MSAA) solo hace falta en pantallas 1x; en 2x+ no se nota y cuesta
  return { resolution, antialias: resolution < 1.5 }
}

export class Rack {
  constructor(host, { onSelect, reducedMotion = false } = {}) {
    this.host = host
    this.onSelect = onSelect
    this.reduced = reducedMotion
    this.mode = reducedMotion ? 'pause' : 'play'
    this.products = []
    this.textures = {}
    this.slots = []
    this.offset = 0
    this.v = 0
    this.prevV = 0
    this.accel = 0
    this.nudgeLeft = 0
    this.hovered = null
    this.time = 0
    this.destroyed = false
  }

  async init() {
    const app = new Application()
    await app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      ...renderQuality(),
      autoDensity: true,
      powerPreference: 'high-performance',
    })
    if (this.destroyed) {
      app.destroy(true)
      return
    }
    this.app = app
    app.ticker.maxFPS = 60
    app.canvas.setAttribute('aria-hidden', 'true')
    this.host.appendChild(app.canvas)

    this.rod = new Graphics()
    this.garmentLayer = new Container()
    this.labelLayer = new Container()
    app.stage.addChild(this.garmentLayer, this.rod, this.labelLayer)

    this._onResize = () => {
      clearTimeout(this._rt)
      this._rt = setTimeout(() => this._build(false), 120)
    }
    app.renderer.on('resize', this._onResize)
    app.ticker.add(this._tick, this)
    this._setupDrag()
  }

  // Arrastrar el perchero con el dedo o el mouse, con inercia al soltar
  _setupDrag() {
    const stage = this.app.stage
    stage.eventMode = 'static'
    stage.hitArea = this.app.screen
    stage.on('pointerdown', (e) => {
      this.drag = { x: e.global.x, lastX: e.global.x, t: performance.now(), moved: false, vx: 0 }
    })
    stage.on('globalpointermove', (e) => {
      const d = this.drag
      if (!d) return
      const dx = e.global.x - d.lastX
      d.lastX = e.global.x
      if (!d.moved && Math.abs(e.global.x - d.x) > 8) d.moved = true
      if (!d.moved) return
      this.offset -= dx
      const now = performance.now()
      const dt = Math.max(8, now - d.t) / 1000
      d.vx = d.vx * 0.6 + (-dx / dt) * 0.4
      d.t = now
    })
    const end = (e) => {
      const d = this.drag
      if (d?.moved) {
        this.v = Math.max(-2600, Math.min(2600, d.vx))
        this.justDragged = performance.now()
        this.nudgeLeft = 0
      }
      if (e?.pointerType === 'touch') this.hovered = null
      this.drag = null
    }
    stage.on('pointerup', end)
    stage.on('pointerupoutside', end)
  }

  async setProducts(products) {
    this.products = products
    const tex = await loadTextures(products)
    if (this.destroyed || !this.app) return
    Object.assign(this.textures, tex)
    this._build(true)
  }

  setMode(mode) {
    this.mode = mode
  }

  // Con un panel abierto encima, el perchero no se ve: dejamos de dibujarlo.
  setActive(on) {
    if (!this.app) return
    if (on) this.app.ticker.start()
    else this.app.ticker.stop()
  }

  // salto de a una prenda con las flechas
  nudge(dir) {
    if (!this.spacing) return
    this.nudgeLeft += dir * this.spacing
  }

  _layout() {
    const W = this.app.screen.width
    const H = this.app.screen.height
    const mobile = W < 700
    let rodY = Math.round(Math.max(mobile ? 186 : 158, H * (mobile ? 0.23 : 0.19)))
    const bottomReserve = mobile ? 250 : 300
    const maxRatio = Math.max(...this.products.map((p) => ratioOf(this.textures[p.id].front)))
    const availH = Math.max(200, Math.min(H - rodY - bottomReserve, 540))
    const gw = Math.min(availH / maxRatio, mobile ? W * 0.5 : W * 0.27)
    const maxH = gw * maxRatio
    if (mobile) {
      // en celular la prenda queda limitada por el ancho: bajamos un poco el caño
      // para que el perchero quede centrado en la pantalla y no sobre aire abajo
      const free = H - rodY - bottomReserve - maxH
      if (free > 0) rodY += Math.round(free * 0.4)
    }
    return { W, H, rodY, gw, maxH, spacing: gw * (mobile ? 1.04 : 1.0), mobile }
  }

  _flipButton(slot) {
    const btn = new Container()
    const txt = new Text({
      text: '',
      style: { fontFamily: 'Archivo', fontWeight: '700', fontSize: this.mobile ? 13 : 14, fill: 0xede6d6, letterSpacing: this.mobile ? 0.8 : 1.2 },
    })
    const bg = new Graphics()
    const draw = (side) => {
      const word = side === 'front' ? 'ESPALDA' : 'FRENTE'
      txt.text = this.mobile ? '↻  ' + word : '↻  VER ' + word
      const w = Math.max(txt.width + 32, this.mobile ? 112 : 0)
      const h = 40
      bg.clear()
        .roundRect(-w / 2, 0, w, h, h / 2)
        .fill({ color: 0x0f0e0b, alpha: 0.6 })
        .roundRect(-w / 2, 0, w, h, h / 2)
        .stroke({ width: 1.5, color: 0xede6d6, alpha: 0.45 })
      txt.position.set(-txt.width / 2, (h - txt.height) / 2)
      btn.hitArea = new Rectangle(-w / 2, -4, w, h + 8)
    }
    draw(slot.g.side)
    btn.addChild(bg, txt)
    btn.eventMode = 'static'
    btn.cursor = 'pointer'
    btn.on('pointerover', () => {
      this.hovered = slot
    })
    btn.on('pointerout', () => {
      if (this.hovered === slot) this.hovered = null
    })
    btn.on('pointertap', (e) => {
      e.stopPropagation()
      if (performance.now() - (this.justDragged || 0) < 250) return
      draw(slot.g.toggleSide())
    })
    return btn
  }

  _build(drop) {
    if (!this.app || !this.products.length) return
    for (const s of this.slots) {
      s.g.destroy()
      s.label.destroy({ children: true })
    }
    this.slots = []
    this.hovered = null

    const L0 = this._layout()
    Object.assign(this, L0)
    const { W, rodY, gw, maxH, spacing } = L0
    const small = W < 700

    // caño del perchero
    this.rod
      .clear()
      .rect(0, rodY - 5, W, 10)
      .fill(0x24221e)
      .rect(0, rodY - 4, W, 2.5)
      .fill({ color: 0xa79f8f, alpha: 0.55 })
      .rect(0, rodY + 5, W, 4)
      .fill({ color: 0x000000, alpha: 0.35 })

    const n = this.products.length
    const copies = Math.max(1, Math.ceil((W + spacing * 3) / (n * spacing)))
    const list = []
    for (let c = 0; c < copies; c++) list.push(...this.products)
    this.loopLen = list.length * spacing

    list.forEach((p, i) => {
      const tex = this.textures[p.id]
      const g = new Garment({
        textures: tex,
        side: p.showBack && tex.back ? 'back' : 'front',
        width: gw,
        height: gw * ratioOf(tex.front),
        tag: p.tag,
        reducedMotion: this.reduced,
      })
      g.view.eventMode = 'static'
      g.view.cursor = 'pointer'
      const slot = { p, g, i, drop: drop ? -(rodY + maxH + 200) : 0, dropV: 0, delay: drop ? (i % n) * 0.07 + 0.05 : 0 }
      g.view.on('pointerover', () => {
        this.hovered = slot
        g.impulse(0.22 * (Math.random() > 0.5 ? 1 : -1))
      })
      g.view.on('pointerout', () => {
        if (this.hovered === slot) this.hovered = null
      })
      g.view.on('pointermove', (e) => {
        const mx = e.movementX || 0
        if (mx) g.impulse(Math.max(-0.1, Math.min(0.1, mx * 0.0035)))
      })
      g.view.on('pointertap', () => {
        if (performance.now() - (this.justDragged || 0) < 250) return
        g.impulse(0.5)
        this.onSelect?.(p, g.flip ? g.flip.to : g.side)
      })
      this.garmentLayer.addChild(g.view)

      // cartel debajo: nombre, precio y botón para dar vuelta
      const label = new Container()
      const name = new Text({
        text: p.name,
        style: {
          fontFamily: 'Atkinson Hyperlegible',
          fontSize: small ? 16 : 17,
          fill: 0xede6d6,
          align: 'center',
          wordWrap: true,
          wordWrapWidth: spacing - 14,
          lineHeight: small ? 19 : 21,
        },
      })
      name.anchor.set(0.5, 0)
      const row = new Container()
      const price = new Text({
        text: formatPrice(p.price),
        style: { fontFamily: 'Archivo', fontWeight: '700', fontSize: small ? 17 : 18, fill: 0xd8c79c, letterSpacing: 0.5 },
      })
      row.addChild(price)
      if (p.oldPrice) {
        const old = new Text({
          text: formatPrice(p.oldPrice),
          style: { fontFamily: 'Atkinson Hyperlegible', fontSize: 15, fill: 0x9c9585 },
        })
        old.position.set(price.width + 10, (price.height - old.height) / 2 + 1)
        const strike = new Graphics().rect(old.x, old.y + old.height / 2, old.width, 1.5).fill(0x9c9585)
        row.addChild(old, strike)
      }
      row.pivot.x = row.width / 2
      row.y = name.height + 2
      label.addChild(name, row)
      if (tex.back) {
        const btn = this._flipButton(slot)
        btn.y = row.y + row.height + 10
        label.addChild(btn)
      }
      label.y = rodY + 22 + maxH + 16
      this.labelLayer.addChild(label)
      slot.label = label
      this.slots.push(slot)
    })
    this._place(0)
  }

  _place(dt) {
    const S = this.spacing
    const L = this.loopLen
    const W = this.W
    const margin = this.gw
    for (const s of this.slots) {
      const x = ((((s.i * S - this.offset) % L) + L) % L) - S + S / 2
      // caída al entrar (cambio de categoría)
      if (s.delay > 0) {
        s.delay -= dt
      } else if (s.drop !== 0 || s.dropV !== 0) {
        s.dropV += 5200 * dt
        s.drop += s.dropV * dt
        if (s.drop >= 0) {
          s.drop = 0
          s.g.impulse(Math.min(0.45, s.dropV * 0.00025) * (s.i % 2 ? 1 : -1))
          s.dropV = 0
        }
      }
      const onScreen = x > -margin && x < W + margin
      s.g.view.visible = onScreen
      s.label.visible = onScreen && s.drop > -10
      s.g.view.position.set(x, this.rodY + s.drop)
      s.label.x = x
    }
  }

  _tick(ticker) {
    const dt = Math.min(ticker.deltaMS / 1000, 1 / 30)
    this.time += dt
    if (!this.slots.length) return

    // velocidad del perchero (con arranque y frenado suaves)
    let target = SPEED[this.mode] * Math.max(0.6, this.W / 1400)
    if (this.hovered && this.mode !== 'fast') target = 0
    let v
    if (this.drag?.moved) {
      // mientras se arrastra, la posición la maneja el dedo
      v = this.drag.vx * 0.5
    } else if (this.nudgeLeft !== 0) {
      // salto con curva suave: rápido al principio, frena al llegar
      const want = Math.sign(this.nudgeLeft) * Math.max(60, Math.abs(this.nudgeLeft) * 4.2)
      v = this.v + (want - this.v) * Math.min(1, 10 * dt)
      let step = v * dt
      if (Math.abs(step) >= Math.abs(this.nudgeLeft)) {
        step = this.nudgeLeft
        this.nudgeLeft = 0
        v = 0
      } else {
        this.nudgeLeft -= step
      }
      this.offset += step
    } else {
      const k = Math.abs(this.v) > 400 ? 2.4 : target > this.v ? 2.2 : 3.2
      v = this.v + (target - this.v) * Math.min(1, k * dt)
      this.offset += v * dt
    }
    const rawAccel = Math.max(-6000, Math.min(6000, (v - this.prevV) / dt))
    // aceleración filtrada: el hamaqueo responde al movimiento sin tirones
    this.accel += (rawAccel - this.accel) * Math.min(1, 8 * dt)
    this.prevV = v
    this.v = v

    this._place(dt)
    for (const s of this.slots) s.g.update(dt, this.time, this.accel)
  }

  destroy() {
    this.destroyed = true
    clearTimeout(this._rt)
    if (this.app) {
      this.app.renderer.off('resize', this._onResize)
      this.app.ticker.remove(this._tick, this)
      this.app.destroy(true, { children: true })
      this.app = null
    }
  }
}
