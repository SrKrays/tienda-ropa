// Animación al tocar cualquier botón: se hunde un poco al apretar, el borde se ilumina
// y al soltar sale un halo suave. En celular los :active de CSS casi no se ven
// (el tap es muy rápido), por eso lo manejamos con eventos y una duración mínima.

const SELECTOR = 'button, a[href], label.option, summary, [role="button"]'
const MIN_PRESS = 140 // ms: aunque el tap sea instantáneo, la animación se llega a ver

export function installPressFx() {
  if (typeof window === 'undefined' || window.__pressFx) return
  window.__pressFx = true
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  let current = null
  let pressedAt = 0

  const release = () => {
    const el = current
    if (!el) return
    current = null
    const wait = Math.max(0, MIN_PRESS - (performance.now() - pressedAt))
    setTimeout(() => {
      el.classList.remove('is-pressing')
      if (reduce) return
      el.classList.remove('tap-glow')
      void el.offsetWidth // reinicia la animación si se toca dos veces seguidas
      el.classList.add('tap-glow')
      setTimeout(() => el.classList.remove('tap-glow'), 520)
    }, wait)
  }

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== undefined && e.button !== 0) return
      const el = e.target.closest?.(SELECTOR)
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return
      current = el
      pressedAt = performance.now()
      el.classList.add('is-pressing')
    },
    { passive: true }
  )
  document.addEventListener('pointerup', release, { passive: true })
  document.addEventListener('pointercancel', release, { passive: true })
  // si el dedo se va del botón (scroll), se suelta sin halo
  document.addEventListener(
    'pointerleave',
    (e) => {
      if (current && e.target === current) {
        current.classList.remove('is-pressing')
        current = null
      }
    },
    { passive: true, capture: true }
  )
}
