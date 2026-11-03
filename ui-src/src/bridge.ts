// Tiny store connecting the ported engine (engine.js) to React-rendered shadcn dialogs/toasts.
import { toast as sonner } from "sonner"
type Ask = { title: string; desc: string; ok: string; resolve: (v: boolean) => void }
export type UIState = { help: boolean; paste: boolean; bin: string[] | null; ask: Ask | null }
let st: UIState = { help: false, paste: false, bin: null, ask: null }
const subs = new Set<() => void>()
export const B = {
  get: () => st,
  set(p: Partial<UIState>) { st = { ...st, ...p }; subs.forEach((f) => f()) },
  sub(f: () => void) { subs.add(f); return () => { subs.delete(f) } },
  modal: () => !!(st.paste || st.bin || st.ask),
  toast(m: string, act?: string, fn?: () => void, ms?: number) {
    sonner(m, { duration: ms || 2600, action: act && fn ? { label: act, onClick: fn } : undefined })
  },
  ask(title: string, desc: string, ok: string) {
    return new Promise<boolean>((resolve) => B.set({ ask: { title, desc, ok, resolve } }))
  },
  // filled in by engine.js
  paste: async (_t: string, _x: string) => false,
  restore: async (_k: string) => {},
}
