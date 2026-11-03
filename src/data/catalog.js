import { useEffect, useState } from 'react'
import { PRODUCTS as DEMO } from './products.js'

// De dónde salen las prendas:
//  - con VITE_API_URL (ej: https://tienda-api.onrender.com) → de la API, lo que carga el local desde /admin
//  - sin VITE_API_URL → el catálogo de prueba de products.js (para diseñar sin backend)
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const CACHE_KEY = 'catalogo-v1'

// las fotos guardadas en la base vienen como "/api/images/..." → hay que sumarles la dirección de la API
export const imgUrl = (u) => (!u ? null : /^https?:\/\//.test(u) || !API_URL ? u : API_URL + u)

export function normalize(p) {
  return {
    ...p,
    front: imgUrl(p.front),
    back: imgUrl(p.back),
    tag: p.tag || (p.oldPrice ? `-${Math.round((1 - p.price / p.oldPrice) * 100)}%` : null),
    categories: p.categories || [],
    colors: p.colors || [],
    measures: p.measures || undefined,
    tryOn: p.tryOn !== false,
  }
}

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    return Array.isArray(c) ? c : null
  } catch {
    return null
  }
}

async function fetchCatalog(signal) {
  const res = await fetch(API_URL + '/api/products', { signal })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const list = (await res.json()).map(normalize)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list))
  } catch {
    /* sin storage */
  }
  return list
}

// Muestra al instante lo último que se vio (guardado en el navegador) y en paralelo trae lo nuevo.
// Render gratis "se duerme": la primera visita puede tardar ~1 minuto en despertarla, por eso
// se reintenta solo, sin mostrar nunca prendas de prueba en la tienda real.
export function useCatalog() {
  const [state, setState] = useState(() => {
    if (!API_URL) return { products: DEMO, status: 'ok' }
    const cached = readCache()
    return cached ? { products: cached, status: 'refreshing' } : { products: null, status: 'loading' }
  })

  useEffect(() => {
    if (!API_URL) return
    let alive = true
    let timer = null
    const ctrl = new AbortController()
    const run = async (attempt) => {
      try {
        const list = await fetchCatalog(ctrl.signal)
        if (alive) setState({ products: list, status: 'ok' })
      } catch {
        if (!alive) return
        setState((s) => ({ ...s, status: s.products ? 'stale' : 'waking' }))
        timer = setTimeout(() => run(attempt + 1), Math.min(20000, 3000 * attempt))
      }
    }
    run(1)
    return () => {
      alive = false
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [])

  return state
}
