// Guía de talles y calculadora.
// Las medidas de cada prenda se toman con la prenda estirada sobre una mesa:
//   ancho = de axila a axila (la mitad del contorno), largo = desde el hombro junto al cuello hasta el ruedo,
//   manga = desde la costura del hombro hasta el puño. Todo en centímetros.
// Mientras no tengamos las medidas reales del local, usamos una tabla estándar por tipo de prenda.

export const SIZE_TABLES = {
  remera: {
    S: { ancho: 50, largo: 70, manga: 19 },
    M: { ancho: 53, largo: 72, manga: 20 },
    L: { ancho: 56, largo: 74, manga: 21 },
    XL: { ancho: 59, largo: 76, manga: 22 },
    XXL: { ancho: 62, largo: 78, manga: 23 },
  },
  oversize: {
    S: { ancho: 55, largo: 70, manga: 22 },
    M: { ancho: 58, largo: 72, manga: 23 },
    L: { ancho: 61, largo: 74, manga: 24 },
    XL: { ancho: 64, largo: 76, manga: 25 },
    XXL: { ancho: 67, largo: 78, manga: 26 },
  },
  buzo: {
    S: { ancho: 56, largo: 66, manga: 60 },
    M: { ancho: 59, largo: 68, manga: 62 },
    L: { ancho: 62, largo: 70, manga: 64 },
    XL: { ancho: 65, largo: 72, manga: 66 },
    XXL: { ancho: 68, largo: 74, manga: 68 },
  },
  camiseta: {
    S: { ancho: 49, largo: 70, manga: 20 },
    M: { ancho: 52, largo: 72, manga: 21 },
    L: { ancho: 55, largo: 74, manga: 22 },
    XL: { ancho: 58, largo: 76, manga: 23 },
    XXL: { ancho: 61, largo: 78, manga: 24 },
  },
}

export function measuresOf(product, size) {
  // medidas reales cargadas en el panel; si ese talle no las tiene, la tabla estándar del tipo de prenda
  const std = SIZE_TABLES[product.fitType] || SIZE_TABLES.remera
  return product.measures?.[size] || std[size] || std.M
}

export const FIT_PREFS = [
  { id: 'ajustado', label: 'Ajustada', hint: 'Marca el cuerpo, mangas justas', ease: 6 },
  { id: 'regular', label: 'Regular', hint: 'Cómoda, ni chica ni grande', ease: 12 },
  { id: 'suelto', label: 'Suelta', hint: 'Holgada, estilo oversize', ease: 22 },
]

// Contorno de pecho estimado a partir de altura y peso (aproximación; si la persona sabe su medida, mejor)
export function estimateChest({ height, weight, body = 'hombre' }) {
  if (body === 'mujer') return Math.round(88 + 0.85 * (weight - 62) - 0.1 * (height - 165))
  return Math.round(94 + 0.9 * (weight - 75) - 0.12 * (height - 178))
}

export const DEFAULT_PERSON = { height: 178, weight: 75, body: 'hombre', chest: null, pref: 'regular' }

export function personChest(person) {
  return person.chest ? Number(person.chest) : estimateChest(person)
}

// Cómo le queda un talle a una persona
export function fitOf(product, size, person) {
  const m = measuresOf(product, size)
  const chest = personChest(person)
  const ease = 2 * m.ancho - chest // holgura total de pecho, en cm
  const idealLen = 0.4 * person.height // largo "justo" para esa altura
  const lenDiff = m.largo - idealLen

  let chestTxt
  if (ease < 0) chestTxt = 'muy ajustada de pecho'
  else if (ease < 6) chestTxt = 'ajustada al cuerpo'
  else if (ease < 14) chestTxt = 'cómoda de pecho'
  else if (ease < 24) chestTxt = 'suelta'
  else chestTxt = 'muy holgada (oversize)'

  let lenTxt
  if (lenDiff < -5) lenTxt = 'te queda corta'
  else if (lenDiff < -1.5) lenTxt = 'un poco corta'
  else if (lenDiff <= 3.5) lenTxt = 'largo justo'
  else if (lenDiff <= 8) lenTxt = 'un poco larga'
  else lenTxt = 'larga'

  let sleeveTxt
  if (ease < 4) sleeveTxt = 'mangas justas al brazo'
  else if (ease < 16) sleeveTxt = 'mangas cómodas'
  else sleeveTxt = 'mangas sueltas'

  return { size, m, chest, ease, lenDiff, chestTxt, lenTxt, sleeveTxt }
}

// Talle recomendado según preferencia de calce (y si hay stock)
export function recommend(product, person, sizes) {
  const pref = FIT_PREFS.find((p) => p.id === person.pref) || FIT_PREFS[1]
  let best = null
  for (const s of sizes) {
    const f = fitOf(product, s, person)
    let score = Math.abs(f.ease - pref.ease) + Math.max(0, -f.lenDiff - 3) * 1.5
    if (f.ease < 0) score += 20
    const stock = product.sizes?.[s] ?? 0
    const cand = { ...f, score, stock }
    if (!best || score < best.score) best = cand
  }
  return best
}

export function fitSentence(f) {
  return `Con el ${f.size}: ${f.chestTxt}, ${f.lenTxt} y ${f.sleeveTxt}.`
}

// Comparar con una remera propia que le queda bien: la persona la estira sobre la mesa y mide ancho y largo.
export function compareTee(product, size, tee) {
  const m = measuresOf(product, size)
  const dA = m.ancho - Number(tee.ancho)
  const dL = m.largo - Number(tee.largo)
  const txt = (d, mas, menos) => (Math.abs(d) < 1 ? 'igual' : `${Math.abs(Math.round(d))} cm ${d > 0 ? mas : menos}`)
  return {
    size,
    m,
    dA,
    dL,
    score: Math.abs(dA) * 2 + Math.abs(dL) * 0.6,
    anchoTxt: dA === 0 || Math.abs(dA) < 1 ? 'mismo ancho' : `${txt(dA, 'más ancha', 'más angosta')}`,
    largoTxt: Math.abs(dL) < 1 ? 'mismo largo' : `${txt(dL, 'más larga', 'más corta')}`,
  }
}

export function recommendFromTee(product, tee, sizes) {
  let best = null
  for (const s of sizes) {
    const c = { ...compareTee(product, s, tee), stock: product.sizes?.[s] ?? 0 }
    if (!best || c.score < best.score) best = c
  }
  return best
}
