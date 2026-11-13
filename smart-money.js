(function(){
'use strict';
const K='dfa-smart-planner-v1',S='dfa-shift-tracker-v1';
let state={rent:530,opening:0,allocations:[],reserves:{me:0,brother:0}};
try{const v=JSON.parse(localStorage.getItem(K)||'null');if(v&&typeof v==='object')state={...state,...v,reserves:{...state.reserves,...(v.reserves||{})}}}catch(e){}
// Keep legacy entries for audit, but count only a single confirmed rent balance.
if(!Object.prototype.hasOwnProperty.call(state,'rentBalance')){
 const a=Array.isArray(state.allocations)?state.allocations:[];
 const knownTests=Number(state.opening)===0&&a.length===2&&
   [130,530].every(n=>a.some(x=>Number(x.amount)===n&&x.pot==='rent'&&x.date==='13/11/2026'));
 state.allocations=a.map(x=>({...x,test:knownTests?true:!!x.test}));
 state.rentBalance=knownTests?0:Math.max(0,Number(state.opening||0)+a.filter(x=>x.pot==='rent'&&!x.test).reduce((n,x)=>n+Number(x.amount||0),0));
 state.rentBalanceNeedsReview=!knownTests&&a.length>0;
 try{localStorage.setItem(K,JSON.stringify(state))}catch(e){}
}
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
  const reserve=Math.max(0,Number(state.reserves[id])||0);
  const afterFuel=Math.max(0,todayEarnings-todayFuel);
  // Reserve is an estimate, and may include fuel. Never present it as confirmed spendable cash.
  const afterSeparateReserve=Math.max(0,afterFuel-reserve);
  out[id]={earnings,diesel,todayEarnings,todayFuel,count:h.length,fillCount:f.length,averageFill:f.length?diesel/f.length:0,refillEvery:gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null,patterns,afterFuel,afterSeparateReserve,reserve,available:afterSeparateReserve};
 }
 const funded=Math.max(0,Number(state.rentBalance)||0);
 const rent=Math.max(1,Number(state.rent||530));
 const remaining=Math.max(0,rent-funded);
 return {out,funded,rent,remaining,months:Math.floor(funded/rent)};
}
let modal=null;
function render(){
 if(!modal)return;
 const c=calculate(),data=c.out;
 const person=id=>{
 const d=data[id],pat=d.patterns,compare=pat.noon.length>=3&&pat.three.length>=3?'Noon-start: '+money(pat.noon.reduce((a,b)=>a+b,0)/pat.noon.length)+'/hour; 3pm-start: '+money(pat.three.reduce((a,b)=>a+b,0)/pat.three.length)+'/hour (gross).':'Keep logging both shift types to compare earnings per hour.';
 return '<div class="sm-person"><b>'+(id==='me'?'You':'Brother')+'</b><div>Today earned: '+money(d.todayEarnings)+' · fuel purchased: '+money(d.todayFuel)+'</div><div>Today available after recorded fuel and daily reserve: <b>'+money(d.available)+'</b></div><div>All recorded shifts: '+d.count+' · earnings '+money(d.earnings)+' · fuel '+money(d.diesel)+'</div><div>Typical fuel purchase: '+(d.fillCount?money(d.averageFill):'not yet known')+'; refill interval: '+(d.refillEvery?d.refillEvery.toFixed(1)+' days':'not yet known')+'</div><div>'+compare+'</div></div>';
 };
 const history=(state.allocations||[]).slice().reverse().slice(0,6).map(x=>'<div class="sm-person">'+esc(x.driver==='me'?'You':'Brother')+' · '+money(x.amount)+' · '+esc(x.pot)+' · '+esc(x.date)+(x.test?' · test entry (excluded)':' · previous entry')+'</div>').join('');
 const combined=data.me.todayEarnings+data.brother.todayEarnings;
 const fuelToday=data.me.todayFuel+data.brother.todayFuel;
 const afterFuel=data.me.afterFuel+data.brother.afterFuel;
 const reserves=data.me.reserve+data.brother.reserve;
 const afterSeparateReserves=data.me.afterSeparateReserve+data.brother.afterSeparateReserve;
 const suggest=Math.min(c.remaining,afterSeparateReserves);
 const counts=data.me.count+data.brother.count;
 let guide;
 if(state.rentBalanceNeedsReview){
  guide='Please confirm the amount you genuinely have set aside for rent. Earlier entries remain in history but must not be assumed to be available cash.';
 }else if(c.remaining===0){
  guide='Your next rent target is fully covered by the amount you marked as saved. Keep that money separate; this app has not checked a bank account or transferred anything.';
 }else if(combined<=0){
  guide='You have '+money(c.funded)+' saved for rent and '+money(c.remaining)+' still to save. No shift earnings have been recorded today. Record real earnings and fuel costs to receive a useful suggestion.';
 }else{
  guide='Between both drivers, today you recorded '+money(combined)+' earned and '+money(fuelToday)+' spent on fuel. That leaves up to '+money(afterFuel)+' before other costs. ';
  if(reserves>0)guide+='You also set '+money(reserves)+' in daily reserve estimates, which may overlap with fuel. ';
  guide+='If the reserves are entirely separate from fuel and all other essentials are covered, up to '+money(suggest)+' could go towards the '+money(c.remaining)+' remaining rent target. This is only a suggestion: confirm what you actually save in the rent field.';
 }
 if(counts===0&&combined===0)guide+=' The app needs real completed shifts before it can compare working times.';
 const warning='Planning estimates only: no bank connection, automatic transfers, or cross-phone sync. Keep money actually saved separate from suggested amounts. Diesel and daily reserves may overlap.';
 modal.innerHTML='<div class="sm-wrap" id="sm-wrap"><section class="sm-dialog" role="dialog" aria-modal="true"><div class="sm-head"><b>🧠 Your Money Guide</b><button id="sm-close" aria-label="Close">✕</button></div>'+
 '<p class="sm-muted">One rent balance. No duplicate contribution forms. Guidance uses the shifts and fuel you record. Nothing transfers money automatically. Records stay on this phone.</p>'+
 '<div class="sm-highlight">Next rent target <strong>'+money(c.rent)+'</strong><div>Actually saved for next rent: <b>'+money(c.funded)+'</b></div><div>Still to save: <b>'+money(c.remaining)+'</b></div><div>Last month’s rent: Paid (separate from current savings)</div></div>'+
 '<div class="sm-guide"><b>💬 Your guide says</b><p id="sm-guide-text">'+esc(guide)+'</p><button class="sm-btn" id="sm-speak">🔊 Read guidance aloud</button><p class="sm-muted">This is automatic, rules-based guidance, not a live AI conversation. Spoken audio depends on your iPhone browser settings.</p></div>'+
 '<h3>Keep it simple</h3><label>Monthly rent target (£)<input id="sm-rent" type="number" min="1" step=".01" value="'+c.rent+'"></label>'+
 '<label>Money actually saved for the next rent (£)<input id="sm-balance" type="number" min="0" step=".01" value="'+c.funded+'"></label>'+
 '<p class="sm-muted">Enter 0 if you have saved nothing. Update this one number when you put money aside. Do not also enter it anywhere else in the planner.</p>'+
 (state.rentBalanceNeedsReview?'<p class="sm-muted">Please confirm the amount above. Old entries have been preserved for reference.</p>':'')+
 '<button class="sm-btn" id="sm-save">Save my rent figures</button>'+
 '<h3>Today’s shift information</h3>'+person('me')+person('brother')+
 '<details><summary>Advanced: daily reserves and history</summary><p class="sm-muted">Reserves are estimates, not extra payments. If your reserve already includes diesel, do not treat the after-reserve figure as spendable cash. The guide gives conditional advice rather than subtracting diesel twice.</p>'+
 '<label>Your daily vehicle/tax reserve (£)<input id="sm-me" type="number" min="0" step=".01" value="'+Number(state.reserves.me||0)+'"></label>'+
 '<label>Brother’s daily vehicle/tax reserve (£)<input id="sm-brother" type="number" min="0" step=".01" value="'+Number(state.reserves.brother||0)+'"></label>'+
 '<button class="sm-btn" id="sm-reserves">Save reserves</button><h3>Earlier entries (kept for reference)</h3>'+(history||'<p>No previous entries</p>')+'</details>'+
 '<button class="sm-btn" id="sm-export">Download planner and shift backup</button><p class="sm-muted">'+esc(warning)+'</p></section></div>';
 modal.querySelector('#sm-close').onclick=close;
 modal.querySelector('#sm-wrap').onclick=e=>{if(e.target.id==='sm-wrap')close()};
 modal.querySelector('#sm-save').onclick=()=>{
  const rentText=modal.querySelector('#sm-rent').value,balText=modal.querySelector('#sm-balance').value;
  const rent=Number(rentText),bal=Number(balText);
  if(!rentText.trim()||!balText.trim()||!Number.isFinite(rent)||rent<=0||!Number.isFinite(bal)||bal<0){alert('Enter valid amounts. Zero savings is allowed.');return}
  state.rent=rent;state.rentBalance=bal;state.rentBalanceNeedsReview=false;save();
 };
 modal.querySelector('#sm-reserves').onclick=()=>{
  const me=Number(modal.querySelector('#sm-me').value),brother=Number(modal.querySelector('#sm-brother').value);
  if(!Number.isFinite(me)||!Number.isFinite(brother)||me<0||brother<0){alert('Enter valid reserves, including zero.');return}
  state.reserves={me,brother};save();
 };
 modal.querySelector('#sm-speak').onclick=()=>{
  if(!('speechSynthesis' in window)){alert('Spoken guidance is not available in this browser. You can read the guidance above.');return}
  try{window.speechSynthesis.cancel();const msg=new SpeechSynthesisUtterance(guide);msg.lang='en-GB';msg.rate=0.95;window.speechSynthesis.speak(msg)}catch(e){alert('Unable to play audio. The written guidance is still available.')}
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
 card.innerHTML='<div class="title">🧠 Your Money Guide</div><p class="small">See what you really have saved, what is left for rent, and get spoken guidance.</p><button class="btn" id="sm-open">Open Planner</button>';
 shift.insertAdjacentElement('afterend',card);card.querySelector('button').onclick=open;
}
function init(){
 const css=document.createElement('style');css.textContent='.sm-guide{padding:12px;border:1px solid #246e93;border-radius:12px;margin-top:12px;background:#092c45}.sm-dialog details{margin:18px 0}.sm-dialog summary{cursor:pointer;font-weight:700;color:#a5dfff}.sm-wrap{position:fixed;inset:0;z-index:10050;background:#020912ed;overflow:auto;padding:14px 10px;display:flex;justify-content:center}.sm-dialog{width:min(440px,100%);margin:auto 0;padding:22px;background:linear-gradient(130deg,#08223f,#061020);color:#f2f9ff;border:1px solid #238ed1;border-radius:20px;font:14px/1.5 system-ui}.sm-head{display:flex;justify-content:space-between;align-items:center;font-size:20px}.sm-head button{border:0;background:#24435c;color:white;border-radius:9px;padding:10px}.sm-muted{font-size:12px;color:#b3c9da}.sm-dialog h3{margin:22px 0 12px;color:#a5dfff}.sm-dialog label{display:block;margin:12px 0;font-weight:650}.sm-dialog input,.sm-dialog select{display:block;width:100%;border:1px solid #47799d;border-radius:11px;background:#0a2744;color:white;padding:13px;margin-top:6px;font-size:16px}.sm-btn{width:100%;border:1px solid #3ca7e1;background:linear-gradient(120deg,#1688ef,#0762aa);border-radius:12px;color:white;font-weight:800;padding:14px;margin:8px 0}.sm-highlight{background:#0a3a54;border:1px solid #139e9e;border-radius:14px;padding:15px}.sm-highlight strong{display:block;font-size:30px;color:#64e8cf}.sm-person{padding:12px 0;border-bottom:1px solid #284862;font-size:13px}';
 document.head.appendChild(css);
 const v=document.getElementById('view');if(v){new MutationObserver(addCard).observe(v,{childList:true});addCard()}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();