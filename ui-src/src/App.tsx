import { useEffect, useState, useSyncExternalStore } from "react"
import { RefreshCw, Trash2, ArchiveRestore, ClipboardPaste, Pencil, Folder, Undo2, Scissors, Crop, Wand2, Timer, FilePlus2, Download, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
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
    <PopoverContent id="help" align="end" className="w-80" onOpenAutoFocus={(e) => e.preventDefault()}>
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

let started = false
export default function App() {
  useEffect(() => { if (!started) { started = true; startEngine() } }, [])
  return <TooltipProvider delayDuration={400}>
    <div className="dark flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <div className="flex items-center gap-2 pr-2 text-sm font-semibold"><span className="size-2 rounded-full bg-red-500" />Shorts Recorder</div>
        <Separator orientation="vertical" className="mx-1 !h-5" />
        <NativeSelect id="scriptSel" title="Script (Del deletes the selected script)" className="w-56"><NativeSelectOption value="">Choose a script…</NativeSelectOption></NativeSelect>
        <Tip tip="Refresh the scripts list"><Button id="refBtn" variant="ghost" size="icon-sm"><RefreshCw /></Button></Tip>
        <Tip tip="Delete script (moves it to scripts\_deleted)"><Button id="delBtn" variant="ghost" size="icon-sm"><Trash2 /></Button></Tip>
        <Tip tip="Deleted scripts / restore"><Button id="binBtn" variant="ghost" size="icon-sm" style={{ display: "none" }}><ArchiveRestore /></Button></Tip>
        <Separator orientation="vertical" className="mx-1 !h-5" />
        <Button id="pasteBtn" variant="ghost" size="sm"><ClipboardPaste />Paste</Button>
        <Tip tip={<span className="flex items-center gap-2">Edit the script text <Kbd>E</Kbd></span>}><Button id="editBtn" variant="ghost" size="sm" className="[&.act]:bg-accent"><Pencil /><span id="editLbl">Edit</span></Button></Tip>
        <div className="flex-1" />
        <div className="relative h-5 w-1.5 overflow-hidden rounded-full bg-muted" title="Input level"><i id="lvl" className="absolute inset-x-0 bottom-0 block" /></div>
        <NativeSelect id="micSel" title="Microphone" className="w-56" />
        <Button id="rootBtn" variant="ghost" size="sm" title="Root folder"><Folder /><b id="rootName" className="font-medium">Choose folder</b></Button>
        <Separator orientation="vertical" className="mx-1 !h-5" />
        <Button id="updBtn" variant="ghost" size="sm" className="group/upd" title="Check for updates">
          <span id="ver" className="text-xs text-muted-foreground" />
          <Badge id="badge" className="hidden group-[.has]/upd:inline-flex">Update</Badge>
        </Button>
        <Help />
      </header>
      <main id="prompt" className="flex-1 overflow-y-auto"><div id="pin" className="mx-auto max-w-[680px] px-6 pt-10 pb-24" /></main>
      <section className="shrink-0 border-t bg-card/40 px-4 pt-3 pb-4">
        <div className="h-[118px] overflow-hidden rounded-lg border bg-background"><canvas id="cv" className="block h-full w-full cursor-text" /></div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div><div id="time" className="font-mono text-sm tabular-nums" /><div id="hint" className="mt-0.5 text-xs text-muted-foreground" /></div>
          <div className="flex items-center gap-3">
            <Button id="playBtn" variant="outline" size="icon" className="rounded-full" title="Play / pause (Space)"><svg id="playIco" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></Button>
            <button id="recBtn" title="Record (R)" className="rb"><i /></button>
            <Button id="undoBtn" variant="outline" size="icon" className="rounded-full" title="Undo (Ctrl+Z)"><Undo2 /></Button>
          </div>
          <div className="flex items-center justify-end gap-1">
            <Button id="cutBtn" variant="ghost" size="sm" title="Delete selection (Del)"><Scissors />Cut</Button>
            <Button id="cropBtn" variant="ghost" size="sm" title="Keep only the selection (C)"><Crop />Crop</Button>
            <Button id="trimBtn" variant="ghost" size="sm" title="Auto-trim silence at the ends (T)"><Wand2 />Auto-trim</Button>
            <Button id="preBtn" variant="ghost" size="sm" className="[&.act]:bg-accent [&.act]:text-accent-foreground" title="Play 2 s before the playhead, then start recording"><Timer />Pre-roll</Button>
            <Button id="newBtn" variant="ghost" size="sm" title="Discard and start a new take"><FilePlus2 />New take</Button>
            <Separator orientation="vertical" className="mx-1 !h-5" />
            <Button id="exportBtn" size="sm"><Download />Export</Button>
          </div>
        </div>
      </section>
      <Overlays />
      <Toaster position="bottom-center" offset={250} theme="dark" />
      <Play className="hidden" />
    </div>
  </TooltipProvider>
}
