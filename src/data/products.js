// Catálogo de prueba para el boceto.
// En la versión real esto viene de la API (.NET) con lo que sube el dueño desde el admin:
// fotos frente/espalda (con el fondo ya quitado), nombre, precio, talles con stock, categoría y etiqueta.
// Si una prenda no tiene foto de espalda, `back: null` y no se muestra el botón de dar vuelta.
// OJO: los precios son de ejemplo, solo para probar el carrito.

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
    description: 'Camiseta de fútbol de tela liviana y respirable, con escudo y detalles en negro.',
    sizes: { S: 0, M: 1, L: 2, XL: 0, XXL: 0 },
  },
]

export const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL']

export const formatPrice = (n) => '$ ' + Math.round(n).toLocaleString('es-AR')

// [NÚMERO DE WHATSAPP DEL LOCAL] con código de país, sin + ni espacios. Ej: 5493511234567
export const WHATSAPP_NUMBER = ''
