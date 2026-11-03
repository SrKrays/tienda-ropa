import { API_URL } from '../data/catalog.js'

const TOKEN_KEY = 'admin-token'

export function getToken() {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')
    if (t && new Date(t.expires) > new Date()) return t.token
  } catch {
    /* nada */
  }
  return null
}

export function logout() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* nada */
  }
}

export class ApiError extends Error {
  constructor(messages, status) {
    super(messages.join(' '))
    this.messages = messages
    this.status = status
  }
}

async function call(path, { method = 'GET', json, form, auth = true } = {}) {
  if (!API_URL) throw new ApiError(['Falta configurar VITE_API_URL (la dirección de la API).'], 0)
  const headers = {}
  if (auth) headers.Authorization = 'Bearer ' + getToken()
  if (json !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: json !== undefined ? JSON.stringify(json) : form,
    })
  } catch {
    throw new ApiError(['No se pudo conectar con el servidor. Revisá internet y probá de nuevo (si hace rato que nadie entra, puede tardar un minuto en despertar).'], 0)
  }
  if (res.status === 401 && auth) {
    logout()
    throw new ApiError(['Se cerró la sesión. Volvé a entrar.'], 401)
  }
  if (res.status === 429) throw new ApiError(['Demasiados intentos. Esperá un minuto y probá de nuevo.'], 429)
  if (!res.ok) {
    let msgs = ['Algo salió mal (' + res.status + '). Probá de nuevo.']
    try {
      const body = await res.json()
      if (body.errors?.length) msgs = body.errors
    } catch {
      /* sin cuerpo */
    }
    throw new ApiError(msgs, res.status)
  }
  return res.status === 204 ? null : res.json()
}

export async function login(password) {
  const r = await call('/api/auth/login', { method: 'POST', json: { password }, auth: false })
  localStorage.setItem(TOKEN_KEY, JSON.stringify(r))
}

export const listProducts = () => call('/api/admin/products')

// data = datos de la prenda; front/back = Blob ya recortado (o null si no cambió)
export function saveProduct(id, data, front, back) {
  const form = new FormData()
  form.append('data', JSON.stringify(data))
  if (front) form.append('front', front, 'frente.' + (front.type === 'image/png' ? 'png' : 'webp'))
  if (back) form.append('back', back, 'espalda.' + (back.type === 'image/png' ? 'png' : 'webp'))
  return id ? call('/api/admin/products/' + encodeURIComponent(id), { method: 'PUT', form }) : call('/api/admin/products', { method: 'POST', form })
}

export const setActive = (id, active) => call(`/api/admin/products/${encodeURIComponent(id)}/active`, { method: 'PATCH', json: { active } })
export const deleteProduct = (id) => call('/api/admin/products/' + encodeURIComponent(id), { method: 'DELETE' })
export const saveOrder = (ids) => call('/api/admin/order', { method: 'PUT', json: ids })
