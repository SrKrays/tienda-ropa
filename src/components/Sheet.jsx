import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CloseIcon } from './icons.jsx'

// Panel que sube desde abajo. Se cierra con el botón grande, con Esc o tocando afuera.
export default function Sheet({ open, onClose, label, children, tall = false }) {
  const reduce = useReducedMotion()
  const closeRef = useRef(null)
  // El clic que abre el panel (tocar la prenda en el perchero) "rebotaba": el mismo clic
  // caía sobre el fondo oscuro recién aparecido y lo cerraba. Ahora solo cierra si el
  // toque EMPEZÓ sobre el fondo y pasó un instante desde que se abrió.
  const downOnBackdrop = useRef(false)
  const openedAt = useRef(0)
  useEffect(() => {
    if (open) openedAt.current = performance.now()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => closeRef.current?.focus(), 50)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.25 }}
          onPointerDown={(e) => {
            downOnBackdrop.current = e.target === e.currentTarget
          }}
          onClick={(e) => {
            const ok = downOnBackdrop.current && e.target === e.currentTarget && performance.now() - openedAt.current > 350
            downOnBackdrop.current = false
            if (ok) onClose()
          }}
        >
          <motion.div
            className={'sheet' + (tall ? ' is-tall' : '')}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 32 }}
          >
            <div className="sheet-head">
              <span className="sheet-grip" aria-hidden="true" />
              <button ref={closeRef} type="button" className="sheet-close" onClick={onClose}>
                <CloseIcon /> Cerrar
              </button>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
