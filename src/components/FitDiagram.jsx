import { fitOf } from '../fit/sizing.js'

// "Así te queda": dibujo honesto (no foto) de una silueta con la altura y el pecho de la persona,
// y encima el contorno de la remera del talle elegido con sus medidas reales.
// Todo se calcula en centímetros y se dibuja en SVG: liviano, nítido y exacto.

const VIEW_W = 84 // cm de ancho que entran en el dibujo
// visto de frente, algo redondo de contorno C se ve de ~C / 2.9 de ancho (cuerpo y remera puesta)
const FRONT = 2.9
const TOP = -4 // cm arriba de la cabeza
const BOTTOM_K = 0.6 // se muestra hasta el 60 % de la altura (mitad de muslo)

function body(H, chest, isWoman) {
  const cx = 0
  const headR = H * 0.064
  const headY = headR + 1
  const neckY = H * 0.13 // base del cuello
  const shY = H * 0.175 // línea de hombros
  const chestY = H * 0.27
  const waistY = H * 0.385
  const hipY = H * 0.48
  const chestHalf = chest / FRONT / 2
  const shHalf = Math.max(H * 0.115, chestHalf * 1.2)
  const waistHalf = chestHalf * (isWoman ? 0.8 : 0.88)
  const hipHalf = chestHalf * (isWoman ? 1.05 : 0.95)
  const armW = chest * 0.085
  const neckHalf = H * 0.034
  const handY = H * 0.47
  const torso = [
    `M ${cx - neckHalf} ${neckY - 2}`,
    `L ${cx - neckHalf} ${neckY}`,
    `Q ${cx - shHalf * 0.6} ${neckY + 1.5} ${cx - shHalf} ${shY}`,
    // brazo izquierdo: por fuera hasta la mano y vuelve por dentro
    `Q ${cx - shHalf - armW * 0.55} ${shY + 3} ${cx - shHalf - armW * 0.4} ${shY + 14}`,
    `L ${cx - shHalf - armW * 0.2} ${handY}`,
    `Q ${cx - shHalf + armW * 0.25} ${handY + 4} ${cx - shHalf + armW * 0.55} ${handY}`,
    `L ${cx - chestHalf - 0.5} ${shY + H * 0.1}`,
    `Q ${cx - chestHalf} ${chestY} ${cx - waistHalf} ${waistY}`,
    `Q ${cx - hipHalf - 1} ${hipY - 6} ${cx - hipHalf} ${hipY}`,
    `L ${cx - hipHalf * 0.95} ${H * BOTTOM_K + 2}`,
    `L ${cx + hipHalf * 0.95} ${H * BOTTOM_K + 2}`,
    `L ${cx + hipHalf} ${hipY}`,
    `Q ${cx + hipHalf + 1} ${hipY - 6} ${cx + waistHalf} ${waistY}`,
    `Q ${cx + chestHalf} ${chestY} ${cx + chestHalf + 0.5} ${shY + H * 0.1}`,
    `L ${cx + shHalf - armW * 0.55} ${handY}`,
    `Q ${cx + shHalf - armW * 0.25} ${handY + 4} ${cx + shHalf + armW * 0.2} ${handY}`,
    `L ${cx + shHalf + armW * 0.4} ${shY + 14}`,
    `Q ${cx + shHalf + armW * 0.55} ${shY + 3} ${cx + shHalf} ${shY}`,
    `Q ${cx + shHalf * 0.6} ${neckY + 1.5} ${cx + neckHalf} ${neckY}`,
    `L ${cx + neckHalf} ${neckY - 2}`,
    'Z',
  ].join(' ')
  return { torso, headR, headY, neckY, shY, shHalf, chestHalf, armW, hipY, waistY, handY, H }
}

// contorno de la remera: ancho = ancho de la prenda estirada (de axila a axila),
// largo desde el hombro junto al cuello, manga desde la costura
function tee(b, m, fitType) {
  const loose = fitType === 'oversize' || fitType === 'buzo'
  // ancho = mitad del contorno de la prenda → de frente, puesta, se ve de (2·ancho) / 2.9
  const worn = m.ancho / FRONT
  const half = Math.max(worn, b.chestHalf + 0.4) // si es más chica que el cuerpo, se estira hasta el cuerpo
  const tight = worn < b.chestHalf + 0.4
  const top = b.neckY + 0.5
  const hem = top + m.largo
  // hombro de la remera: en las oversize cae más abajo del hombro
  const shHalf = loose ? Math.max(b.shHalf + 3, half * 1.15) : Math.max(b.shHalf + 0.6, half * 1.02)
  const shY = b.shY + (loose ? 3 : 0.6)
  const pitY = shY + Math.max(b.H * 0.1, m.ancho * 0.36)
  const neckHalf = b.H * 0.045
  // la manga sigue al brazo que cuelga (un poco abierto)
  const ang = (loose ? 30 : 22) * (Math.PI / 180)
  const sleeve = Math.max(4, m.manga)
  const open = Math.max(b.armW + 2, m.ancho * (loose ? 0.3 : 0.25)) // ancho del puño
  const side = (dir) => {
    const sx = dir * shHalf
    const ex = sx + dir * Math.sin(ang) * sleeve
    const ey = shY + Math.cos(ang) * sleeve
    // puño: perpendicular a la manga
    let ix = ex - dir * Math.cos(ang) * open
    const iy = ey + Math.sin(ang) * open
    // el puño nunca entra dentro del cuerpo de la remera (si no, se cruzan las líneas)
    if (dir * ix < half + 1.5) ix = dir * (half + 1.5)
    return { sx, ex, ey, ix, iy, px: dir * half }
  }
  const L = side(-1)
  const R = side(1)
  const pit = Math.max(pitY, L.iy + 2.5) // la axila queda debajo del puño
  const path = [
    `M ${-neckHalf} ${top}`,
    `Q ${-neckHalf * 1.4} ${top + 0.2} ${L.sx} ${shY}`,
    `L ${L.ex} ${L.ey}`,
    `L ${L.ix} ${L.iy}`,
    `L ${L.px} ${pit}`,
    `L ${-half - (loose ? 1 : 0)} ${hem}`,
    `Q 0 ${hem + 1.2} ${half + (loose ? 1 : 0)} ${hem}`,
    `L ${R.px} ${pit}`,
    `L ${R.ix} ${R.iy}`,
    `L ${R.ex} ${R.ey}`,
    `L ${R.sx} ${shY}`,
    `Q ${neckHalf * 1.4} ${top + 0.2} ${neckHalf} ${top}`,
    `Q 0 ${top + 7} ${-neckHalf} ${top}`,
    'Z',
  ].join(' ')
  return { path, hem, half, tight, pitY: pit, L, R }
}

// a qué parte del cuerpo llega el ruedo
function hemWhere(b, hem) {
  if (hem < b.waistY - 2) return 'arriba de la cintura'
  if (hem < b.waistY + 4) return 'a la cintura'
  if (hem < b.hipY - 3) return 'arriba de la cadera'
  if (hem < b.hipY + 4) return 'a la cadera'
  return 'debajo de la cadera'
}

export default function FitDiagram({ product, person, size, compare, sizes, onCompare }) {
  const f = fitOf(product, size, person)
  const b = body(person.height, f.chest, person.body === 'mujer')
  const t = tee(b, f.m, product.fitType)
  const c = compare ? tee(b, fitOf(product, compare, person).m, product.fitType) : null
  const H = person.height
  const viewH = H * BOTTOM_K - TOP + 4
  const gap = Math.round(2 * f.m.ancho - f.chest)
  const where = hemWhere(b, t.hem)
  const fitLabel = f.ease < 4 ? 'Ajustada' : f.ease < 16 ? 'Regular' : 'Holgada'
  const fitClass = f.ease < 0 ? 'bad' : f.ease < 4 ? 'tight' : f.ease < 16 ? 'ok' : 'loose'
  const fs = 3.2 // tamaño de letra en cm del dibujo

  return (
    <figure className="fitd">
      <div className="fitd-head">
        <span className={'fitd-badge ' + fitClass}>{fitLabel}</span>
        <span className="fitd-size">Talle {size}</span>
      </div>
      <svg
        viewBox={`${-VIEW_W / 2} ${TOP} ${VIEW_W} ${viewH}`}
        role="img"
        aria-label={`Dibujo: remera talle ${size} sobre una persona de ${H} cm. ${f.chestTxt}, le llega ${where}.`}
      >
        <defs>
          <linearGradient id="fitd-tee" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eedfc1" stopOpacity="0.62" />
            <stop offset="1" stopColor="#d8c7a0" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {/* silueta */}
        <circle cx="0" cy={b.headY} r={b.headR} className="fitd-body" />
        <path d={b.torso} className="fitd-body" />
        {/* talle para comparar (punteado) */}
        {c && <path d={c.path} className="fitd-compare" />}
        {/* remera del talle elegido */}
        <path d={t.path} fill="url(#fitd-tee)" className={'fitd-tee' + (t.tight ? ' is-tight' : '')} />

        {/* largo: flecha del hombro al ruedo */}
        <g className="fitd-dim">
          <line x1={t.half + 6} y1={b.neckY + 0.5} x2={t.half + 6} y2={t.hem} />
          <line x1={t.half + 4} y1={t.hem} x2={t.half + 8} y2={t.hem} />
          <line x1={t.half + 4} y1={b.neckY + 0.5} x2={t.half + 8} y2={b.neckY + 0.5} />
          <text x={t.half + 9} y={(b.neckY + t.hem) / 2} fontSize={fs}>
            {f.m.largo} cm
          </text>
        </g>
        {/* ancho */}
        <g className="fitd-dim">
          <line x1={-t.half} y1={t.pitY + 4} x2={t.half} y2={t.pitY + 4} />
          <text x="0" y={t.pitY + 9} fontSize={fs} textAnchor="middle">
            {f.m.ancho} cm
          </text>
        </g>
        {/* nombre del talle comparado */}
        {c && (
          <text x={-c.half - 2} y={c.hem + 4.5} fontSize={fs * 0.9} className="fitd-compare-label" textAnchor="end">
            {compare}
          </text>
        )}
      </svg>

      <ul className="fitd-facts">
        <li>
          <strong>Pecho:</strong> {gap >= 0 ? `te sobran ${gap} cm alrededor` : `te faltan ${-gap} cm: te va a quedar justa`} ({f.chestTxt})
        </li>
        <li>
          <strong>Largo:</strong> te llega {where} ({f.lenTxt})
        </li>
        <li>
          <strong>Mangas:</strong> {f.sleeveTxt}
        </li>
      </ul>

      {sizes.length > 1 && (
        <div className="fitd-compare-row" role="group" aria-label="Comparar con otro talle">
          <span>Comparar con:</span>
          {sizes
            .filter((s) => s !== size)
            .map((s) => (
              <button key={s} type="button" className={'size-dot' + (compare === s ? ' is-on' : '')} aria-pressed={compare === s} onClick={() => onCompare(compare === s ? null : s)}>
                {s}
              </button>
            ))}
        </div>
      )}
      <figcaption>Dibujo a escala con tu altura ({H} cm) y pecho ({f.chest} cm). Las medidas son de la prenda estirada.</figcaption>
    </figure>
  )
}
