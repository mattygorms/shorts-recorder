import { useEffect, useState, useSyncExternalStore, useRef } from "react"
import { RefreshCw, Trash2, ArchiveRestore, ClipboardPaste, Pencil, Folder, Undo2, Scissors, Crop, Wand2, Timer, FilePlus2, Download, Play, Search, FileText, Lock, LockOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Kbd } from "@/components/ui/kbd"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Toaster } from "@/components/ui/sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { B } from "./bridge"
import { startEngine } from "./engine"
import { updateView } from "./updateBadge.js"

const useUI = () => useSyncExternalStore(B.sub, B.get)

function Tip({ tip, children }: { tip: React.ReactNode; children: React.ReactElement }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent>{tip}</TooltipContent></Tooltip>
}

const SHORTCUTS: [string, React.ReactNode][] = [
  ["Play / pause from playhead", <Kbd>Space</Kbd>],
  ["Record / stop (continues from playhead)", <Kbd>R</Kbd>],
  ["Set playhead", <span>Click timeline</span>],
  ["Select region", <span>Drag · Shift+click</span>],
  ["Cut selection", <Kbd>Del</Kbd>],
  ["Undo / redo audio", <span className="flex gap-1"><Kbd>Ctrl+Z</Kbd><Kbd>Ctrl+Y</Kbd></span>],
  ["Auto-trim ends", <Kbd>T</Kbd>],
  ["Crop to selection", <Kbd>C</Kbd>],
  ["Clear selection", <Kbd>Esc</Kbd>],
  ["Move playhead", <span className="flex gap-1"><Kbd>←</Kbd><Kbd>→</Kbd><Kbd>Home</Kbd><Kbd>End</Kbd></span>],
  ["Delete script (list focused)", <Kbd>Del</Kbd>],
  ["Edit script text", <Kbd>E</Kbd>],
  ["Done editing", <Kbd>Esc</Kbd>],
  ["This help", <Kbd>?</Kbd>],
]

function Overlays() {
  const ui = useUI()
  const [title, setTitle] = useState(""), [text, setText] = useState("")
  return <>
    <Dialog open={ui.paste} onOpenChange={(o) => B.set({ paste: o })}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Paste a script</DialogTitle><DialogDescription>Edits to a pasted script stay in this session.</DialogDescription></DialogHeader>
        <Input id="pTitle" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea id="pText" placeholder="Script text" className="h-56" value={text} onChange={(e) => setText(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => B.set({ paste: false })}>Cancel</Button>
          <Button id="pOk" onClick={async () => { if (await B.paste(title, text)) { setTitle(""); setText("") } }}>Use script</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!ui.bin} onOpenChange={(o) => { if (!o) B.set({ bin: null }) }}>
      <DialogContent id="binDlg" className="sm:max-w-md">
        <DialogHeader><DialogTitle>Deleted scripts</DialogTitle><DialogDescription>Kept in scripts\_deleted. Restore puts them back in the list.</DialogDescription></DialogHeader>
        <ScrollArea className="max-h-[50vh]">
          <div id="delList" className="divide-y divide-border">
            {ui.bin && !ui.bin.length && <p className="py-3 text-sm text-muted-foreground">Nothing deleted.</p>}
            {ui.bin?.map((k) => <div key={k} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate">{k}</span>
              <Button size="sm" variant="outline" onClick={() => B.restore(k)}>Restore</Button>
            </div>)}
          </div>
        </ScrollArea>
        <DialogFooter><Button variant="outline" id="binClose" onClick={() => B.set({ bin: null })}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!ui.ask} onOpenChange={(o) => { if (!o && ui.ask) { ui.ask.resolve(false); B.set({ ask: null }) } }}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader><AlertDialogTitle>{ui.ask?.title}</AlertDialogTitle><AlertDialogDescription>{ui.ask?.desc}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel id="askCancel" onClick={() => { ui.ask?.resolve(false); B.set({ ask: null }) }}>Cancel</AlertDialogCancel>
          <AlertDialogAction id="askOk" variant="destructive" onClick={() => { ui.ask?.resolve(true); B.set({ ask: null }) }}>{ui.ask?.ok}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}

function Help() {
  const ui = useUI()
  return <Popover open={ui.help} onOpenChange={(o) => B.set({ help: o })}>
    <PopoverTrigger asChild><Button id="helpBtn" variant="ghost" size="icon-sm" title="Keyboard shortcuts (?)" className="font-semibold">?</Button></PopoverTrigger>
    <PopoverContent id="help" side="right" align="start" className="w-80" onOpenAutoFocus={(e) => e.preventDefault()}>
      <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">Shortcuts</p>
      <div className="space-y-1.5 text-sm">
        {SHORTCUTS.map(([l, k]) => <div key={l} className="flex items-center justify-between gap-3 text-muted-foreground"><span>{l}</span><span className="text-foreground">{k}</span></div>)}
      </div>
      <Separator className="my-3" />
      <p className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">Recording</p>
      <p className="text-sm leading-relaxed text-muted-foreground">With a selection, R replaces just that region. With the playhead mid-take it replaces from there to the end. At the end it keeps going.</p>
    </PopoverContent>
  </Popover>
}

function Section({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
  return <div className="px-3 py-2.5">
    <div className="mb-1.5 flex h-6 items-center justify-between"><span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{label}</span>{right}</div>
    {children}
  </div>
}

const name = (k: string) => k.replace(/\.(txt|json)$/i, "")
const fmtCreated = (ms: number | null) => {
  if (!ms) return ""
  const d = new Date(ms)
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })
  return date + " · " + time
}

function ScriptList() {
  const ui = useUI()
  const [q, setQ] = useState("")
  const list = ui.scripts.filter((r) => name(r.k).toLowerCase().includes(q.trim().toLowerCase()))
  const focusRow = (k: string) => requestAnimationFrame(() => (document.querySelector(`#scriptList [data-k="${CSS.escape(k)}"]`) as HTMLElement | null)?.focus())
  const onKey = (e: React.KeyboardEvent) => {
    if (!list.length) return
    const i = list.findIndex((r) => r.k === ui.cur)
    let j = -1
    if (e.key === "ArrowDown") j = Math.min(list.length - 1, i + 1)
    else if (e.key === "ArrowUp") j = i < 0 ? 0 : Math.max(0, i - 1)
    else if (e.key === "Home") j = 0
    else if (e.key === "End") j = list.length - 1
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); if (ui.cur) B.del(ui.cur); return }
    else return
    e.preventDefault()
    if (list[j] && list[j].k !== ui.cur) { B.pick(list[j].k); focusRow(list[j].k) }
  }
  return <Section label="Scripts" right={<div className="flex items-center">
    <Tip tip="Refresh the scripts list"><Button id="refBtn" variant="ghost" size="icon-xs"><RefreshCw /></Button></Tip>
    <Tip tip="Deleted scripts / restore"><Button id="binBtn" variant="ghost" size="icon-xs" style={{ display: "none" }}><ArchiveRestore /></Button></Tip>
  </div>}>
    {ui.scripts.length > 6 && <div className="relative mb-1.5"><Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="scriptFilter" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter scripts" className="h-7 pl-7 text-xs" /></div>}
    <ScrollArea className="min-w-0 h-[min(40vh,380px)] rounded-md border bg-background/40">
      <div id="scriptList" role="listbox" aria-label="Scripts (Del deletes the selected script)" onKeyDown={onKey} className="min-w-0 w-full overflow-x-hidden p-1">
        {!ui.scripts.length && <p className="px-2 py-3 text-xs text-muted-foreground">No scripts from today. Lock a script to keep it in the list, or restore one from Deleted.</p>}
        {ui.scripts.length > 0 && !list.length && <p className="px-2 py-3 text-xs text-muted-foreground">No match.</p>}
        {(() => {
          const locked = list.filter((r) => r.locked)
          const today = list.filter((r) => !r.locked)
          const row = (r: typeof list[number]) => {
            const k = r.k
            const sel = k === ui.cur
            const when = fmtCreated(r.created)
            return <div key={k} data-k={k} role="option" aria-selected={sel} tabIndex={sel || (!ui.cur && k === list[0]?.k) ? 0 : -1}
              onClick={() => B.pick(k)}
              className={"group/row flex min-h-10 w-full min-w-0 cursor-pointer items-center gap-1 overflow-hidden rounded-md py-1 pr-1 pl-2 text-sm outline-none select-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/60 " + (sel ? "sel bg-accent font-medium text-accent-foreground" : "text-muted-foreground")}>
              <FileText className="size-3.5 shrink-0 opacity-60" />
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="block truncate" title={name(k)}>{name(k)}</span>
                {when && <span className="block truncate text-[10px] font-normal tracking-wide text-muted-foreground/80" title={when}>{when}</span>}
              </span>
              <button type="button" tabIndex={-1} aria-label={(r.locked ? "Unlock " : "Lock ") + name(k)} aria-pressed={!!r.locked}
                title={r.locked ? "Unlock (older scripts leave the list unless locked)" : "Lock (keep this script in the list)"}
                onClick={(e) => { e.stopPropagation(); B.toggleLock(k) }}
                className={"rowLock grid size-6 shrink-0 place-items-center rounded hover:bg-accent " + (r.locked ? "text-amber-400" : "text-muted-foreground")}>{r.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}</button>
              <span className="rowDelWrap shrink-0" title={r.locked ? "Unlock to delete" : "Delete (moves it to scripts\_deleted)"}>
                <button type="button" tabIndex={-1} disabled={!!r.locked} aria-disabled={!!r.locked} aria-label={r.locked ? "Unlock to delete " + name(k) : "Delete " + name(k)}
                  onClick={(e) => { e.stopPropagation(); if (!r.locked) B.del(k) }}
                  className={"rowDel grid size-6 shrink-0 place-items-center rounded " + (r.locked ? "cursor-not-allowed text-muted-foreground/40" : "text-muted-foreground hover:bg-destructive/20 hover:text-red-400")}><Trash2 className="size-3.5" /></button>
              </span>
            </div>
          }
          const label = (text: string) => <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{text}</p>
          return <>
            {locked.length > 0 && <>{label("Locked")}{locked.map(row)}</>}
            {today.length > 0 && <>{(locked.length > 0) && label("Today")}{today.map(row)}</>}
          </>
        })()}
      </div>
    </ScrollArea>
    <div className="mt-1.5 grid grid-cols-2 gap-1">
      <Button id="pasteBtn" variant="outline" size="sm"><ClipboardPaste />Paste</Button>
      <Button id="editBtn" variant="outline" size="sm" title="Edit the script text (E)" className="[&.act]:bg-accent"><Pencil /><span id="editLbl">Edit</span></Button>
    </div>
  </Section>
}

function MicPicker() {
  const ui = useUI()
  return <div className="flex items-center gap-2">
    <div className="relative h-8 w-1.5 shrink-0 overflow-hidden rounded-full bg-muted" title="Input level"><i id="lvl" className="absolute inset-x-0 bottom-0 block" /></div>
    <Select value={ui.mic || undefined} onValueChange={(v) => B.pickMic(v === "default" && !ui.mics.some((m) => m.id === "default") ? "" : v)}>
      <SelectTrigger id="micSel" size="sm" className="w-full min-w-0" title="Microphone"><SelectValue placeholder="Microphone" /></SelectTrigger>
      <SelectContent id="micList" position="popper" className="max-w-[340px]">
        {ui.mics.map((m) => <SelectItem key={m.id || "default"} value={m.id || "default"}>{m.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
}

function UpdateButton() {
  const ui = useUI()
  const v = updateView(ui.latest, window.APP_VERSION, ui.updateError)
  return <Button id="updBtn" variant="ghost" size="sm" className="h-7 min-w-0 gap-1.5 px-1.5" title={v.title}>
    {v.hasUpdate
      ? <Badge id="badge" className="inline-flex">{v.badgeText}</Badge>
      : <span id="ver" className="text-xs text-muted-foreground">{v.versionText}</span>}
  </Button>
}

const SIDE_MIN = 280, SIDE_MAX = 640, SIDE_DEFAULT = 420
function readSideWidth() {
  try {
    const n = parseInt(localStorage.getItem("sideWidth") || "", 10)
    if (Number.isFinite(n)) return Math.min(SIDE_MAX, Math.max(SIDE_MIN, n))
  } catch { /* ignore */ }
  return SIDE_DEFAULT
}

let started = false
export default function App() {
  const [sideW, setSideW] = useState(SIDE_DEFAULT)
  const drag = useRef<{ x: number; w: number } | null>(null)
  useEffect(() => {
    if (!started) { started = true; startEngine() }
    setSideW(readSideWidth())
  }, [])
  const onSideDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    const start = { x: e.clientX, w: sideW }
    drag.current = start
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const nw = Math.min(SIDE_MAX, Math.max(SIDE_MIN, start.w + ev.clientX - start.x))
      setSideW(nw)
    }
    const up = (ev: PointerEvent) => {
      const nw = Math.min(SIDE_MAX, Math.max(SIDE_MIN, start.w + ev.clientX - start.x))
      setSideW(nw)
      try { localStorage.setItem("sideWidth", String(Math.round(nw))) } catch { /* ignore */ }
      drag.current = null
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }
  return <TooltipProvider delayDuration={400}>
    <div className="dark flex h-screen min-w-[1000px] bg-background text-foreground">
      <aside id="side" style={{ width: sideW }} className="flex min-w-0 shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r bg-sidebar">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
          <span className="size-2 shrink-0 rounded-full bg-red-500" /><span className="text-sm font-semibold whitespace-nowrap">Shorts Recorder</span>
          <UpdateButton />
          <div className="flex-1" />
          <Help />
        </div>
        <ScriptList />
        <Separator />
        <Section label="Input">
          <div className="space-y-1.5">
            <MicPicker />
            <Button id="rootBtn" variant="outline" size="sm" className="w-full justify-start" title="Root folder"><Folder /><b id="rootName" className="truncate font-medium">Choose folder</b></Button>
          </div>
        </Section>
        <Separator />
        <Section label="Edit take">
          <div className="grid grid-cols-2 gap-1">
            <Button id="cutBtn" variant="ghost" size="sm" className="justify-start" title="Delete selection (Del)"><Scissors />Cut</Button>
            <Button id="cropBtn" variant="ghost" size="sm" className="justify-start" title="Keep only the selection (C)"><Crop />Crop</Button>
            <Button id="trimBtn" variant="ghost" size="sm" className="justify-start" title="Auto-trim silence at the ends (T)"><Wand2 />Auto-trim</Button>
            <Button id="preBtn" variant="ghost" size="sm" className="justify-start [&.act]:bg-accent [&.act]:text-accent-foreground" title="Play 2 s before the playhead, then start recording"><Timer />Pre-roll</Button>
          </div>
        </Section>
        <Separator />
        <Section label="Take">
          <div className="grid grid-cols-2 gap-1">
            <Button id="newBtn" variant="outline" size="sm" title="Discard and start a new take"><FilePlus2 />New take</Button>
            <Button id="exportBtn" size="sm"><Download />Export</Button>
          </div>
        </Section>
      </aside>
      <div id="sideDrag" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" aria-valuemin={SIDE_MIN} aria-valuemax={SIDE_MAX} aria-valuenow={Math.round(sideW)}
        title="Drag to resize" onPointerDown={onSideDrag}
        className="w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-ring/40 active:bg-ring/50" />
      <div className="flex min-w-0 flex-1 flex-col">
        <main id="prompt" className="flex-1 overflow-y-auto"><div id="pin" className="mx-auto max-w-[760px] px-8 pt-10 pb-24" /></main>
        <section className="shrink-0 border-t bg-card/40 px-4 pt-3 pb-4">
          <div className="h-[128px] overflow-hidden rounded-lg border bg-background"><canvas id="cv" className="block h-full w-full cursor-text" /></div>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div><div id="time" className="font-mono text-sm tabular-nums" /><div id="hint" className="mt-0.5 text-xs text-muted-foreground" /></div>
            <div className="flex items-center gap-3">
              <Button id="playBtn" variant="outline" size="icon" className="rounded-full" title="Play / pause (Space)"><svg id="playIco" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></Button>
              <button id="recBtn" title="Record (R)" className="rb"><i /></button>
              <Button id="undoBtn" variant="outline" size="icon" className="rounded-full" title="Undo (Ctrl+Z)"><Undo2 /></Button>
            </div>
            <div />
          </div>
        </section>
      </div>
      <Overlays />
      <Toaster position="bottom-right" offset={{ bottom: 220, right: 24 }} theme="dark" />
      <Play className="hidden" />
    </div>
  </TooltipProvider>
}
