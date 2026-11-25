SHORTS RECORDER v3.4.0  -  record MattyGorm Shorts narration in one take
=====================================================================

INSTALL / UPGRADE FROM v1 (one time)
1. Close the recorder (and its minimized "Shorts Recorder server" window).
2. Unzip into C:\Users\<you>\Documents\MattyGorm Shorts\ and replace the old
   app\, server.ps1 and "Start Shorts Recorder.bat". The zip has no scripts\
   folder, so your scripts and recordings are left as they are.
3. Double-click "Start Shorts Recorder.bat". It starts a tiny local server
   (built-in PowerShell, http://localhost:8765) and opens Edge in app mode.
After this, future versions install with the in-app Update button.

FIRST-RUN CLICKS
- SmartScreen warning on the .bat: "More info" > "Run anyway".
- Edge "Use your microphone?": Allow.
- Click the folder chip (top right) > pick "MattyGorm Shorts" > Allow
  ("Allow on every visit" if offered). Later launches may ask once to re-allow.
- Pick your mic from the mic menu in the top bar (remembered).

RECORDING (whole script, one take)
- Pick a script in the top bar (or Paste one). It shows as a scrollable
  teleprompter. Press R (or the red button) to record, R to stop.
- The waveform draws live while you talk. After you stop, the start and end
  silence is auto-trimmed and you see the whole take with a time ruler.

EDITING THE TAKE
  Click            place the playhead        Drag     select a region
  Shift+click      extend the selection      Esc      clear selection
  Space            play from the playhead / pause (plays the selection if any)
  R                record again, in the same take (waveform stays on screen):
                     - with a selection: replaces just that region
                     - with the playhead mid-take: replaces from there to the end
                     - with the playhead at the end: keeps going (appends)
  Pre-roll         button: plays 2 s before the playhead, then starts recording
  Del/Backspace    cut the selection (flubbed sentence)
  Ctrl+Z / Ctrl+Y  undo / redo audio (Ctrl+Shift+Z also redoes)
  T  auto-trim ends    C  crop to selection    Home/End, arrows  move playhead
  ?  shortcuts popover (also the ? button, top right)
  "New take" asks first, then discards everything and starts over.

EDITING THE SCRIPT
  Click Edit (or press E, or double-click the text) and type: delete a
  sentence, rename something, etc. Changes autosave to the file in
  scripts\ ("Saved" shows next to the title). Esc or Done to finish.
  Ctrl+Z while editing undoes text only, never audio. Pasted scripts keep
  edits for the session. Export writes the edited text to transcript-ref.txt.

EXPORT
  MattyGorm Shorts\<YYYY-MM-DD>-<slug>\
    <slug>.wav           edited take, 48 kHz, 16-bit, mono
    <slug>-raw.wav       every recorded pass, unedited, in recording order
    transcript-ref.txt   the script text
  Drag <slug>.wav into Grok Bot.

MANAGING SCRIPTS
  The list shows scripts created today or yesterday (America/New_York date
  from the created: header, or the file time if there isn't one) plus any
  scripts you lock. Each row shows the game (game: header) in amber above
  the script's topic (title: header); the teleprompter shows the same.
  Click the lock icon on a row to keep that script in the list; locked
  scripts stay at the top in a Locked group. Lock state is saved in
  scripts\locked.json (not in the script file), so it survives the file
  being rewritten.
  On launch and on Refresh, older unlocked scripts are MOVED to
  scripts\_deleted\, never erased. Restore brings one back and locks it
  so it isn't moved again. Unlocking an older script also moves it to
  Deleted (Undo in the popup for 6 s).
  Refresh button (next to the script menu) re-reads scripts\ without
  reloading; the list also refreshes when you switch back to the window.
  Each row always shows a lock icon and a trash icon. A locked script cannot
  be deleted (the trash icon is grayed out: "Unlock to delete") until you
  unlock it, including with the Del key. Trash (or Del while the script menu
  is focused) on an unlocked script MOVES it to scripts\_deleted\, never
  erased. Undo in the popup for 6 s, or the restore button (shows when
  anything is deleted) to bring it back.
  Your current take is kept. Exports/recordings are never touched.

SCRIPT FILES (MattyGorm Shorts\scripts\)
  .txt:  title: Topic / game: Game Name / slug: my-slug / created: YYYY-MM-DDTHH:MM / --- / script text
         (game is optional; v3.4.0+ shows it above the topic. title is the
          story's topic, not the game name.)
         (created is optional; the list sorts newest-first and shows the date.
          Without created, the file's last-modified time is used.)
  .json: {"title": "...", "game": "...", "slug": "...", "script": "...", "created": "..."}

UPDATES
- The version is shown top right. On launch the app checks for a newer version
  and shows a green "Update x.y.z" badge. Click it to install. Click the
  version to check by hand.
- Updates come from the manifestUrl in update.json (next to server.ps1). If
  it's blank or can't be reached, the app says "Couldn't check for updates"
  and works normally.
- The update downloads to a temp folder, checks each file's SHA-256, backs the
  old files up to .backup\<timestamp>\, and then swaps them in (rolling back
  if anything fails). It can only write app\*, server.ps1 and the .bat. It
  never touches scripts\ or recordings. If server.ps1 changed, the server
  restarts itself and the page reloads.
- Manifest format:
  {"version":"2.1.0","files":[{"path":"app/index.html","url":"https://...","sha256":"<hex>"}]}

BUILDING THE APP (v3+, developers only)
  The UI is built with shadcn/ui (React + Tailwind + Radix). Source lives in ui-src\.
  Your PC never needs Node: the build produces ONE self-contained file, app\index.html,
  which server.ps1 serves and the updater downloads exactly as before.
    cd ui-src && npm ci && npm run build      (writes ../app/index.html)
    python3 make-manifest.py https://raw.githubusercontent.com/mattygorms/shorts-recorder/main
  The version lives in ui-src/index.html as window.APP_VERSION='x.y.z'. v3.4.0: game: header shown as an amber label above the topic in the script list and the teleprompter (title: is the topic); the filter searches game and topic; the list keeps scripts created today or yesterday (ET) plus locked ones. v3.3.3: script row titles truncate with an ellipsis so the lock and trash icons stay visible; the sidebar defaults to 420px and can be dragged wider (remembered). v3.3.2: Update badge is rendered from React state (so it no longer disappears on re-render) and the app re-checks for updates every 15 minutes. v3.3.1: lock and delete icons are always visible; locked scripts cannot be deleted until unlocked. v3.3: list shows only today's scripts plus locked ones; older unlocked scripts move to scripts\_deleted\; lock state in scripts\locked.json; restore auto-locks. v3.2: script list sorted by created date (newest first) with the date shown on each row; created: header supported. v3.1: script list + mic picker are React (no native <select>).
