(function(){
'use strict';
const DB='dfa-receipt-vault-v1';let overlay=null;
const $=id=>document.getElementById(id);
function database(){return new Promise((ok,bad)=>{if(!indexedDB)return bad(Error('Local receipt storage is unavailable'));const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('receipts'))r.result.createObjectStore('receipts',{keyPath:'id'})};r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)})}
async function query(method,mode,entry){const db=await database();return new Promise((ok,bad)=>{const t=db.transaction('receipts',mode),s=t.objectStore('receipts'),r=s[method](entry);r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error);t.oncomplete=()=>db.close();t.onerror=()=>bad(t.error)})}
const all=()=>query('getAll','readonly');const save=r=>query('put','readwrite',r);const remove=id=>query('delete','readwrite',id);
const dateNow=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
function notice(msg,error=false){const n=$('rv-message');if(n){n.textContent=msg;n.style.color=error?'#ffbaba':'#74f0d8'}}
function close(){if(overlay){overlay.remove();overlay=null;document.body.style.overflow=''}}
async function list(){
 const box=$('rv-list');if(!box)return;
 try{
 const rows=(await all()).sort((a,b)=>b.date.localeCompare(a.date)||b.created.localeCompare(a.created));box.replaceChildren();
 if(!rows.length){box.textContent='No receipts saved yet.';return}
 const p=document.createElement('p');p.textContent=rows.length+' saved receipt(s) — photos are not counted as new expenses.';box.append(p);
 for(const r of rows){
 const el=document.createElement('div');el.className='rv-item';const title=document.createElement('strong');title.textContent=r.date+' · '+r.category+' · £'+r.amount.toFixed(2);
 const sub=document.createElement('p');sub.textContent=(r.driver==='brother'?'Brother':'You')+' · '+(r.merchant||'No shop entered');
 const view=document.createElement('button');view.textContent='View photo';view.onclick=()=>{
 const url=URL.createObjectURL(r.photo);const w=window.open(url,'_blank');if(!w)notice('Allow the photo window to open, or export receipts to view it.',true);setTimeout(()=>URL.revokeObjectURL(url),60000)};
 const erase=document.createElement('button');erase.textContent='Delete';erase.onclick=async()=>{if(!confirm('Permanently remove this saved receipt?'))return;try{await remove(r.id);await list();notice('Receipt removed')}catch(e){notice('Delete failed: '+e.message,true)}};
 el.append(title,sub,view,erase);box.append(el)}
 }catch(e){box.textContent='Could not load saved receipts: '+e.message}
}
function open(){
 if(overlay)return;
 overlay=document.createElement('div');overlay.id='rv-overlay';
 overlay.innerHTML='<section id="rv-panel" role="dialog" aria-modal="true" aria-label="Receipt folder"><div class="rv-row"><h2>📸 Receipt Folder</h2><button id="rv-close" type="button">✕</button></div><p class="rv-info">Photograph fuel, parking and other receipts. Photos stay on this phone. Saving a receipt does not deduct an expense again.</p><form id="rv-form"><label>Photograph receipt<input id="rv-photo" type="file" accept="image/*" capture="environment" required></label><label>Category<select id="rv-category"><option>Fuel</option><option>Parking</option><option>Maintenance</option><option>Tolls</option><option>Cleaning</option><option>Other</option></select></label><label>Vehicle<select id="rv-driver"><option value="me">My vehicle</option><option value="brother">Brother</option></select></label><label>Date<input id="rv-date" type="date" required></label><label>Amount paid (£)<input id="rv-amount" type="number" min="0" step=".01" required placeholder="60.00"></label><label>Shop / note<input id="rv-merchant" maxlength="120" placeholder="e.g. Shell Plymouth"></label><button class="rv-primary" id="rv-save" type="submit">Save Receipt</button></form><p id="rv-message" role="status"></p><div class="rv-row"><h3>Saved receipts</h3><button id="rv-export" type="button">Download folder ZIP</button></div><p class="rv-info">The ZIP includes receipt images, a CSV index and a JSON backup. Keep your ZIP safe: deleting the app or browser data may erase stored photos. This is not cloud sync or automatic receipt scanning.</p><div id="rv-list">Loading…</div></section>';
 document.body.append(overlay);document.body.style.overflow='hidden';$('rv-date').value=dateNow();$('rv-close').onclick=close;$('rv-form').onsubmit=onSave;$('rv-export').onclick=onExport;list();
}
async function onSave(e){
 e.preventDefault();const f=$('rv-photo').files[0],amount=Number($('rv-amount').value);
 if(!f||!f.type.startsWith('image/'))return notice('Choose a receipt image first.',true);
 if(f.size>20e6)return notice('Photo exceeds 20 MB. Choose a smaller image.',true);
 if(!Number.isFinite(amount)||amount<0)return notice('Enter an amount of zero or more.',true);
 const button=$('rv-save');button.disabled=true;
 try{
 const existing=await all();
 const same=existing.some(r=>r.date===$('rv-date').value&&r.category===$('rv-category').value&&r.driver===$('rv-driver').value&&Math.abs(r.amount-amount)<0.005&&(!r.merchant||!$('rv-merchant').value.trim()||r.merchant.toLowerCase()===$('rv-merchant').value.trim().toLowerCase()));
 if(same&&!confirm('This looks like a receipt already saved for the same date, vehicle, category and amount. Save another copy anyway?'))return;
 await save({id:Date.now()+'-'+Math.random().toString(36).slice(2),photo:f,filename:f.name||'receipt',mime:f.type,date:$('rv-date').value,amount:Math.round(amount*100)/100,category:$('rv-category').value,driver:$('rv-driver').value,merchant:$('rv-merchant').value.trim(),created:new Date().toISOString()});$('rv-form').reset();$('rv-date').value=dateNow();notice('Receipt saved locally. Export ZIP regularly for safekeeping.');await list()}
 catch(e){notice('Save failed: '+e.message+'. No expense was changed.',true)}finally{button.disabled=false}
}
const enc=s=>new TextEncoder().encode(s);
const l16=n=>[n&255,n>>>8&255],l32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
const table=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc(data){let c=0xffffffff;for(const x of data)c=table[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function zip(files){const blocks=[],central=[];let offset=0;
 for(const f of files){const name=enc(f.name),data=f.data,len=data.length,checksum=crc(data);
 const local=new Uint8Array([80,75,3,4,20,0,0,8,0,0,0,0,0,0,...l32(checksum),...l32(len),...l32(len),...l16(name.length),0,0]);blocks.push(local,name,data);
 const head=new Uint8Array([80,75,1,2,20,0,20,0,0,8,0,0,0,0,0,0,...l32(checksum),...l32(len),...l32(len),...l16(name.length),0,0,0,0,0,0,0,0,0,0,0,0,...l32(offset)]);central.push(head,name);offset+=local.length+name.length+len}
 const size=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array([80,75,5,6,0,0,0,0,...l16(files.length),...l16(files.length),...l32(size),...l32(offset),0,0]);
 return new Blob([...blocks,...central,end],{type:'application/zip'})}
const cell=x=>{let s=String(x??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
async function onExport(){
 const button=$('rv-export');button.disabled=true;notice('Preparing your receipt folder…');
 try{const rows=await all();if(!rows.length)return notice('Add a receipt before exporting.',true);
 const files=[],index=['Date,Driver,Category,Amount GBP,Shop,Image path'],backup=[];
 for(let i=0;i<rows.length;i++){
 const r=rows[i],extension=/png/.test(r.mime)?'png':/webp/.test(r.mime)?'webp':/heic/.test(r.mime)?'heic':/heif/.test(r.mime)?'heif':'jpg';
 const path='Receipts/'+r.date.substring(0,7)+'/'+r.category.toLowerCase().replace(/[^a-z]/g,'-')+'/'+r.date+'-'+String(i+1).padStart(3,'0')+'.'+extension;
 files.push({name:path,data:new Uint8Array(await r.photo.arrayBuffer())});index.push([r.date,r.driver,r.category,r.amount.toFixed(2),r.merchant,path].map(cell).join(','));
 const {photo,...details}=r;backup.push({...details,archivePath:path})}
 files.push({name:'receipt-index.csv',data:enc(index.join('\r\n'))},{name:'receipt-records.json',data:enc(JSON.stringify({exported:new Date().toISOString(),receipts:backup},null,2))},{name:'README.txt',data:enc('Receipt photos are supporting evidence and do not create extra expenses in Driver Finance AI. Keep this archive secure. Reconcile costs against existing fuel entries.\n')});
 const url=URL.createObjectURL(zip(files)),a=document.createElement('a');a.href=url;a.download='driver-finance-receipts-'+dateNow()+'.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),120000);notice('Receipt ZIP ready. Save the download in Files or a secure backup.')}
 catch(e){notice('ZIP export failed: '+e.message,true)}finally{button.disabled=false}
}
function card(){
 const view=$('view');if(!view||$('rv-card'))return;
 const c=document.createElement('div');c.id='rv-card';c.className='card';c.style.cssText='margin:14px 0;border:1px solid #1b9cff;background:linear-gradient(125deg,#092443,#07172b);color:white';
 c.innerHTML='<div class="title">📸 Receipt Folder</div><p class="small" style="color:#bfd6e9">Take photos of fuel and work receipts. Export them for your accountant.</p><button class="btn" type="button">Add / View Receipts</button>';c.querySelector('button').onclick=open;
 const other=$('sm-entry')||$('dfa-entry');if(other)other.insertAdjacentElement('afterend',c);else view.insertAdjacentElement('afterbegin',c)
}
function init(){
 const style=document.createElement('style');
 style.textContent='#rv-overlay{position:fixed;inset:0;z-index:12000;overflow:auto;background:#010a18df;padding:14px 9px;display:flex;justify-content:center}#rv-panel{width:min(450px,100%);margin:auto 0;padding:20px;background:linear-gradient(145deg,#09213d,#041122);border-radius:22px;border:1px solid #228ee2;color:#f2f9ff;font:14px/1.5 system-ui}#rv-panel .rv-row{display:flex;justify-content:space-between;gap:9px;align-items:center}#rv-panel h2{font-size:22px;margin:0}#rv-panel h3{margin:0;color:#a6ddff}#rv-panel label{display:block;font-weight:650;margin:12px 0}#rv-panel input,#rv-panel select{display:block;width:100%;background:#0b2b4a;color:#fff;border:1px solid #477eae;border-radius:10px;padding:12px;margin-top:6px;font-size:16px}#rv-panel input[type=file]{font-size:13px}#rv-panel button{background:#15496d;color:#fff;border:1px solid #43a0dd;border-radius:10px;padding:10px;font-weight:700}#rv-panel .rv-primary{width:100%;padding:15px;background:linear-gradient(100deg,#178cf0,#095aaf)}#rv-panel .rv-info{color:#b7cfe1;font-size:12px;line-height:1.6}#rv-panel .rv-item{padding:13px 0;border-bottom:1px solid #315169}#rv-panel .rv-item p{margin:4px 0;color:#b7cfe1}#rv-panel .rv-item button{font-size:12px;margin-right:8px}';
 document.head.append(style);const view=$('view');if(view){new MutationObserver(card).observe(view,{childList:true});card()}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();