// Catálogo de prueba para el boceto.
// En la versión real esto viene de la API (.NET) con lo que sube el dueño desde el admin:
// fotos frente/espalda (con el fondo ya quitado), nombre, precio, talles con stock, categoría y etiqueta.
// Si una prenda no tiene foto de espalda, `back: null` y no se muestra el botón de dar vuelta.
// `fitType` / `measures`: guía de talles para la calculadora. `tryOn: false` oculta el probador.
// `colors`: por ahora son de prueba y no cambian la foto. Con el admin, cada color tendrá sus fotos.
// OJO: los precios son de ejemplo, solo para probar el carrito.

// Textos del encabezado editorial según la categoría
export const HEADLINES = {
  todo: { title: 'Nueva temporada.', sub: 'Prendas que hablan por sí solas.' },
  mujer: { title: 'Mujer.', sub: 'Básicos y prendas con carácter.' },
  hombre: { title: 'Hombre.', sub: 'Lo que se usa todos los días, mejor hecho.' },
  basicos: { title: 'Básicos.', sub: 'Las prendas que combinan con todo.' },
  ofertas: { title: 'Ofertas.', sub: 'Mismas prendas, mejor precio.' },
}
export const COLLECTION_LABEL = 'Colección'
export const COLLECTION_YEAR = '2026'

export const CATEGORIES = [
  { id: 'todo', label: 'Todo' },
  { id: 'mujer', label: 'Mujer' },
  { id: 'hombre', label: 'Hombre' },
  { id: 'basicos', label: 'Básicos' },
  { id: 'ofertas', label: 'Ofertas' },
]

export const PRODUCTS = [
  {
    id: 'skull',
    name: 'Remera Skull Washed',
    front: '/img/remera-frente.webp',
    back: '/img/remera-espalda.webp',
    price: 19900,
    oldPrice: 24900,
    tag: '-20%',
    categories: ['hombre', 'ofertas'],
    colors: [{ id: 'negro', name: 'Negro lavado', hex: '#2b2a28' }],
    fitType: 'oversize', // tabla de talles (ver src/fit/sizing.js). Con medidas reales: measures: { S: {ancho, largo, manga}, ... }
    description: 'Remera de algodón con lavado vintage (washed). Calce oversize, cuello reforzado y estampa de calavera en el frente y la espalda.',
    sizes: { S: 4, M: 6, L: 3, XL: 0, XXL: 2 },
  },
  {
    id: 'blanca',
    name: 'Remera Básica Blanca',
    front: '/img/blanca-frente.webp',
    back: '/img/blanca-espalda.webp',
    price: 12900,
    categories: ['basicos', 'mujer', 'hombre'],
    fitType: 'remera',
    colors: [
      { id: 'blanco', name: 'Blanco', hex: '#f4f2ec' },
      { id: 'negro', name: 'Negro', hex: '#1b1a18' },
      { id: 'gris', name: 'Gris melange', hex: '#8f8d88' },
    ],
    description: 'Remera lisa de algodón peinado, cuello redondo y calce regular. El básico que combina con todo.',
    sizes: { S: 8, M: 10, L: 7, XL: 5, XXL: 3 },
  },
  {
    id: 'buzo-spidey',
    name: 'Buzo Canguro Comic',
    front: '/img/buzo-frente.webp',
    back: '/img/buzo-espalda.webp',
    price: 39900,
    tag: 'NUEVO',
    categories: ['hombre', 'mujer'],
    fitType: 'buzo',
    tryOn: false, // el probador todavía no soporta capucha
    colors: [
      { id: 'crudo', name: 'Crudo', hex: '#ece6d8' },
      { id: 'negro', name: 'Negro', hex: '#1b1a18' },
    ],
    description: 'Buzo canguro de frisa con capucha y bolsillo delantero. Estampa estilo cómic en el pecho y gran estampa en la espalda.',
    sizes: { S: 2, M: 4, L: 3, XL: 1, XXL: 0 },
  },
  {
    id: 'belgrano',
    name: 'Camiseta Belgrano',
    front: '/img/camiseta-frente.webp',
    back: null,
    price: 54900,
    tag: 'ÚLTIMOS 3',
    categories: ['hombre'],
    fitType: 'camiseta',
    colors: [
      { id: 'celeste', name: 'Celeste', hex: '#1f8fe0' },
      { id: 'blanca', name: 'Blanca', hex: '#f4f2ec' },
      { id: 'negra', name: 'Negra', hex: '#1b1a18' },
    ],
    description: 'Camiseta de fútbol de tela liviana y respirable, con escudo y detalles en negro.',
    sizes: { S: 0, M: 1, L: 2, XL: 0, XXL: 0 },
  },
]

export const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL']

export const formatPrice = (n) => '$ ' + Math.round(n).toLocaleString('es-AR')

// [NÚMERO DE WHATSAPP DEL LOCAL] con código de país, sin + ni espacios. Ej: 5493511234567
export const WHATSAPP_NUMBER = '5493543582442' // +54 9 3543 58-2442
