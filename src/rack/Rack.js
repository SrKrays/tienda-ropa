import { Application, Assets, Container, Sprite, Texture, TilingSprite } from 'pixi.js'
import { Garment, HANGER_K, hangerOverhead } from './Garment.js'

// El perchero tipo vidriera: un caño real (foto) de lado a lado, postes en los costados
// y las prendas colgadas. La del centro es la protagonista (más grande y con luz);
// las de los costados se achican, se oscurecen y giran 3/4 hacia el centro.
// Recorrido automático: avanza de a una prenda, se queda unos segundos y sigue.
// Cuando la persona interactúa, el recorrido se frena.

const UI = {
  hanger: '/img/ui/percha.png',
  rod: '/img/ui/rack-rod.png',
  elbow: '/img/ui/rack-elbow.png',
  post: '/img/ui/rack-post.png',
  base: '/img/ui/rack-base.png',
}

const DWELL = 4.2 // segundos que la prenda queda en el centro
const IDLE_RESUME = 12 // segundos sin tocar nada para que vuelva el recorrido
const BOX_RATIO = 1.1 // proporción de la "caja" donde entra cada prenda (alto / ancho)

export async function loadTextures(products) {
  const urls = [...new Set(products.flatMap((p) => [p.front, p.back]).filter(Boolean))]
  // una foto que no carga (borrada, sin internet) no frena al resto
  await Promise.allSettled(urls.map((u) => Assets.load(u)))
  const map = {}
  for (const p of products) {
    const front = Assets.get(p.front)
    if (!front) continue
    const back = p.back ? Assets.get(p.back) || null : null
    for (const t of [front, back]) {
      if (t && !t.source.autoGenerateMipmaps) {
        t.source.autoGenerateMipmaps = true
        t.source.updateMipmaps?.()
      }
    }
    map[p.id] = { front, back }
  }
  return map
}

export function renderQuality() {
  const dpr = window.devicePixelRatio || 1
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  const resolution = Math.min(dpr, small ? 1.75 : 2)
  return { resolution, antialias: resolution < 1.5 }
}

// luz de spot cálida (se genera una vez)
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(255,236,200,0.55)')
  g.addColorStop(0.45, 'rgba(255,226,180,0.18)')
  g.addColorStop(1, 'rgba(255,220,170,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  return Texture.from(c)
}

export class Rack {
  constructor(host, { onSelect, onCenter, onLayout, reducedMotion = false } = {}) {
    this.host = host
    this.onSelect = onSelect
    this.onCenter = onCenter
    this.onLayout = onLayout
    this.reduced = reducedMotion
    this.products = []
    this.textures = {}
    this.slots = []
    this.insets = { top: 200, bottom: 280 }
    this.offset = 0
    this.target = 0
    this.vel = 0
    this.prevVel = 0
    this.accel = 0
    this.dwell = 0
    this.holdUntil = 0
    this.sticky = reducedMotion
    this.paused = false
    this.hoverCenter = false
    this.time = 0
    this.centerKey = null
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

    await Assets.load(Object.values(UI))
    if (this.destroyed) return
    for (const k of Object.keys(UI)) {
      const t = Assets.get(UI[k])
      t.source.autoGenerateMipmaps = true
      t.source.updateMipmaps?.()
      this[k + 'Tex'] = t
    }

    this.backLayer = new Container()
    this.garmentLayer = new Container()
    this.garmentLayer.sortableChildren = true
    this.glow = new Sprite(glowTexture())
    this.glow.anchor.set(0.5)
    this.pool = new Sprite(this.glow.texture)
    this.pool.anchor.set(0.5)
    this.rod = new TilingSprite({ texture: this.rodTex, width: 10, height: 10 })
    this.posts = [0, 1].map(() => {
      const c = new Container()
      c.shaft = new TilingSprite({ texture: this.postTex, width: 10, height: 10 })
      c.elbow = new Sprite(this.elbowTex)
      c.base = new Sprite(this.baseTex)
      c.addChild(c.shaft, c.base, c.elbow)
      return c
    })
    this.backLayer.addChild(this.glow, this.pool, ...this.posts, this.rod)
    app.stage.addChild(this.backLayer, this.garmentLayer)

    this._onResize = () => {
      clearTimeout(this._rt)
      this._rt = setTimeout(() => this._build(false), 100)
    }
    app.renderer.on('resize', this._onResize)
    app.ticker.add(this._tick, this)
    this._setupDrag()
  }

  setInsets(insets) {
    const changed = insets.top !== this.insets.top || insets.bottom !== this.insets.bottom
    this.insets = insets
    if (changed && this.slots.length) this._onResize?.()
  }

  async setProducts(products) {
    const token = (this._setToken = (this._setToken || 0) + 1)
    const tex = await loadTextures(products)
    // si mientras cargaba llegó otra lista (cambio de categoría, catálogo nuevo), gana la última
    if (this.destroyed || !this.app || token !== this._setToken) return
    Object.assign(this.textures, tex)
    this.products = products.filter((p) => tex[p.id])
    this.offset = 0
    this.target = 0
    this.vel = 0
    this.dwell = 0
    this.centerKey = null
    this._build(true)
  }

  // ---- control desde la interfaz ----
  setPaused(on) {
    this.paused = on
  }

  setActive(on) {
    if (!this.app) return
    if (on) this.app.ticker.start()
    else this.app.ticker.stop()
  }

  nudge(dir) {
    if (!this.S) return
    this.target = Math.round(this.target / this.S) * this.S + dir * this.S
    this.sticky = this.reduced
    this._hold(IDLE_RESUME)
  }

  // la persona está mirando algo (eligió talle, dio vuelta la prenda): no avanzar solo
  holdCenter() {
    this.sticky = true
  }

  resumeTour() {
    this.sticky = this.reduced
    this.holdUntil = 0
    this.dwell = DWELL - 0.4
  }

  flipCenter() {
    const s = this._centerSlot()
    if (!s) return 'front'
    this.sticky = true
    const side = s.g.toggleSide()
    this._emitCenter(true)
    return side
  }

  _hold(sec) {
    this.holdUntil = performance.now() + sec * 1000
    this.dwell = 0
  }

  // ---- layout ----
  _layout() {
    const W = this.app.screen.width
    const H = this.app.screen.height
    const mobile = W < 760
    let rodY = Math.round(this.insets.top)
    const avail = Math.max(160, H - rodY - this.insets.bottom)
    const k = BOX_RATIO + HANGER_K + 0.02
    let gw = Math.min(avail / k, mobile ? W * 0.64 : W * 0.3)
    gw = Math.max(120, gw)
    // si sobra alto (pantallas largas), bajamos un poco el perchero para repartir el aire
    const free = avail - gw * k
    if (free > 8) rodY += Math.round(free * 0.4)
    const boxH = gw * BOX_RATIO
    // separación entre prendas: apretadas, como en un perchero real (las mangas casi se tocan)
    const S = gw * (mobile ? 0.9 : 0.84)
    const garmentBottom = rodY + hangerOverhead(gw) + boxH
    return { W, H, mobile, rodY, gw, boxH, S, garmentBottom }
  }

  _build(drop) {
    if (!this.app || !this.hangerTex) return
    for (const s of this.slots) s.g.destroy()
    this.slots = []
    if (!this.products.length) {
      // perchero vacío (todavía no hay prendas cargadas en esta categoría): se ve solo el caño
      const L0 = this._layout()
      Object.assign(this, L0)
      this.cx = L0.W / 2
      this._drawRack(L0.W, L0.H, L0.mobile, L0.rodY)
      this.centerKey = null
      this.onCenter?.(null, "front")
      return
    }
    this.hoverCenter = false

    const L0 = this._layout()
    // si cambió el ancho de cada prenda, mantenemos la prenda que estaba en el centro
    if (this.S && L0.S !== this.S) {
      const idx = this.offset / this.S
      this.offset = idx * L0.S
      this.target = Math.round(this.target / this.S) * L0.S
    }
    Object.assign(this, L0)
    const { W, H, mobile, rodY, gw, boxH, S } = L0
    this.cx = W / 2

    this._drawRack(W, H, mobile, rodY)

    // spot de luz detrás de la prenda central
    this.glow.width = gw * 2.6
    this.glow.height = boxH * 2.2
    this.glow.position.set(this.cx, rodY + boxH * 0.45)
    this.pool.width = gw * 2.4
    this.pool.height = gw * 0.34
    this.pool.alpha = 0.55
    this.pool.position.set(this.cx, Math.min(H - 40, L0.garmentBottom + gw * 0.16))

    const n = this.products.length
    const copies = Math.max(1, Math.ceil((W + S * 4) / (n * S)))
    const list = []
    for (let c = 0; c < copies; c++) list.push(...this.products)
    this.list = list
    this.L = list.length * S

    list.forEach((p, i) => {
      const tex = this.textures[p.id]
      const r = tex.front.height / tex.front.width
      // cada prenda entra en la misma "caja": las largas (buzos) se ajustan por alto
      const w = r > BOX_RATIO ? boxH / r : gw
      const g = new Garment({
        textures: tex,
        hanger: this.hangerTex,
        side: p.showBack && tex.back ? 'back' : 'front',
        width: w,
        height: w * r,
        tag: p.tag,
        reducedMotion: this.reduced,
        small: mobile,
      })
      g.view.eventMode = 'static'
      g.view.cursor = 'pointer'
      const slot = { p, g, i, drop: drop ? -(rodY + boxH + 300) : 0, dropV: 0, delay: drop ? (i % n) * 0.06 + 0.05 : 0, d: 0 }
      g.view.on('pointerover', (e) => {
        if (e.pointerType === 'touch') return
        g.impulse(0.18 * (Math.random() > 0.5 ? 1 : -1))
        if (Math.abs(slot.d) < 0.5) this.hoverCenter = true
      })
      g.view.on('pointerout', () => {
        if (Math.abs(slot.d) < 0.5) this.hoverCenter = false
      })
      g.view.on('pointermove', (e) => {
        const mx = e.movementX || 0
        if (mx) g.impulse(Math.max(-0.08, Math.min(0.08, mx * 0.003)))
      })
      g.view.on('pointertap', () => {
        if (performance.now() - (this.justDragged || 0) < 250) return
        g.impulse(0.4)
        if (Math.abs(slot.d) < 0.5) {
          this.onSelect?.(p, g.shownSide)
        } else {
          // tocar una prenda del costado la trae al centro
          this.target = this.offset + slot.d * S
          this.target = Math.round(this.target / S) * S
          this._hold(IDLE_RESUME)
        }
      })
      this.garmentLayer.addChild(g.view)
      this.slots.push(slot)
    })

    this.onLayout?.({
      W,
      H,
      mobile,
      rodY,
      gw,
      boxH,
      infoTop: Math.round(L0.garmentBottom + (mobile ? 8 : 6)),
      arrowsY: Math.round(rodY + hangerOverhead(gw) + boxH * 0.45),
    })
    this._place(0)
    this._emitCenter(true)
  }

  _drawRack(W, H, mobile, rodY) {
    // caño: un tramo de la foto estirado a lo largo (un caño es igual en todo su largo)
    const rodH = Math.max(9, Math.min(14, W * 0.0075))
    this.rod.width = W + 40
    this.rod.height = rodH
    this.rod.tileScale.set(rodH / this.rodTex.height)
    this.rod.position.set(-20, rodY - rodH / 2)
    this.rodH = rodH

    const floorY = Math.round(H * (mobile ? 0.72 : 0.82))
    const xs = mobile ? [W * 0.035, W * 0.965] : [W * 0.11, W * 0.95]
    const sc = rodH / (this.rodTex.height * 0.55) // el caño ocupa ~55% de la foto del codo
    this.posts.forEach((c, i) => {
      const flip = i === 1 ? -1 : 1
      const pw = this.postTex.width * sc
      c.shaft.width = pw
      c.shaft.height = Math.max(0, floorY - rodY)
      c.shaft.tileScale.set(sc)
      c.shaft.position.set(-pw / 2, rodY)
      c.elbow.scale.set(sc * flip, sc)
      c.elbow.position.set(flip === 1 ? -pw * 0.62 : pw * 0.62, rodY - this.elbowTex.height * sc * 0.22)
      c.base.scale.set(sc * flip * 0.9, sc * 0.9)
      c.base.position.set(flip === 1 ? -this.baseTex.width * sc * 0.48 : this.baseTex.width * sc * 0.48, floorY - this.baseTex.height * sc * 0.6)
      c.position.x = xs[i]
      c.alpha = 0.92
    })
  }

  // ---- arrastre con el dedo / mouse ----
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
      this.target = this.offset
      const now = performance.now()
      const dt = Math.max(8, now - d.t) / 1000
      d.vx = d.vx * 0.6 + (-dx / dt) * 0.4
      d.t = now
    })
    const end = () => {
      const d = this.drag
      if (d?.moved) {
        const v = Math.max(-3000, Math.min(3000, d.vx))
        this.vel = v
        this.target = Math.round((this.offset + v * 0.22) / this.S) * this.S
        this.justDragged = performance.now()
        this.sticky = this.reduced
        this._hold(IDLE_RESUME)
      }
      this.drag = null
    }
    stage.on('pointerup', end)
    stage.on('pointerupoutside', end)
  }

  _wrap(v) {
    const L = this.L
    return ((((v + L / 2) % L) + L) % L) - L / 2
  }

  _centerSlot() {
    if (!this.slots.length) return null
    let best = null
    for (const s of this.slots) if (!best || Math.abs(s.d) < Math.abs(best.d)) best = s
    return best
  }

  _emitCenter(force = false) {
    const s = this._centerSlot()
    if (!s) return
    const key = s.i + ':' + s.g.shownSide
    if (!force && key === this.centerKey) return
    const changedSlot = !this.centerKey || this.centerKey.split(':')[0] !== String(s.i)
    this.centerKey = key
    if (changedSlot && !force) this.sticky = this.reduced
    this.onCenter?.(s.p, s.g.shownSide)
  }

  _place(dt) {
    const S = this.S
    const W = this.W
    const mobile = this.mobile
    for (const s of this.slots) {
      const x = this.cx + this._wrap(s.i * S - this.offset)
      const d = (x - this.cx) / S
      s.d = d
      const ad = Math.min(Math.abs(d), 2)
      if (s.delay > 0) {
        s.delay -= dt
      } else if (s.drop !== 0 || s.dropV !== 0) {
        s.dropV += 5200 * dt
        s.drop += s.dropV * dt
        if (s.drop >= 0) {
          s.drop = 0
          s.g.impulse(Math.min(0.4, s.dropV * 0.0002) * (s.i % 2 ? 1 : -1))
          s.dropV = 0
        }
      }
      const g = s.g
      const margin = this.gw * 1.2
      g.view.visible = x > -margin && x < W + margin
      // vidriera: la del centro grande e iluminada, las de los costados más chicas y en penumbra
      const scale = 1 - (mobile ? 0.15 : 0.12) * Math.min(ad, 1.5)
      g.view.scale.set(scale)
      g.turn = -Math.max(-1.4, Math.min(1.4, d)) * 0.32
      g.dim = 1 - 0.2 * Math.min(ad, 1.4)
      g.view.zIndex = Math.round(1000 - ad * 100)
      // los ganchos de las prendas chicas siguen apoyados en el caño
      g.view.position.set(x, this.rodY + s.drop)
    }
  }

  _tick(ticker) {
    const dt = Math.min(ticker.deltaMS / 1000, 1 / 30)
    this.time += dt
    if (!this.slots.length) return
    const S = this.S
    const now = performance.now()

    if (!this.drag?.moved) {
      // recorrido automático: cuando la prenda llegó al centro, espera y pasa a la siguiente
      const settled = Math.abs(this.target - this.offset) < 1 && Math.abs(this.vel) < 6
      const canTour = !this.paused && !this.sticky && !this.hoverCenter && now > this.holdUntil
      if (settled && canTour) {
        // tiempo real (no el dt limitado): aunque la compu vaya lenta, la espera dura lo mismo
        this.dwell += Math.min(ticker.deltaMS / 1000, 0.25)
        if (this.dwell > DWELL) {
          this.dwell = 0
          this.target = Math.round(this.target / S) * S + S
        }
      } else if (!settled) {
        this.dwell = 0
      }
      // resorte críticamente amortiguado: llega suave, sin rebote
      const k = this.reduced ? 60 : 22
      const c = 2 * Math.sqrt(k) * 0.98
      this.vel += (k * (this.target - this.offset) - c * this.vel) * dt
      this.offset += this.vel * dt
    } else {
      this.vel = this.drag.vx * 0.5
    }

    const raw = Math.max(-5000, Math.min(5000, (this.vel - this.prevVel) / dt))
    this.accel += (raw - this.accel) * Math.min(1, 8 * dt)
    this.prevVel = this.vel

    this._place(dt)
    for (const s of this.slots) s.g.update(dt, this.time, this.accel)
    this._emitCenter()
  }

  destroy() {
    this.destroyed = true
    clearTimeout(this._rt)
    if (this.app) {
      this.app.renderer.off('resize', this._onResize)
      this.app.ticker.remove(this._tick, this)
      for (const s of this.slots) s.g.destroy()
      this.slots = []
      this.app.destroy(true, { children: true })
      this.app = null
    }
  }
}
