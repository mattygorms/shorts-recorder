SHORTS RECORDER v2  -  record MattyGorm Shorts narration in one take
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
  teleprompter. Press Space (or the red button) to record, Space to stop.
- The waveform draws live while you talk. After you stop, the start and end
  silence is auto-trimmed and you see the whole take with a time ruler.

EDITING THE TAKE
  Click            place the cursor          Drag     select a region
  Shift+click      extend the selection      Esc      clear selection
  Del/Backspace    cut the selection (flubbed sentence)
  Space            record again:
                     - with a selection: replaces just that region
                     - with the cursor mid-take: replaces from the cursor to the end
                     - with the cursor at the end: keeps going (appends)
  Enter or P       play from cursor (or play the selection)
  Ctrl+Z / Ctrl+Y  undo / redo (Ctrl+Shift+Z also redoes)
  T  auto-trim ends    C  crop to selection    Home/End, arrows  move cursor
  "New take" discards everything and starts over.

EXPORT
  MattyGorm Shorts\<YYYY-MM-DD>-<slug>\
    <slug>.wav           edited take, 48 kHz, 16-bit, mono
    <slug>-raw.wav       every recorded pass, unedited, in recording order
    transcript-ref.txt   the script text
  Drag <slug>.wav into Grok Bot.

SCRIPT FILES (MattyGorm Shorts\scripts\)
  .txt:  title: My Title / slug: my-slug / --- / script text
  .json: {"title": "...", "slug": "...", "script": "..."}

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
