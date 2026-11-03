const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const BagIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <path d="M5 8h14l-1.2 12H6.2z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
)
export const PauseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <path d="M9 5v14M15 5v14" />
  </svg>
)
export const PlayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <path d="M7 5l12 7-12 7z" />
  </svg>
)
export const FastIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <path d="M4 6l8 6-8 6zM12 6l8 6-8 6z" />
  </svg>
)
export const ChevronLeft = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" {...s} strokeWidth="2.4">
    <path d="M15 5l-7 7 7 7" />
  </svg>
)
export const ChevronRight = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" {...s} strokeWidth="2.4">
    <path d="M9 5l7 7-7 7" />
  </svg>
)
export const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...s} strokeWidth="2.4">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const WhatsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <path d="M4 20l1.3-3.8A8 8 0 1 1 8.2 19z" />
    <path d="M9.5 9.5c.3 1.8 2.2 3.8 4 4.3l1.2-1.1 1.6.8c-.2 1-1 1.7-2 1.7-3.2 0-6.5-3.3-6.5-6.5 0-1 .7-1.8 1.7-2l.8 1.6z" />
  </svg>
)
export const CheckIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" {...s} strokeWidth="2.6">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
)
export const TurnIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...s}>
    <path d="M4 12a8 8 0 0 1 14-5.3L20 9" />
    <path d="M20 4v5h-5" />
    <path d="M20 12a8 8 0 0 1-14 5.3L4 15" />
    <path d="M4 20v-5h5" />
  </svg>
)
export const ArrowUpRight = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...s} strokeWidth="2.2">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
)
export const SparkleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...s} strokeWidth="1.6">
    <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" />
    <path d="M19 15.5c.2 1.4.8 2 2.2 2.2-1.4.2-2 .8-2.2 2.2-.2-1.4-.8-2-2.2-2.2 1.4-.2 2-.8 2.2-2.2z" />
  </svg>
)
export const HangerIcon = () => (
  <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true" {...s} strokeWidth="1.6">
    <path d="M17 9V7.5a2.6 2.6 0 1 0-2.6-2.6" />
    <path d="M17 9L3 19.5c-1 .8-.5 2.5.9 2.5h26.2c1.4 0 1.9-1.7.9-2.5L17 9z" />
  </svg>
)
export const BagLargeIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true" {...s} strokeWidth="1.5">
    <path d="M5 8h14l-1.2 12.2H6.2z" />
    <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
  </svg>
)
export const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...s} strokeWidth="2.4">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const RulerIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...s} strokeWidth="1.8">
    <path d="M3.5 15.5l12-12 5 5-12 12z" />
    <path d="M7 12l2 2M9.5 9.5l1.5 1.5M12 7l2 2M14.5 4.5l1.5 1.5" />
  </svg>
)
