// @ts-nocheck
// Ported 1:1 from v2.2 app/index.html. DOM is rendered by React (App.tsx) with the same element ids.
import {B} from './bridge'
export function startEngine(){
// React owns the onclick property on its elements, so engine click handlers live in H and are dispatched by id.
// v3.1: the script list and mic picker are React components; these shims keep the v2 select-style engine code unchanged.
const SEL={_v:'',o:[],get value(){return this._v},set value(v){this._v=v||'';B.set({cur:this._v})},set length(n){this.o=[];B.set({scripts:[]})},add(x){this.o.push(x.value);B.set({scripts:[...this.o]})},onchange:null};
const MIC={_v:'',o:[],get value(){return this._v},set value(v){this._v=v||'';B.set({mic:this._v})},set innerHTML(x){this.o=[];B.set({mics:[]})},add(x){this.o.push({id:x.value,label:x.text});B.set({mics:[...this.o]})},onchange:null};
const CLK={};document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button[id]');if(b&&CLK[b.id]&&!b.disabled)CLK[b.id].call(b,e)});

const APP_VERSION=window.APP_VERSION;
const SR=48000,$=id=>document.getElementById(id);
const S={root:null,script:null,stream:null,buf:new Float32Array(0),raw:[],undo:[],redo:[],cur:0,sel:null,rec:null,play:null,dirty:false};
const ac=new AudioContext({sampleRate:SR,latencyHint:'interactive'});
const fmt=s=>{s=Math.max(0,s);const m=Math.floor(s/60),r=s-m*60;return String(m).padStart(2,'0')+':'+r.toFixed(1).padStart(4,'0')};
const toast=(m,act,fn,ms)=>B.toast(m,act,fn,ms);
$('ver').textContent='v'+APP_VERSION;
// ---------- storage ----------
const idb=(mode,k,v)=>new Promise((res,rej)=>{const o=indexedDB.open('shortsrec',1);o.onupgradeneeded=()=>o.result.createObjectStore('kv');o.onerror=rej;o.onsuccess=()=>{const st=o.result.transaction('kv',mode).objectStore('kv');const r=mode=='readonly'?st.get(k):st.put(v,k);r.onsuccess=()=>res(r.result);r.onerror=rej}});
const slugify=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'short';
function parseScript(name,text){let o;name=name.toLowerCase();
 if(name.endsWith('.json')){const j=JSON.parse(text);o={title:j.title||name,slug:j.slug,text:j.script||j.text||(j.lines||[]).join('\n'),json:j}}
 else{const m=text.replace(/^\uFEFF/,'').split(/\r?\n/);let title=name.replace(/\.txt$/,''),slug=null,i=0,hdr=false;
  for(;i<m.length;i++){const l=m[i];let r;if(r=l.match(/^title:\s*(.*)/i)){title=r[1].trim();hdr=true}else if(r=l.match(/^slug:\s*(.*)/i)){slug=r[1].trim();hdr=true}else if(/^-{3,}\s*$/.test(l)){i++;break}else if(l.trim()==='')continue;else break}
  o={title,slug,text:m.slice(i).join('\n').trim(),header:hdr?m.slice(0,i).join('\n').trimEnd()+'\n':''}}
 o.slug=slugify(o.slug||o.title);return o}
async function perm(h){if(await h.queryPermission({mode:'readwrite'})=='granted')return true;return (await h.requestPermission({mode:'readwrite'}))=='granted'}
async function setRoot(h){S.root=h;$('rootName').textContent=h.name||'Folder';await idb('readwrite','root',h);await loadList()}
CLK['rootBtn']=async()=>{if(!window.showDirectoryPicker)return toast('Open this in Edge or Chrome via the launcher');try{await setRoot(await showDirectoryPicker({id:'shortsroot',mode:'readwrite',startIn:'documents'}))}catch(e){}};
async function loadList(){const sel=SEL;sel.length=1;if(!S.root||!await perm(S.root))return;
 const sd=await S.root.getDirectoryHandle('scripts',{create:true});const n=[];for await(const [k,h] of sd.entries())if(h.kind=='file'&&/\.(txt|json)$/i.test(k))n.push(k);n.sort();
 for(const k of n){const o=new Option(k.replace(/\.(txt|json)$/i,''),k);sel.add(o)}
 const cur=S.script&&S.script.file;if(cur&&n.includes(cur))sel.value=cur;
 let dn=0;try{const dd=await sd.getDirectoryHandle('_deleted');for await(const [k,h] of dd.entries())if(h.kind=='file')dn++}catch(e){}$('binBtn').style.display=dn?'':'none';$('binBtn').title='Deleted scripts / restore ('+dn+')';
 const last=localStorage.lastScript;if(last&&n.includes(last)&&!S.script){sel.value=last;sel.onchange()}return n}
// ---------- script management: deletes are moves into scripts\_deleted\ (recoverable) ----------
async function freeName(dir,name){const m=name.match(/^(.*?)(\.[^.]+)?$/);let k=name,i=1;for(;;){try{await dir.getFileHandle(k);k=m[1]+' ('+(++i)+')'+(m[2]||'')}catch(e){return k}}}
async function moveFile(from,to,name){const f=await (await from.getFileHandle(name)).getFile();const dest=await freeName(to,name);const w=await (await to.getFileHandle(dest,{create:true})).createWritable();await w.write(await f.arrayBuffer());await w.close();
 const chk=await (await to.getFileHandle(dest)).getFile();if(chk.size!==f.size)throw new Error('copy check failed');await from.removeEntry(name);return dest}
async function delScript(name){name=name||SEL.value;if(!name||!S.root)return;if(!await perm(S.root))return toast('No folder access');
 try{const sd=await S.root.getDirectoryHandle('scripts'),dd=await sd.getDirectoryHandle('_deleted',{create:true});flushSave();const dest=await moveFile(sd,dd,name);
  const wasCur=S.script&&S.script.file===name;if(wasCur)S.script.file=null;if(localStorage.lastScript===name)localStorage.removeItem('lastScript');await loadList();if(wasCur)SEL.value='';
  toast('Deleted '+name.replace(/\.(txt|json)$/i,'')+' (moved to scripts\\_deleted)','Undo',async()=>{const back=await restoreScript(dest,name);if(wasCur&&S.script&&!S.script.file){S.script.file=back;SEL.value=back}},6000)}catch(e){toast('Could not delete: '+e.message)}}
async function restoreScript(dname,orig){const sd=await S.root.getDirectoryHandle('scripts'),dd=await sd.getDirectoryHandle('_deleted');const back=await moveFile(dd,sd,orig||dname);await loadList();toast('Restored '+back);return back}
async function showBin(){const dd=await (await S.root.getDirectoryHandle('scripts')).getDirectoryHandle('_deleted',{create:true});const n=[];for await(const [k,h] of dd.entries())if(h.kind=='file')n.push(k);n.sort();
 B.set({bin:n})}
B.restore=async k=>{await restoreScript(k);const b=B.get().bin.filter(x=>x!==k);B.set({bin:b.length?b:null})};
CLK['refBtn']=async()=>{const n=await loadList();if(n)toast(n.length+' scripts')};CLK['delBtn']=()=>delScript();CLK['binBtn']=showBin;
B.pick=async k=>{if(k===SEL.value&&S.script&&S.script.file===k)return;SEL.value=k;await SEL.onchange();SEL.value=S.script&&S.script.file||''};B.del=k=>delScript(k);B.pickMic=id=>{MIC.value=id;MIC.onchange()};
let refT=0;addEventListener('focus',()=>{if(S.root&&!S.rec&&Date.now()-refT>1500){refT=Date.now();loadList().catch(()=>{})}});
SEL.onchange=async()=>{const n=SEL.value;if(!n)return;try{const f=await (await (await S.root.getDirectoryHandle('scripts')).getFileHandle(n)).getFile();const o=parseScript(n,await f.text());o.file=n;await useScript(o);localStorage.lastScript=n}catch(e){toast('Could not read '+n)}};
CLK['pasteBtn']=()=>B.set({paste:true});
B.paste=async(ti,t)=>{t=t.trim();if(!t)return false;ti=ti.trim()||'Pasted script';B.set({paste:false});await useScript({title:ti,slug:slugify(ti),text:t});return true};
async function useScript(o){if(S.dirty&&!await B.ask('Discard the current take?','It has not been exported. Switching scripts clears it.','Discard'))return;setEdit(false);S.script=o;resetTake();const pin=$('pin');pin.innerHTML='';const t=document.createElement('div');t.className='t';const tn=document.createElement('span');tn.textContent=o.title;const sv=document.createElement('span');sv.className='sv';sv.id='sv';sv.textContent=o.file?'':'Pasted · edits stay in this session';t.append(tn,sv);pin.appendChild(t);
 const ed=document.createElement('div');ed.id='ed';ed.spellcheck=true;for(const p of o.text.split(/\n\s*\n/)){const e=document.createElement('p');e.textContent=p.replace(/\s*\n\s*/g,' ').trim();if(e.textContent)ed.appendChild(e)}pin.appendChild(ed);
 ed.addEventListener('input',onEdit);ed.addEventListener('dblclick',()=>{if(!S.editing)setEdit(true)});ed.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))});
 $('prompt').scrollTop=0;ui()}
// ---------- script editing (autosaves to scripts\<file>) ----------
try{document.execCommand('defaultParagraphSeparator',false,'p')}catch(e){}
function setEdit(on){S.editing=on;const ed=$('ed');$('editBtn').classList.toggle('act',on);$('editLbl').textContent=on?'Done':'Edit';if(!ed)return;ed.contentEditable=on?'true':'false';ed.classList.toggle('on',on);if(on){ed.focus()}else{ed.blur();flushSave()}}
CLK['editBtn']=()=>{if(!S.script)return;setEdit(!S.editing)};
const edText=()=>{const ed=$('ed');return ed?ed.innerText.replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim():''};
let saveT=null;function onEdit(){if(!S.script)return;S.script.text=edText();const sv=$('sv');if(!S.script.file){sv.textContent='Edited · not saved to a file (pasted script)';return}sv.className='sv';sv.textContent='Editing…';clearTimeout(saveT);saveT=setTimeout(saveScript,700)}
function flushSave(){if(saveT){clearTimeout(saveT);saveT=null;saveScript()}}
async function saveScript(){saveT=null;const o=S.script;if(!o||!o.file||!S.root)return;const sv=$('sv');try{if(!await perm(S.root))throw new Error('no folder access');
 let body;if(o.json){o.json[o.json.script!==undefined?'script':o.json.text!==undefined?'text':'script']=o.text;if(o.json.lines&&o.json.script!==undefined)delete o.json.lines;body=JSON.stringify(o.json,null,2)+'\n'}else body=(o.header||'')+o.text+'\n';
 body=body.replace(/\r?\n/g,'\r\n');const fh=await (await S.root.getDirectoryHandle('scripts')).getFileHandle(o.file);const w=await fh.createWritable();await w.write(body);await w.close();
 if(S.script===o){sv.className='sv ok';sv.textContent='Saved'}}catch(e){sv.className='sv';sv.textContent='Not saved: '+e.message}}
function emptyPrompt(){$('pin').innerHTML='<div class="empty">'+(S.root?'Pick a script from the top bar,<br>or <b>Paste</b> one.':'Choose your <b>MattyGorm Shorts</b> folder to start.<br>Scripts are read from its <b>scripts</b> folder.')+'</div>'}
// ---------- mic ----------
async function listMics(){const d=(await navigator.mediaDevices.enumerateDevices()).filter(x=>x.kind=='audioinput');const s=MIC;s.innerHTML='';for(const x of d)s.add(new Option(x.label||'Microphone',x.deviceId));const k=localStorage.mic;if(k&&d.some(x=>x.deviceId==k))s.value=k}
let meterNode;
async function openMic(){if(S.stream)S.stream.getTracks().forEach(t=>t.stop());const id=MIC.value||localStorage.mic;
 S.stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:id?{exact:id}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1}});
 await listMics();const sid=S.stream.getAudioTracks()[0].getSettings().deviceId;if(sid){MIC.value=sid;localStorage.mic=sid}
 await ensureWorklet();if(S.srcNode)S.srcNode.disconnect();S.srcNode=ac.createMediaStreamSource(S.stream);S.srcNode.connect(S.cap)}
MIC.onchange=()=>{localStorage.mic=MIC.value;openMic().catch(e=>toast('Mic error: '+e.message))};
// ---------- lossless capture (AudioWorklet, raw float PCM) ----------
const WK=`class C extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(1024);this.n=0}process(i){const c=i[0]&&i[0][0];if(c){let pk=0;for(let k=0;k<c.length;k++){this.b[this.n++]=c[k];const a=c[k]<0?-c[k]:c[k];if(a>pk)pk=a;if(this.n==1024){this.port.postMessage(this.b);this.b=new Float32Array(1024);this.n=0}}}return true}}registerProcessor('cap',C)`;
async function ensureWorklet(){if(S.cap)return;await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([WK],{type:'text/javascript'})));S.cap=new AudioWorkletNode(ac,'cap',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});const g=ac.createGain();g.gain.value=0;S.cap.connect(g).connect(ac.destination);
 S.cap.port.onmessage=e=>{const d=e.data;let pk=0;for(let i=0;i<d.length;i++){const a=Math.abs(d[i]);if(a>pk)pk=a}level=Math.max(level*.85,pk);if(S.rec){S.rec.chunks.push(d);S.rec.n+=d.length;livePeaks(d)}}}
let level=0;(function m(){$('lvl').style.height=Math.min(100,level*130)+'%';$('lvl').style.background=level>.97?'var(--rec)':'var(--ok)';level*=.96;requestAnimationFrame(m)})();
// ---------- record / punch-in ----------
const COL=480; // samples per live column (10 ms)
function livePeaks(d){const r=S.rec;for(let i=0;i<d.length;i++){const v=d[i];if(v<r.mn)r.mn=v;if(v>r.mx)r.mx=v;if(++r.k==COL){r.peaks.push(r.mn,r.mx);r.mn=1;r.mx=-1;r.k=0}}}
async function startRec(){if(!S.script)return toast('Choose a script first');if(S.pre)return cancelPre();try{if(!S.stream)await openMic()}catch(e){return toast('Microphone blocked: '+e.message)}
 await ac.resume();stopPlay();if(S.editing)setEdit(false);
 let a=S.buf.length,b=S.buf.length,mode='new';if(S.buf.length){if(S.sel){a=S.sel[0];b=S.sel[1];mode='replace'}else{a=b=S.cur;mode=S.cur>=S.buf.length?'append':'punch'}if(mode=='punch')b=S.buf.length}
 const begin=()=>{S.pre=null;S.rec={chunks:[],n:0,peaks:[],mn:1,mx:-1,k:0,a,b,mode,t0:performance.now()};ui();drawLoop()};
 if(localStorage.preroll=='1'&&a>0){const p0=Math.max(0,a-2*SR),seg=S.buf.subarray(p0,a),ab=ac.createBuffer(1,seg.length,SR);ab.copyToChannel(seg,0);const src=ac.createBufferSource();src.buffer=ab;src.connect(ac.destination);
  src.onended=()=>{if(S.pre&&S.pre.src===src){S.play=null;begin()}};S.pre={src};S.play={src,a:p0,b:a,t0:ac.currentTime};src.start();ui();drawLoop();return}
 begin()}
function cancelPre(){const p=S.pre;S.pre=null;S.play=null;try{p.src.onended=null;p.src.stop()}catch(e){}ui()}
CLK['preBtn']=()=>{localStorage.preroll=localStorage.preroll=='1'?'0':'1';ui();toast('Pre-roll '+(localStorage.preroll=='1'?'on (2 s)':'off'))};
function stopRec(){const r=S.rec;if(!r)return;S.rec=null;const take=new Float32Array(r.n);let o=0;for(const c of r.chunks){take.set(c,o);o+=c.length}
 S.raw.push(take);if(!take.length){ui();return}
 pushUndo();const pre=S.buf.subarray(0,r.a),post=S.buf.subarray(r.b);const nb=new Float32Array(pre.length+take.length+post.length);nb.set(pre);nb.set(take,pre.length);nb.set(post,pre.length+take.length);
 if(pre.length)xfade(nb,pre.length);if(post.length)xfade(nb,pre.length+take.length);
 S.buf=nb;S.sel=null;S.cur=pre.length+take.length;S.dirty=true;
 if(r.mode=='new')autoTrim(false);
 toast({new:'Take recorded',append:'Added to the end',punch:'Re-recorded from cursor to end',replace:'Selection replaced'}[r.mode]+' · '+fmt(take.length/SR));rebuild();ui()}
function xfade(d,at){const n=Math.min(144,at,d.length-at);for(let i=0;i<n;i++){const g=i/n;d[at-1-i]*=g;d[at+i]*=g}} // 3 ms dip at joins, no clicks
// ---------- edit ops ----------
function pushUndo(){S.undo.push({buf:S.buf,cur:S.cur});if(S.undo.length>20)S.undo.shift();S.redo=[]}
function undo(){if(S.rec||!S.undo.length)return;S.redo.push({buf:S.buf,cur:S.cur});const u=S.undo.pop();S.buf=u.buf;S.cur=Math.min(u.cur,u.buf.length);S.sel=null;stopPlay();rebuild();ui();toast('Undo')}
function redoOp(){if(S.rec||!S.redo.length)return;S.undo.push({buf:S.buf,cur:S.cur});const u=S.redo.pop();S.buf=u.buf;S.cur=Math.min(u.cur,u.buf.length);S.sel=null;rebuild();ui();toast('Redo')}
function cut(){if(!S.sel||S.rec)return;const[a,b]=S.sel;pushUndo();const nb=new Float32Array(S.buf.length-(b-a));nb.set(S.buf.subarray(0,a));nb.set(S.buf.subarray(b),a);if(a>0&&a<nb.length)xfade(nb,a);S.buf=nb;S.cur=a;S.sel=null;stopPlay();rebuild();ui();toast('Cut '+fmt((b-a)/SR))}
function crop(){if(!S.sel||S.rec)return;const[a,b]=S.sel;pushUndo();S.buf=S.buf.slice(a,b);S.cur=0;S.sel=null;stopPlay();rebuild();ui();toast('Cropped to selection')}
function autoTrim(undoable=true){const d=S.buf;if(!d.length)return;const w=480;let pk=0;for(let i=0;i<d.length;i++){const a=Math.abs(d[i]);if(a>pk)pk=a}const th=Math.max(.006,pk*.06);
 const rms=i=>{let s=0;for(let j=i;j<i+w&&j<d.length;j++)s+=d[j]*d[j];return Math.sqrt(s/w)};let s=0,e=d.length;for(let i=0;i<d.length;i+=w)if(rms(i)>th){s=i;break}for(let i=d.length-w;i>0;i-=w)if(rms(i)>th){e=i+w;break}
 s=Math.max(0,s-Math.round(.12*SR));e=Math.min(d.length,e+Math.round(.25*SR));if(e<=s||(s==0&&e==d.length)){if(undoable)toast('Nothing to trim');return}
 if(undoable)pushUndo();S.buf=d.slice(s,e);S.cur=Math.max(0,Math.min(S.buf.length,S.cur-s));S.sel=null;rebuild();ui();if(undoable)toast('Trimmed '+fmt((s+d.length-e)/SR)+' of silence')}
function resetTake(){S.buf=new Float32Array(0);S.raw=[];S.undo=[];S.redo=[];S.cur=0;S.sel=null;S.dirty=false;stopPlay();rebuild()}
CLK['newBtn']=async()=>{if(S.buf.length&&!await B.ask('Discard this take and start over?','The waveform, undo history and raw passes are cleared.','Start over'))return;resetTake();ui()};
// ---------- playback ----------
function stopPlay(){if(S.play){S.play.src.onended=null;try{S.play.src.stop()}catch(e){}S.play=null;ui()}}
function play(){if(S.rec)return;if(S.pre)return cancelPre();if(S.play){const p=pos();stopPlay();S.cur=p;ui();return}if(!S.buf.length)return;ac.resume();
 let a=S.sel?S.sel[0]:S.cur,b=S.sel?S.sel[1]:S.buf.length;if(a>=b-100){a=0;b=S.buf.length}const seg=S.buf.subarray(a,b);const ab=ac.createBuffer(1,seg.length,SR);ab.copyToChannel(seg,0);
 const src=ac.createBufferSource();src.buffer=ab;src.connect(ac.destination);src.onended=()=>{S.play=null;ui()};src.start();S.play={src,a,b,t0:ac.currentTime};ui();drawLoop()}
const pos=()=>S.play?Math.min(S.play.b,S.play.a+Math.round((ac.currentTime-S.play.t0)*SR)):S.cur;
// ---------- waveform ----------
const cv=$('cv'),cx=cv.getContext('2d');let W=0,H=0,dpr=1,img=null;
function size(){dpr=devicePixelRatio||1;const r=cv.getBoundingClientRect();W=Math.round(r.width*dpr);H=Math.round(r.height*dpr);cv.width=W;cv.height=H;rebuild();draw()}
new ResizeObserver(size).observe(cv);
const RU=22; // ruler height (css px)
function rebuild(){if(!W)return;img=document.createElement('canvas');img.width=W;img.height=H;const g=img.getContext('2d');const d=S.buf,N=d.length;if(!N)return;
 const top=RU*dpr,h=H-top,mid=top+h/2,spp=N/W;g.fillStyle=getComputedStyle(document.body).getPropertyValue('--wave');
 for(let x=0;x<W;x++){let mn=1,mx=-1;const i0=Math.floor(x*spp),i1=Math.max(i0+1,Math.floor((x+1)*spp));for(let i=i0;i<i1&&i<N;i++){const v=d[i];if(v<mn)mn=v;if(v>mx)mx=v}if(mx<mn)continue;g.fillRect(x,mid-mx*h*.48,1,Math.max(dpr,(mx-mn)*h*.48))}}
function ruler(dur,x0,pxs){if(!(pxs>0)||!isFinite(pxs))return;cx.fillStyle='#131519';cx.fillRect(0,0,W,RU*dpr);cx.fillStyle='#25282f';cx.fillRect(0,RU*dpr-1,W,1);
 const steps=[.5,1,2,5,10,15,30,60];const want=90*dpr/pxs;const st=steps.find(s=>s>=want)||120;cx.font=(11*dpr)+'px Segoe UI,system-ui';cx.textBaseline='middle';
 for(let t=Math.ceil(x0/st)*st;;t+=st){const x=(t-x0)*pxs;if(x>W)break;cx.fillStyle='#3a3e48';cx.fillRect(Math.round(x),RU*dpr-6*dpr,1,6*dpr);cx.fillStyle='#7c8190';cx.fillText((m=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')+(st<1?'.'+Math.round((t%1)*10):''))(),x+4*dpr,RU*dpr/2)}
 cx.fillStyle='#1d2026';cx.fillRect(0,RU*dpr+(H-RU*dpr)/2,W,1)}
function draw(){if(!W||!H)return;cx.clearRect(0,0,W,H);const r=S.rec,N=S.buf.length;
 if(r){const post=N-r.b,tot=Math.max(N,r.a+r.n+post,SR),pxs=W/(tot/SR),XS=v=>v/tot*W,top=RU*dpr,h=H-top,mid=top+h/2;ruler(0,0,pxs);
  const xA=XS(r.a),xH=XS(r.a+r.n);
  if(img&&N){const sx=v=>v/N*W;if(r.a>0)cx.drawImage(img,0,0,sx(r.a),H,0,0,xA,H);
   if(r.mode=='punch'&&r.a+r.n<N){cx.globalAlpha=.22;cx.drawImage(img,sx(r.a+r.n),0,W-sx(r.a+r.n),H,xH,0,XS(N-r.a-r.n),H);cx.globalAlpha=1}
   if(r.mode=='replace'&&post>0)cx.drawImage(img,sx(r.b),0,W-sx(r.b),H,xH,0,XS(post),H)}
  cx.fillStyle='#ff6b78';const cw=COL/tot*W,cols=r.peaks.length/2;let px=-1,mn=1,mx=-1;
  const flush=()=>{if(px>=0&&mx>=mn)cx.fillRect(px,mid-mx*h*.48,Math.max(1,Math.ceil(cw)),Math.max(dpr,(mx-mn)*h*.48))};
  for(let c=0;c<cols;c++){const x=Math.floor(xA+c*cw);if(x!==px){flush();px=x;mn=1;mx=-1}const a=r.peaks[2*c],b=r.peaks[2*c+1];if(a<mn)mn=a;if(b>mx)mx=b}flush();
  cx.fillStyle='#ff475722';cx.fillRect(xA,top,Math.max(0,xH-xA),h);cx.fillStyle='#ff4757';cx.fillRect(xH,0,2*dpr,H);return}
 if(!N){ruler(0,0,W/30);cx.fillStyle='#4a4f5b';cx.font=(13*dpr)+'px Segoe UI,system-ui';cx.textAlign='center';cx.fillText(S.script?'Press R or the red button to record the whole script':'No take yet',W/2,RU*dpr+(H-RU*dpr)/2-12*dpr);cx.textAlign='left';return}
 const pxs=W/(N/SR);ruler(0,0,pxs);if(img)cx.drawImage(img,0,0);const X=s=>s/N*W;
 if(S.sel){cx.fillStyle='#6c8cff33';cx.fillRect(X(S.sel[0]),RU*dpr,X(S.sel[1])-X(S.sel[0]),H);cx.fillStyle='#6c8cff';cx.fillRect(X(S.sel[0]),RU*dpr,dpr,H);cx.fillRect(X(S.sel[1]),RU*dpr,dpr,H)}
 const p=X(pos());cx.fillStyle=S.play?'#ffffff':'#eceef2';cx.fillRect(Math.round(p)-dpr/2,0,Math.max(1,1.5*dpr),H);cx.beginPath();cx.moveTo(p-5*dpr,0);cx.lineTo(p+5*dpr,0);cx.lineTo(p,7*dpr);cx.fill()}
let looping=false;function drawLoop(){if(looping)return;looping=true;(function f(){draw();updTime();if(S.rec||S.play)requestAnimationFrame(f);else looping=false})()}
let drag=null;const sAt=e=>{const r=cv.getBoundingClientRect();return Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*S.buf.length)};
cv.onpointerdown=e=>{if(S.rec||!S.buf.length)return;stopPlay();cv.setPointerCapture(e.pointerId);const s=sAt(e);
 if(e.shiftKey){const a=S.sel?S.sel[0]:S.cur;drag={a:Math.min(a,s)};S.sel=[Math.min(a,s),Math.max(a,s)]}else{drag={a:s,x:e.clientX};S.sel=null;S.cur=s}ui()};
cv.onpointermove=e=>{if(!drag)return;const s=sAt(e);if(drag.x!==undefined&&Math.abs(e.clientX-drag.x)<4)return;drag.x=undefined;S.sel=[Math.min(drag.a,s),Math.max(drag.a,s)];if(S.sel[1]-S.sel[0]<SR*.02)S.sel=null;else S.cur=S.sel[0];ui()};
cv.onpointerup=()=>{drag=null};
// ---------- ui ----------
function updTime(){const N=S.buf.length;const p=S.rec?(S.rec.a+S.rec.n):pos();$('time').innerHTML=fmt(p/SR)+' <span>/ '+fmt((S.rec?S.rec.a+S.rec.n+(S.buf.length-S.rec.b):N)/SR)+'</span>'}
function ui(){const r=!!S.rec,N=S.buf.length;$('recBtn').classList.toggle('on',r);$('recBtn').title=r?'Stop (R)':'Record (R)';
 $('playIco').innerHTML=S.play?'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>':'<path d="M8 5v14l11-7z"/>';
 for(const[id,on] of [['cutBtn',S.sel],['cropBtn',S.sel],['trimBtn',N],['newBtn',N],['preBtn',1],['exportBtn',N&&S.script],['undoBtn',S.undo.length],['playBtn',N]])$(id).disabled=r||!on;
 let h='';if(r)h={new:'Recording whole script…',append:'Recording — appending to the end',punch:'Punch-in — replacing from '+fmt(S.rec.a/SR)+' to end',replace:'Replacing selection '+fmt(S.rec.a/SR)+'–'+fmt(S.rec.b/SR)}[S.rec.mode]+' · R to stop';
 else if(S.pre)h='Pre-roll… recording starts at '+fmt(S.pre&&S.play?S.play.b/SR:0);else if(!S.script)h='';else if(!N)h='R to record · ? for shortcuts';else if(S.sel)h='Selection '+fmt((S.sel[1]-S.sel[0])/SR)+' · Space plays it · R re-records it · Del cuts it';else h=S.cur>=N?'Space plays · R keeps recording at the end':'Space plays from here · R re-records from here to the end';
 $('hint').textContent=h;$('preBtn').classList.toggle('act',localStorage.preroll=='1');$('recBtn').classList.toggle('on',r||!!S.pre);if(!S.script)emptyPrompt();updTime();if(!looping)draw()}
CLK['recBtn']=()=>S.rec?stopRec():startRec();
for(const id of ['recBtn','playBtn','undoBtn','cutBtn','cropBtn','trimBtn','preBtn','newBtn','exportBtn'])$(id).addEventListener('mousedown',e=>e.preventDefault()); // keep keyboard focus off buttons so Space doesn't click them
CLK['playBtn']=play;CLK['undoBtn']=undo;CLK['cutBtn']=cut;CLK['cropBtn']=crop;CLK['trimBtn']=()=>autoTrim(true);
addEventListener('keydown',e=>{const k=e.key,c=e.ctrlKey||e.metaKey;
 if(e.target.closest('[contenteditable="true"]')){if(k=='Escape'){e.preventDefault();setEdit(false)}return} // text has its own Ctrl+Z
 if(e.target.closest('input,textarea,select,dialog,[role=dialog],[role=alertdialog],[role=combobox],[role=listbox]:not(#scriptList)')||B.modal())return;
 if(e.target.closest('#scriptList')&&['Delete','Backspace','ArrowUp','ArrowDown','Enter','Home','End'].includes(k))return; // list handles its own keys
 if(k=='?'){B.set({help:!B.get().help});return}
 if(k==' '){e.preventDefault();if(S.rec)stopRec();else play()}else if((k=='r'||k=='R')&&!c){e.preventDefault();S.rec?stopRec():startRec()}else if((k=='e'||k=='E')&&!c&&S.script){e.preventDefault();setEdit(true)}else if(c&&(k=='z'||k=='Z')){e.preventDefault();e.shiftKey?redoOp():undo()}else if(c&&(k=='y'||k=='Y')){e.preventDefault();redoOp()}
 else if(k=='Delete'||k=='Backspace'){e.preventDefault();cut()}else if(k=='Enter'||k=='p'||k=='P'){e.preventDefault();play()}else if(k=='Escape'){S.sel=null;ui()}
 else if((k=='t'||k=='T')&&!c)autoTrim(true);else if((k=='c'||k=='C')&&!c)crop();else if(k=='Home'){S.cur=0;S.sel=null;ui()}else if(k=='End'){S.cur=S.buf.length;S.sel=null;ui()}
 else if(k=='ArrowLeft'||k=='ArrowRight'){e.preventDefault();stopPlay();S.sel=null;S.cur=Math.max(0,Math.min(S.buf.length,S.cur+(k=='ArrowLeft'?-1:1)*SR*(e.shiftKey?5:1)));ui()}});
addEventListener('beforeunload',e=>{if(S.dirty){e.preventDefault();e.returnValue=''}});
// ---------- export ----------
function wav(f){const n=f.length,b=new ArrayBuffer(44+n*2),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
 w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,SR,true);v.setUint32(28,SR*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);
 for(let i=0;i<n;i++){const s=Math.max(-1,Math.min(1,f[i]));v.setInt16(44+i*2,s<0?s*32768:s*32767,true)}return new Blob([b],{type:'audio/wav'})}
async function put(dir,name,blob){const w=await (await dir.getFileHandle(name,{create:true})).createWritable();await w.write(blob);await w.close()}
function rawTake(){const L=S.raw.reduce((a,t)=>a+t.length,0),o=new Float32Array(L);let p=0;for(const t of S.raw){o.set(t,p);p+=t.length}return o}
async function doExport(){if(!S.buf.length||!S.script)return;if(S.editing){S.script.text=edText()}flushSave();if(!S.root)return toast('Choose your folder first');if(!await perm(S.root))return toast('Folder access was not allowed');
 const d=new Date(),ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),slug=S.script.slug,name=ds+'-'+slug;
 const dir=await S.root.getDirectoryHandle(name,{create:true});const out=S.buf.slice();const f=Math.min(240,out.length>>1);for(let i=0;i<f;i++){out[i]*=i/f;out[out.length-1-i]*=i/f}
 await put(dir,slug+'.wav',wav(out));await put(dir,slug+'-raw.wav',wav(rawTake()));await put(dir,'transcript-ref.txt',new Blob([S.script.text.replace(/\r?\n/g,'\r\n')+'\r\n'],{type:'text/plain'}));
 S.dirty=false;toast('Saved '+name+'\\'+slug+'.wav ('+fmt(out.length/SR)+')');return name}
CLK['exportBtn']=()=>doExport().catch(e=>toast('Export failed: '+e.message));
// ---------- updates ----------
async function api(p,opt){const r=await fetch(p,Object.assign({cache:'no-store',headers:{'X-Shorts-Recorder':'1'}},opt));if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
let latest=null;
async function checkUpdate(manual){const b=$('updBtn');try{const j=await api('/api/version');if(j.error)throw new Error(j.error);latest=j.updateAvailable?j.latest:null;b.classList.toggle('has',!!latest);$('badge').textContent='Update '+(latest||'');b.title=latest?'Update available: v'+latest+' — click to install':'Up to date';if(manual&&!latest)toast('You’re on the latest version (v'+APP_VERSION+')')}
 catch(e){latest=null;b.classList.remove('has');b.title='Couldn’t check for updates';if(manual)toast('Couldn’t check for updates')}}
CLK['updBtn']=async()=>{if(!latest)return checkUpdate(true);if(S.dirty&&!await B.ask('Update now?','You have an unexported take. Updating reloads the app and it will be lost.','Update'))return;
 toast('Updating to v'+latest+'…');try{const r=await api('/api/update',{method:'POST',body:'{}'});if(!r.ok)throw new Error(r.error||'failed');S.dirty=false;
  for(let i=0;i<40;i++){await new Promise(z=>setTimeout(z,500));try{const v=await api('/api/version?local=1');if(v.version==r.version){location.reload();return}}catch(e){}}location.reload()}
 catch(e){toast('Update failed: '+e.message+' (nothing was changed)')}};
// ---------- boot ----------
ui();(async()=>{try{const h=await idb('readonly','root');if(h){S.root=h;$('rootName').textContent=h.name;if(await h.queryPermission({mode:'readwrite'})=='granted')await loadList();else{toast('Click anywhere to re-allow folder access');addEventListener('pointerdown',async()=>{if(await perm(S.root))loadList()},{once:true,capture:true})}}}catch(e){}
 try{await openMic()}catch(e){toast('Microphone blocked: '+e.message)}ui();checkUpdate(false)})();
window.__t={B,loadList,delScript,restoreScript,showBin,setEdit,saveScript,S,setRoot,useScript,startRec,stopRec,cut,undo,redoOp,crop,autoTrim,doExport,play,ui};

}
