import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CloseIcon } from './icons.jsx'

// Panel que sube desde abajo. Se cierra con el botón grande, con Esc o tocando afuera.
export default function Sheet({ open, onClose, label, children, tall = false }) {
  const reduce = useReducedMotion()
  const closeRef = useRef(null)

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
          onClick={onClose}
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
            onClick={(e) => e.stopPropagation()}
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
