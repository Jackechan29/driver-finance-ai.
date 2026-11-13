(function(){
'use strict';
const K='dfa-smart-planner-v1',S='dfa-shift-tracker-v1';
let state={rent:530,opening:0,allocations:[],reserves:{me:0,brother:0}};
try{const v=JSON.parse(localStorage.getItem(K)||'null');if(v&&typeof v==='object')state={...state,...v,reserves:{...state.reserves,...(v.reserves||{})}}}catch(e){}
const money=n=>'£'+Number(n||0).toFixed(2);
const read=()=>{try{return JSON.parse(localStorage.getItem(S)||'{}')}catch(e){return {}}};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const date=d=>new Date(d).toLocaleDateString('en-GB');
function calculate(){
 const raw=read(),shifts=Array.isArray(raw.history)?raw.history:[],fuel=Array.isArray(raw.fuel)?raw.fuel:[],out={};
 for(const id of ['me','brother']){
  const h=shifts.filter(x=>x.driver===id),f=fuel.filter(x=>x.driver===id);
  const earnings=h.reduce((n,x)=>n+(Number(x.earnings)||0),0),diesel=f.reduce((n,x)=>n+(Number(x.amount)||0),0);
  const today=new Date().toDateString();
  const todayEarnings=h.filter(x=>new Date(x.end).toDateString()===today).reduce((n,x)=>n+(Number(x.earnings)||0),0);
  const todayFuel=f.filter(x=>new Date(x.date).toDateString()===today).reduce((n,x)=>n+(Number(x.amount)||0),0);
  const patterns={noon:[],three:[]};
  for(const x of h){
   const hour=new Date(x.start).getHours(),duration=(Date.parse(x.end)-Date.parse(x.start))/3600000;
   if(duration>0&&duration<20){if(hour>=11&&hour<=13)patterns.noon.push(Number(x.earnings||0)/duration);if(hour>=14&&hour<=16)patterns.three.push(Number(x.earnings||0)/duration)}
  }
  const dates=[...new Set(f.map(x=>new Date(x.date).toDateString()))].map(x=>new Date(x)).sort((a,b)=>a-b);
  const gaps=dates.slice(1).map((d,i)=>(d-dates[i])/86400000).filter(x=>x>0);
  out[id]={earnings,diesel,todayEarnings,todayFuel,count:h.length,fillCount:f.length,averageFill:f.length?diesel/f.length:0,refillEvery:gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null,patterns,available:Math.max(0,todayEarnings-todayFuel-(Number(state.reserves[id])||0))};
 }
 const funded=Number(state.opening||0)+state.allocations.filter(x=>x.pot==='rent').reduce((a,x)=>a+Number(x.amount||0),0);
 const rent=Math.max(1,Number(state.rent||530));
 const remaining=Math.max(0,rent-funded%rent);
 return {out,funded,rent,remaining:remaining===0?rent:remaining,months:Math.floor(funded/rent)};
}
let modal=null;
function render(){
 if(!modal)return;
 const c=calculate(),data=c.out;
 const person=id=>{
 const d=data[id],pat=d.patterns,compare=pat.noon.length>=3&&pat.three.length>=3?'Noon-start: '+money(pat.noon.reduce((a,b)=>a+b,0)/pat.noon.length)+'/hour; 3pm-start: '+money(pat.three.reduce((a,b)=>a+b,0)/pat.three.length)+'/hour (gross).':'Keep logging both shift types to compare earnings per hour.';
 return '<div class="sm-person"><b>'+(id==='me'?'You':'Brother')+'</b><div>Today earned: '+money(d.todayEarnings)+' · fuel purchased: '+money(d.todayFuel)+'</div><div>Today available after recorded fuel and daily reserve: <b>'+money(d.available)+'</b></div><div>All recorded shifts: '+d.count+' · earnings '+money(d.earnings)+' · fuel '+money(d.diesel)+'</div><div>Typical fuel purchase: '+(d.fillCount?money(d.averageFill):'not yet known')+'; refill interval: '+(d.refillEvery?d.refillEvery.toFixed(1)+' days':'not yet known')+'</div><div>'+compare+'</div></div>';
 };
 const lines=state.allocations.slice(-7).reverse().map(x=>'<div class="sm-person">'+esc(x.driver==='me'?'You':'Brother')+' · '+money(x.amount)+' · '+esc(x.pot)+' · '+esc(x.date)+'</div>').join('');
 modal.innerHTML='<div class="sm-wrap" id="sm-wrap"><section class="sm-dialog" role="dialog" aria-modal="true"><div class="sm-head"><b>🧠 Smart Money Planner</b><button id="sm-close">✕</button></div>'+
 '<p class="sm-muted">Planning only: no money moves automatically. Records stay on this device; your brother’s records only appear if entered here.</p>'+
 '<div class="sm-highlight">Monthly rent goal <strong>'+money(c.rent)+'</strong><div>Rent genuinely allocated: '+money(c.funded)+'</div><div>Payments funded: '+c.months+'</div><div>Needed for next payment: <b>'+money(c.remaining)+'</b></div></div>'+
 '<p>For your Monday–Tuesday plan, aim for <b>'+money(c.remaining/4)+' each per day after costs</b> across two drivers and two days. This is a target, not a prediction.</p>'+
 person('me')+person('brother')+
 '<h3>Adjust financial assumptions</h3><label>Monthly rent (£)<input id="sm-rent" type="number" min="1" step=".01" value="'+c.rent+'"></label>'+
 '<label>Savings currently available towards rent (£; enter 0 if none)<input id="sm-opening" type="number" min="0" step=".01" value="'+Number(state.opening||0)+'"></label>'+
 '<label>Your daily fuel/vehicle/tax reserve (£)<input id="sm-me" type="number" min="0" step=".01" value="'+Number(state.reserves.me||0)+'"></label>'+
 '<label>Brother’s daily fuel/vehicle/tax reserve (£)<input id="sm-brother" type="number" min="0" step=".01" value="'+Number(state.reserves.brother||0)+'"></label>'+
 '<button class="sm-btn" id="sm-save">Save targets</button>'+
 '<h3>Record actual money put aside</h3><label>Driver<select id="sm-driver"><option value="me">You</option><option value="brother">Brother</option></select></label><label>Purpose<select id="sm-pot"><option value="rent">Rent</option><option value="other">Other bills</option></select></label><label>Amount (£)<input id="sm-amount" type="number" min=".01" step=".01" placeholder="0 is fine"></label><button class="sm-btn" id="sm-add">Record contribution</button>'+
 '<p class="sm-muted">Only enter money really set aside. These entries do not modify existing Money Pots or earnings records.</p><h3>Recorded contributions</h3>'+(lines||'<p class="sm-muted">None yet.</p>')+
 '<button class="sm-btn" id="sm-export">Download planner and shift backup</button><p class="sm-muted">Fuel is tracked as purchases, not matched daily consumption. Phone-lock GPS can miss miles. Profits and safe-to-spend are not verified without complete expenses and account balances.</p></section></div>';
 modal.querySelector('#sm-close').onclick=close;
 modal.querySelector('#sm-wrap').onclick=e=>{if(e.target.id==='sm-wrap')close()};
 modal.querySelector('#sm-save').onclick=()=>{
 const a=['rent','opening','me','brother'].map(x=>Number(modal.querySelector('#sm-'+x).value));
 if(a.some(x=>!Number.isFinite(x)||x<0)||a[0]<=0){alert('Enter valid non-negative amounts.');return}
 state.rent=a[0];state.opening=a[1];state.reserves={me:a[2],brother:a[3]};save();
 };
 modal.querySelector('#sm-add').onclick=()=>{
 const amount=Number(modal.querySelector('#sm-amount').value);
 if(!Number.isFinite(amount)||amount<0){alert('Enter a valid amount of £0 or more.');return} if(amount===0){alert('£0 saved is valid. No contribution has been added, and your savings remain unchanged.');return}
 state.allocations.push({amount,driver:modal.querySelector('#sm-driver').value,pot:modal.querySelector('#sm-pot').value,date:date(new Date())});save();
 };
 modal.querySelector('#sm-export').onclick=()=>{
 const file=new Blob([JSON.stringify({planner:state,shifts:read(),exported:new Date().toISOString()},null,2)],{type:'application/json'}),url=URL.createObjectURL(file),a=document.createElement('a');
 a.href=url;a.download='driver-finance-planner-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 };
}
function save(){try{localStorage.setItem(K,JSON.stringify(state));render()}catch(e){alert('Cannot save locally; please back up your records.')}}
function open(){modal=document.createElement('div');document.body.appendChild(modal);document.body.style.overflow='hidden';render()}
function close(){if(modal)modal.remove();modal=null;document.body.style.overflow=''}
function addCard(){
 const shift=document.getElementById('dfa-entry');if(!shift||document.getElementById('sm-card'))return;
 const card=document.createElement('div');card.id='sm-card';card.className='card';card.style.cssText='background:linear-gradient(130deg,#092a42,#07172b);border:1px solid #24a8a1;color:white';
 card.innerHTML='<div class="title">🧠 Smart Money Planner</div><p class="small">Forecast your £530 rent target from saved shifts and fuel, with separate driver reserves.</p><button class="btn" id="sm-open">Open Planner</button>';
 shift.insertAdjacentElement('afterend',card);card.querySelector('button').onclick=open;
}
function init(){
 const css=document.createElement('style');css.textContent='.sm-wrap{position:fixed;inset:0;z-index:10050;background:#020912ed;overflow:auto;padding:14px 10px;display:flex;justify-content:center}.sm-dialog{width:min(440px,100%);margin:auto 0;padding:22px;background:linear-gradient(130deg,#08223f,#061020);color:#f2f9ff;border:1px solid #238ed1;border-radius:20px;font:14px/1.5 system-ui}.sm-head{display:flex;justify-content:space-between;align-items:center;font-size:20px}.sm-head button{border:0;background:#24435c;color:white;border-radius:9px;padding:10px}.sm-muted{font-size:12px;color:#b3c9da}.sm-dialog h3{margin:22px 0 12px;color:#a5dfff}.sm-dialog label{display:block;margin:12px 0;font-weight:650}.sm-dialog input,.sm-dialog select{display:block;width:100%;border:1px solid #47799d;border-radius:11px;background:#0a2744;color:white;padding:13px;margin-top:6px;font-size:16px}.sm-btn{width:100%;border:1px solid #3ca7e1;background:linear-gradient(120deg,#1688ef,#0762aa);border-radius:12px;color:white;font-weight:800;padding:14px;margin:8px 0}.sm-highlight{background:#0a3a54;border:1px solid #139e9e;border-radius:14px;padding:15px}.sm-highlight strong{display:block;font-size:30px;color:#64e8cf}.sm-person{padding:12px 0;border-bottom:1px solid #284862;font-size:13px}';
 document.head.appendChild(css);
 const v=document.getElementById('view');if(v){new MutationObserver(addCard).observe(v,{childList:true});addCard()}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();