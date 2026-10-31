import { Application, Assets, TilingSprite } from 'pixi.js'
import { Garment, HANGER_K } from './Garment.js'
import { loadTextures, renderQuality } from './Rack.js'

// Vista grande de una prenda en el panel: misma tela con física,
// se puede "tocar" con el mouse/dedo y dar vuelta (frente / espalda).
//
// Ojo: PixiJS v8 comparte recursos internos entre Applications, así que destruir una
// rompe la otra (el perchero). Por eso esta vista se crea UNA vez y se reutiliza:
// al abrir el panel se "engancha" al contenedor y al cerrarlo solo se pausa.

let shared = null

class ViewerApp {
  constructor() {
    this.time = 0
    this.ready = null
    this.host = null
    this.token = 0
  }

  init() {
    if (!this.ready) {
      this.ready = (async () => {
        const app = new Application()
        await app.init({
          width: 10,
          height: 10,
          backgroundAlpha: 0,
          ...renderQuality(),
          autoDensity: true,
        })
        this.app = app
        app.canvas.setAttribute('aria-hidden', 'true')
        app.canvas.style.display = 'block'
        await Assets.load(['/img/ui/percha.png', '/img/ui/rack-rod.png'])
        this.hangerTex = Assets.get('/img/ui/percha.png')
        this.rodTex = Assets.get('/img/ui/rack-rod.png')
        this.rod = new TilingSprite({ texture: this.rodTex, width: 10, height: 10 })
        app.stage.addChild(this.rod)
        app.stage.eventMode = 'static'
        app.stage.on('pointermove', (e) => {
          const mx = e.movementX || 0
          if (mx && this.g) this.g.impulse(Math.max(-0.1, Math.min(0.1, mx * 0.0035)))
        })
        app.stage.on('pointertap', () => this.g?.impulse(0.45))
        app.ticker.add(this._tick, this)
        app.ticker.stop()
        this._ro = new ResizeObserver(() => this._resize())
      })()
    }
    return this.ready
  }

  async show(host, product, side, reducedMotion) {
    const token = ++this.token
    this.side = side
    await this.init()
    const tex = await loadTextures([product])
    if (token !== this.token) return
    this.reduced = reducedMotion
    this.textures = tex[product.id]
    if (this.host !== host) {
      this._ro.disconnect()
      this.host = host
      host.appendChild(this.app.canvas)
      this._ro.observe(host)
    }
    this._fresh = true
    this._resize(true)
    this.app.ticker.start()
  }

  hide(host) {
    if (this.host !== host) return
    this.token++
    this._ro?.disconnect()
    this.app?.ticker.stop()
    this.host = null
  }

  setSide(side) {
    this.side = side
    this.g?.setSide(side)
  }

  _resize(rebuild = false) {
    if (!this.host || !this.app) return
    const W = Math.max(10, this.host.clientWidth)
    const H = Math.max(10, this.host.clientHeight)
    const changed = W !== this._w || H !== this._h
    if (!changed && !rebuild) return
    this._w = W
    this._h = H
    this.app.renderer.resize(W, H)
    this.app.stage.hitArea = this.app.screen
    this._build()
  }

  _build() {
    const side = this._fresh || !this.g ? this.side : this.g.side
    this._fresh = false
    this.g?.destroy()
    const W = this._w
    const H = this._h
    const rodY = 30
    const ar = this.textures.front.width / this.textures.front.height
    let gw = Math.min(W - 60, (H - rodY - 30) / (1 / ar + HANGER_K))
    gw = Math.max(80, gw)
    const gh = gw / ar
    const rodH = 11
    this.rod.width = Math.min(W, gw * 1.5)
    this.rod.height = rodH
    this.rod.tileScale.set(rodH / this.rodTex.height)
    this.rod.position.set((W - this.rod.width) / 2, rodY - rodH / 2)
    this.g = new Garment({ textures: this.textures, hanger: this.hangerTex, side, width: gw, height: gh, reducedMotion: this.reduced })
    this.g.view.position.set(W / 2, rodY)
    this.app.stage.addChild(this.g.view)
    this.g.impulse(0.4)
  }

  _tick(ticker) {
    const dt = Math.min(ticker.deltaMS / 1000, 1 / 30)
    this.time += dt
    this.g?.update(dt, this.time, 0)
  }
}

export function getViewer() {
  if (!shared) shared = new ViewerApp()
  return shared
}
