# Tienda de ropa

Front en React + Vite + PixiJS. El perchero 2.5D es la portada: las prendas son fotos reales montadas sobre una malla con física de tela.

## Correr

```bash
npm install
npm run dev
```

## Estética (v3 · vidriera)

- La prenda del centro es la protagonista: más grande, con luz de spot; las de los costados giran 3/4 (perspectiva falsa sobre la malla), se achican y quedan en penumbra.
- Recorrido automático: avanza de a una prenda y espera unos segundos. Elegir talle, color o dar vuelta la prenda lo frena; las flechas, el arrastre o tocar una prenda del costado lo retoman.
- Percha y perchero son fotos reales recortadas (`public/img/ui/`). El caño se estira a lo ancho; los postes se arman con codo + tramo + base.

## Dónde está cada cosa

- `src/rack/Garment.js` — una prenda: malla, física (péndulo + flexión de tela + ondulación), sombra, percha y etiqueta.
- `src/rack/Rack.js` — el perchero: caño, loop automático, velocidad (normal / rápido / pausa), flechas, caída al cambiar de categoría.
- `src/rack/Viewer.js` — la prenda grande del panel (frente / espalda). Se crea una sola vez porque PixiJS v8 comparte recursos entre Applications.
- `src/components/` — barra de categorías, panel de prenda, carrito con pago paso a paso, barra inferior.
- `src/data/catalog.js` — trae las prendas de la API (con `VITE_API_URL`); sin API usa el catálogo de prueba `src/data/products.js`.
- `src/admin/` — panel del local (`/admin`): login, lista, formulario y recorte automático del fondo (`cutout.js`).
- `api/` — API .NET 10 (productos, fotos, login).
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

Dos fotos por prenda (frente y espalda), con la prenda **estirada sobre una pared, mesa o sábana lisa**, de frente, con buena luz y sin percha. El fondo se quita solo en el panel. Prenda clara → fondo oscuro; prenda oscura → fondo claro.

## Backend (fase final)

```
Vercel (tienda + /admin)  ──►  Render: API .NET 10  ──►  PostgreSQL (Render)
                                       │
                                       └─ fotos: en la base (prueba)  ·  por FTP a Don Web (producción)
```

- `GET  /api/products` — prendas visibles (la tienda)
- `GET  /api/images/{archivo}` — fotos guardadas en la base (caché de 1 año)
- `POST /api/auth/login` — contraseña del local → token (12 h, máx. 5 intentos por minuto)
- `GET/POST /api/admin/products`, `PUT/DELETE /api/admin/products/{id}`, `PATCH .../{id}/active`, `PUT /api/admin/order`
- `GET  /health` — para el keep-alive

### Variables de la API (Render → Environment)

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | la URL de la base (Render la pone sola con el Blueprint) |
| `DB_PROVIDER` | `postgres` (Render) o `mysql` (Don Web / Clever Cloud) |
| `ADMIN_PASSWORD` | la contraseña del panel (mínimo 8 caracteres) |
| `JWT_KEY` | clave larga al azar (el Blueprint la genera sola) |
| `CORS_ORIGINS` | `https://tu-tienda.vercel.app,http://localhost:5173` |
| `IMAGE_STORE` | `db` (prueba) o `ftp` (Don Web) |
| `FTP_HOST`, `FTP_USER`, `FTP_PASS` | solo con `IMAGE_STORE=ftp` |
| `FTP_DIR` | ej: `/public_html/img/productos` |
| `FTP_PUBLIC_URL` | ej: `https://www.tienda.com.ar/img/productos` |

### Deploy de prueba

1. **Subir a GitHub** (`SrKrays/tienda-ropa`).
2. **Render** → New → **Blueprint** → elegir el repo. Crea `tienda-api` (Docker) y `tienda-db` (Postgres). Cargar `ADMIN_PASSWORD` y `CORS_ORIGINS` cuando lo pida.
3. Abrir `https://tienda-api.onrender.com/health` → tiene que decir `ok: true`.
4. **Vercel** → Add New Project → el mismo repo (Framework: Vite). En Environment Variables: `VITE_API_URL = https://tienda-api.onrender.com`. Deploy.
5. Entrar a `https://<tu-tienda>.vercel.app/admin`, poner la contraseña y cargar la primera prenda (o el botón "Cargar las 4 prendas de ejemplo").
6. **Keep-alive**: en cron-job.org, un GET a `/health` cada 10 minutos (igual que Bruzz) para que Render no se duerma.

> Render gratis: la base Postgres free vence a los 30 días. Para la prueba alcanza; para producción, MySQL en Don Web.

### Pasar a Don Web (producción)

1. Crear la carpeta `public_html/img/productos` en el hosting y subirle este `.htaccess` (las fotos se leen desde la tienda y el probador necesita permiso):
   ```apache
   Header set Access-Control-Allow-Origin "*"
   Header set Cache-Control "public, max-age=31536000, immutable"
   ```
2. En Render: `IMAGE_STORE=ftp` + las variables `FTP_*`. Las fotos nuevas suben por FTP (FluentFTP), como en Bruzz.
3. Base MySQL de Don Web: `DB_PROVIDER=mysql` y `DATABASE_URL=Server=...;Database=...;Uid=...;Pwd=...;`. Las tablas se crean solas al arrancar.
4. La tienda (dist/) se puede subir por FTP al mismo hosting, igual que Bruzz (con `VITE_API_URL` apuntando a la API).

### Correr todo local

```bash
# API (necesita .NET 10 y un Postgres)
cd api/TiendaApi
set DATABASE_URL=Host=localhost;Database=tienda;Username=postgres;Password=...
set ADMIN_PASSWORD=probando123
set JWT_KEY=una-clave-larga-de-mas-de-32-caracteres-123
dotnet run --urls http://localhost:5080

# Tienda + admin (en otra terminal, en la raíz)
echo VITE_API_URL=http://localhost:5080 > .env.local
npm run dev        # tienda: http://localhost:5173  ·  panel: http://localhost:5173/admin.html
```

## Pendiente

- Textos del local y marca (`[MARCA]`), dominio.
- Medidas reales de cada prenda (se cargan en el panel → Más opciones).
