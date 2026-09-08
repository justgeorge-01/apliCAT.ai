/** Shared motion presets (ease-out, 200–300ms) – DESIGN.md: transform / opacity only. */
export const EASE = [0.16, 1, 0.3, 1] as const
export const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
}
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}
