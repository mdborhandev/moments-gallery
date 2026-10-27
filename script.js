const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let db,P=[],L=[],sel=new Set(),cur=-1,shown=0,tl=false,selMode=false,favOnly=false,fails=0,lockUntil=0;
const urls=new Map(),MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async s=>hex(await crypto.subtle.digest('SHA-256',typeof s==='string'?new TextEncoder().encode(s):s));
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,2600)}
const fmtSize=n=>n>1e6?(n/1e6).toFixed(1)+' MB':Math.round(n/1e3)+' KB';

// ---- storage (IndexedDB)
const open=()=>new Promise((ok,no)=>{const r=indexedDB.open('gallery2',1);r.onupgradeneeded=()=>{r.result.createObjectStore('p',{keyPath:'id'});r.result.createObjectStore('kv')};r.onsuccess=()=>{db=r.result;ok()};r.onerror=()=>no(r.error)});
const tx=(m,f)=>new Promise((ok,no)=>{const t=db.transaction('p',m),r=f(t.objectStore('p'));t.oncomplete=()=>ok(r.result);t.onerror=()=>no(t.error)});
const save=p=>tx('readwrite',s=>s.put(p)),rem=id=>tx('readwrite',s=>s.delete(id)),all=()=>tx('readonly',s=>s.getAll());

// ---- auth (client-side only: a privacy gate, not real server security)
async function checkPw(v){const stored=ls.get('pwh')||await sha('gallery:4006');return await sha('gallery:'+v)===stored}
$('#lf').onsubmit=async e=>{e.preventDefault();
 if(Date.now()<lockUntil){$('#err').textContent='Too many attempts. Wait '+Math.ceil((lockUntil-Date.now())/1000)+'s.';return}
 if(await checkPw($('#pw').value)){fails=0;try{sessionStorage.setItem('ok',Date.now())}catch(e){}start()}
 else{fails++;lockUntil=Date.now()+Math.min(2**fails,60)*1000;$('#err').textContent='Wrong password.';$('#pw').value=''}};
$('#out').onclick=()=>{try{sessionStorage.removeItem('ok')}catch(e){}location.reload()};
$('#pwb').onclick=async()=>{const o=prompt('Current password');if(o===null)return;if(!await checkPw(o))return toast('Current password is wrong');
 const n=prompt('New password (6+ characters)');if(!n||n.length<6)return toast('Password not changed');ls.set('pwh',await sha('gallery:'+n));toast('Password changed')};
$('#th').onclick=()=>{const d=document.documentElement,l=getComputedStyle(d).getPropertyValue('--bg').trim()==='#fff5f7';d.dataset.theme=l?'dark':'light';ls.set('theme',d.dataset.theme)};
if(ls.get('theme'))document.documentElement.dataset.theme=ls.get('theme');

async function start(){$('#login').hidden=true;$('#app').hidden=false;await open();P=await all();filters();render();await boot();
 let t;const bump=()=>{clearTimeout(t);t=setTimeout(()=>$('#out').click(),30*60e3)};['click','keydown'].forEach(k=>addEventListener(k,bump));bump()}
try{const s=sessionStorage.getItem('ok');if(s&&Date.now()-s<30*60e3)start()}catch(e){}

// ---- photos live in ./photos next to this file (read-only, never modified)
const IMG=/\.(jpe?g|png|webp|gif|avif|bmp)$/i;
async function walk(dir,out){const r=await fetch(dir,{cache:'no-store'});if(!r.ok)throw 0;
 const h=new DOMParser().parseFromString(await r.text(),'text/html');
 for(const a of h.querySelectorAll('a[href]')){const raw=a.getAttribute('href');if(/^([?#\/.]|[a-z]+:)/i.test(raw))continue;const n=decodeURIComponent(raw);
  if(n.endsWith('/'))await walk(dir+raw,out);else if(IMG.test(n))out.push(dir+n)}}
async function list(out){
 try{const r=await fetch('photos.json',{cache:'no-store'});if(r.ok){(await r.json()).filter(n=>IMG.test(n)).forEach(n=>out.push('photos/'+n));return}}catch(e){}
 await walk('photos/',out)}
$('#rs').onclick=()=>scan();
const boot=()=>scan();
async function scan(){toast('Looking for photos\u2026');const out=[];
 try{await list(out)}catch(e){return toast('Could not read the photos folder. Open this page through a local server.')}
 const have=new Map(P.map(p=>[p.id,p])),seen=new Set(out);let n=0,d=0,bad=0;
 for(const [i,path] of out.entries()){if(have.has(path))continue;
  if((n+bad)%5===0)toast(`Reading photo ${i+1} of ${out.length}\u2026`);
  try{const resp=await fetch(encodeURI(path));if(!resp.ok)throw 0;const f=await resp.blob(),name=path.split('/').pop(),mt=+new Date(resp.headers.get('Last-Modified'))||Date.now();
   const h=await sha(await f.arrayBuffer()),dup=P.some(p=>p.hash===h&&p.id!==path&&seen.has(p.id)&&!p.dup);
   const bmp=await createImageBitmap(f),k=480/Math.max(bmp.width,bmp.height,480),c=document.createElement('canvas');
   c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
   const thumb=await new Promise(r=>c.toBlob(r,'image/jpeg',.8));let ex={};
   try{ex=await exifr.parse(f)||{}}catch(_){}
   const p={tags:[],place:'',event:'',notes:'',fav:false,uploadedAt:Date.now(),id:path,name,hash:h,thumb,type:f.type||'image/jpeg',size:f.size,mtime:mt,w:bmp.width,h:bmp.height,
    takenAt:ex.DateTimeOriginal?+new Date(ex.DateTimeOriginal):mt,camera:[ex.Make,ex.Model].filter(Boolean).join(' ').trim(),
    lat:ex.latitude??null,lon:ex.longitude??null,dup};
   if(dup){p.hidden=true;d++}
   await save(p);P=P.filter(x=>x.id!==path);P.push(p);n++}catch(_){bad++}}
 if(out.length)for(const p of P.filter(p=>!seen.has(p.id)))await rem(p.id);
 P=await all();filters();render();
 toast(`${P.filter(p=>!p.hidden).length} photos${n?`, ${n} new`:''}${d?`, ${d} duplicate${d>1?'s':''} hidden`:''}${bad?`, ${bad} unreadable`:''}`)}

// ---- filters
const val=id=>$('#'+id).value;
function opts(id,label,vals,fmt=x=>x){const e=$('#'+id),v=e.value;e.innerHTML=`<option value="">${label}</option>`+vals.map(x=>`<option value="${esc(x)}">${esc(fmt(x))}</option>`).join('');e.value=v}
function filters(){const u=a=>[...new Set(a)].filter(x=>x!==''&&x!=null);
 opts('fy','All years',u(P.map(p=>new Date(p.takenAt).getFullYear())).sort((a,b)=>b-a));
 opts('fm','All months',[...Array(12).keys()],m=>MN[m]);opts('fc','All cameras',u(P.map(p=>p.camera)).sort());opts('fe','All events',u(P.map(p=>p.event)).sort())}
['q','fy','fm','fc','fe','d1','d2','so'].forEach(i=>$('#'+i).addEventListener('input',render));
$('#ff').onclick=()=>{favOnly=!favOnly;$('#ff').classList.toggle('on',favOnly);render()};
$('#clr').onclick=()=>{['q','fy','fm','fc','fe','d1','d2'].forEach(i=>$('#'+i).value='');favOnly=false;$('#ff').classList.remove('on');render()};
$('#vw').onclick=()=>{tl=!tl;$('#vw').textContent=tl?'Grid':'Timeline';render()};
function run(){const q=val('q').toLowerCase().split(/\s+/).filter(Boolean),y=val('fy'),m=val('fm'),c=val('fc'),ev=val('fe'),a=val('d1')?+new Date(val('d1')):0,z=val('d2')?+new Date(val('d2'))+864e5:1e15;
 const r=P.filter(p=>{if(p.hidden)return false;const d=new Date(p.takenAt);
  if(y&&d.getFullYear()!=y||m!==''&&d.getMonth()!=m||c&&p.camera!==c||ev&&p.event!==ev||p.takenAt<a||p.takenAt>=z||favOnly&&!p.fav)return false;
  const hay=[p.name,p.place,p.event,p.notes,p.camera,...p.tags].join(' ').toLowerCase();return q.every(w=>hay.includes(w))});
 const s=val('so');r.sort((x,y)=>s==='old'?x.takenAt-y.takenAt:s==='up'?y.uploadedAt-x.uploadedAt:s==='name'?x.name.localeCompare(y.name):y.takenAt-x.takenAt);return r}

// ---- grid
const th=p=>{if(!urls.has(p.id))urls.set(p.id,URL.createObjectURL(p.thumb));return urls.get(p.id)};
function render(){L=run();shown=0;$('#grid').innerHTML='';const T=P.filter(p=>!p.hidden).length;$('#count').textContent=`${L.length} of ${T} memor${T==1?'y':'ies'}`;
 const e=$('#empty');e.hidden=L.length>0;
 if(!L.length)e.innerHTML=P.length?'<h2>No memories match</h2><p>Try fewer words or clear the filters.</p>':'<h2>No memories here yet</h2><p>Put your photos in the photos folder, then click Rescan.</p>';
 more()}
let lastKey='';
function more(){const g=$('#grid'),end=Math.min(shown+60,L.length);if(!shown)lastKey='';let h='';
 for(let i=shown;i<end;i++){const p=L[i];
  if(tl&&val('so')!=='name'&&val('so')!=='up'){const d=new Date(p.takenAt),k=d.getFullYear()+'-'+d.getMonth();if(k!==lastKey){lastKey=k;h+=`<div class="mh">${MN[d.getMonth()]} ${d.getFullYear()}</div>`}}
  h+=`<div class="card${sel.has(p.id)?' sel':''}" data-i="${i}" tabindex="0"><img loading="lazy" src="${th(p)}" width="${p.w}" height="${p.h}" alt="${esc(p.name)}"><span class="ck"></span>${p.fav?'<span class="fv">♥</span>':''}</div>`}
 g.insertAdjacentHTML('beforeend',h);shown=end}
new IntersectionObserver(es=>{if(es[0].isIntersecting&&shown<L.length)more()},{rootMargin:'600px'}).observe($('#more'));
$('#grid').onclick=e=>{const c=e.target.closest('.card');if(!c)return;const p=L[c.dataset.i];
 if(selMode){sel.has(p.id)?sel.delete(p.id):sel.add(p.id);c.classList.toggle('sel');bar()}else show(+c.dataset.i)};
$('#grid').onkeydown=e=>{if(e.key==='Enter')e.target.click()};

// ---- select / batch
function bar(){$('#bar').hidden=!selMode;$('#bn').textContent=sel.size+' selected'}
$('#selb').onclick=()=>{selMode=!selMode;document.body.classList.toggle('selmode',selMode);if(!selMode)sel.clear();$$('.card.sel').forEach(c=>c.classList.remove('sel'));bar()};
$('#bx').onclick=()=>$('#selb').click();
const chosen=()=>P.filter(p=>sel.has(p.id));
$('#bt').onclick=async()=>{const t=prompt('Tags to add (comma separated)');if(!t)return;const n=t.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 for(const p of chosen()){p.tags=[...new Set([...p.tags,...n])];await save(p)}toast('Tags added');render()};
$('#be').onclick=async()=>{const t=prompt('Event name');if(t===null)return;for(const p of chosen()){p.event=t.trim();await save(p)}filters();render()};
$('#bf').onclick=async()=>{for(const p of chosen()){p.fav=true;await save(p)}render()};
$('#bd').onclick=async()=>{if(!sel.size||!confirm(`Hide ${sel.size} photo(s) from the gallery? Files in your folder are not touched.`))return;
 for(const p of chosen()){p.hidden=true;await save(p)}sel.clear();bar();filters();render()};

// ---- lightbox
let big=null;
function show(i){cur=i;const p=L[i];if(big)URL.revokeObjectURL(big);big=encodeURI(p.id);
 const im=$('#im');im.classList.remove('z');im.src=big||th(p);im.alt=p.name;$('#lb').hidden=false;document.body.style.overflow='hidden';
 $('#mt').value=p.tags.join(', ');$('#mp').value=p.place;$('#me').value=p.event;$('#mn').value=p.notes;
 const d=new Date(p.takenAt-new Date(p.takenAt).getTimezoneOffset()*6e4);$('#md').value=d.toISOString().slice(0,16);
 $('#lf2').textContent=(p.fav?'♥':'♡')+' Favorite';
 $('#info').innerHTML=[['File',p.name],['Size',fmtSize(p.size)+' · '+p.type.replace('image/','')],['Dimensions',p.w+' × '+p.h],['Camera',p.camera||'Unknown'],
  ['Uploaded',new Date(p.uploadedAt).toLocaleDateString()],['GPS',p.lat!=null?p.lat.toFixed(3)+', '+p.lon.toFixed(3):'None']].map(([a,b])=>`<dt>${a}</dt><dd>${esc(b)}</dd>`).join('')}
const go=d=>{if(L.length)show((cur+d+L.length)%L.length)};
$('#pv').onclick=()=>go(-1);$('#nx').onclick=()=>go(1);
$('#im').onclick=e=>e.target.classList.toggle('z');
$('#cl').onclick=()=>{$('#lb').hidden=true;document.body.style.overflow='';render()};
addEventListener('keydown',e=>{if($('#lb').hidden||/INPUT|TEXTAREA/.test(e.target.tagName))return;
 if(e.key==='ArrowRight')go(1);else if(e.key==='ArrowLeft')go(-1);else if(e.key==='Escape')$('#cl').click();else if(e.key==='+'||e.key==='z')$('#im').click()});
$('#sv').onclick=async()=>{const p=L[cur];p.tags=$('#mt').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);p.place=$('#mp').value.trim();p.event=$('#me').value.trim();p.notes=$('#mn').value.trim();
 if($('#md').value)p.takenAt=+new Date($('#md').value);await save(p);filters();toast('Saved')};
$('#lf2').onclick=async()=>{const p=L[cur];p.fav=!p.fav;await save(p);$('#lf2').textContent=(p.fav?'♥':'♡')+' Favorite'};
$('#dl').onclick=()=>{const p=L[cur],a=document.createElement('a');a.href=big;a.download=p.name;a.click()};
$('#rm').onclick=async()=>{const p=L[cur];if(!confirm('Hide this photo from the gallery? The file in your folder is not touched.'))return;p.hidden=true;await save(p);filters();
 L=run();if(!L.length){$('#cl').click();return}show(Math.min(cur,L.length-1))};
