# Tienda de ropa — boceto 1

Front en React + Vite + PixiJS. El perchero 2.5D es la portada: las prendas son fotos reales montadas sobre una malla con física de tela.

## Correr

```bash
npm install
npm run dev
```

## Dónde está cada cosa

- `src/rack/Garment.js` — una prenda: malla, física (péndulo + flexión de tela + ondulación), sombra, percha y etiqueta.
- `src/rack/Rack.js` — el perchero: caño, loop automático, velocidad (normal / rápido / pausa), flechas, caída al cambiar de categoría.
- `src/rack/Viewer.js` — la prenda grande del panel (frente / espalda). Se crea una sola vez porque PixiJS v8 comparte recursos entre Applications.
- `src/components/` — barra de categorías, panel de prenda, carrito con pago paso a paso, barra inferior.
- `src/data/products.js` — catálogo de prueba (después viene de la API .NET). Precios de ejemplo.
- `public/img/` — remera de prueba (frente/espalda sin fondo) y foto del local (desenfocada).

## Rendimiento (qué se hizo y por qué)

- PixiJS se carga aparte (import dinámico): la página pinta al instante y el perchero aparece apenas llega el motor.
- Los paneles (prenda y carrito) y framer-motion también se cargan aparte, y se precargan cuando el navegador está libre.
- Mallas de 99 vértices: PixiJS junta todas las prendas en un solo draw call. La sombra comparte la malla de la tela.
- Sombras "horneadas" una vez por foto (antes era un filtro de desenfoque por prenda en cada frame).
- Mipmaps en las fotos (no titilan al moverse). Las prendas fuera de pantalla no se deforman.
- Resolución máxima 1.75x en celular / 2x en compu, y antialias solo en pantallas 1x.
- Con un panel abierto el perchero deja de dibujarse.
- Sin backdrop-filter (re-desenfocaba el fondo en cada frame encima del canvas) y el ajuste de color del fondo viene horneado en la imagen.
- Fuentes solo con el subset latino.

## Fotos de las prendas (para el dueño)

Dos fotos por prenda (frente y espalda), colgada en percha, de frente, sobre fondo liso claro, misma distancia y luz. El fondo se va a quitar automático al subirlas desde el admin.

## Pendiente

- API .NET + base de datos (productos, talles/stock, pedidos).
- Admin para subir prendas con recorte automático del fondo.
- Mercado Pago real, número de WhatsApp, textos del local (`[PLACEHOLDERS]`).
