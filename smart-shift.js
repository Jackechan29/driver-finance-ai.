/* Smart Shift Tracker v1. Separate local storage; existing finance data remains unchanged. */
(function(){
'use strict';
const KEY='dfa-shift-tracker-v1';
let state={active:null,history:[],fuel:[]};
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&typeof saved==='object')state={...state,...saved}}catch(e){}
let watch=null, modal=null;
const pounds=n=>'£'+Number(n||0).toFixed(2);
const save=()=>{try{const clean={...state,active:state.active?{...state.active,last:null}:null};localStorage.setItem(KEY,JSON.stringify(clean))}catch(e){alert('Storage is full. Your shift may not save.')}};
function markGap(){if(state.active){state.active.incomplete=true;save()}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)markGap()});
window.addEventListener('pagehide',markGap);
function stopGPS(){if(watch!==null&&navigator.geolocation){navigator.geolocation.clearWatch(watch);watch=null}}
function gps(){
 stopGPS();if(!state.active||!navigator.geolocation)return;
 watch=navigator.geolocation.watchPosition(p=>{
  const a=state.active;if(!a)return;
  if(document.hidden){a.incomplete=true;save();return}
  const c=p.coords,t=p.timestamp||Date.now();
  if(c.accuracy>70||!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude))return;
  if(a.last){
   const dt=(t-a.last.time)/1000;
   if(dt>90){a.incomplete=true}
   else if(dt>0){
    const R=3958.7613, rad=x=>x*Math.PI/180;
    const dlat=rad(c.latitude-a.last.lat),dlon=rad(c.longitude-a.last.lon);
    const q=Math.sin(dlat/2)**2+Math.cos(rad(a.last.lat))*Math.cos(rad(c.latitude))*Math.sin(dlon/2)**2;
    const miles=2*R*Math.asin(Math.min(1,Math.sqrt(q)));
    const speed=miles/(dt/3600);
    if(miles>.012&&speed<100&&c.accuracy<45)a.miles+=miles;
   }
  }
  a.last={lat:c.latitude,lon:c.longitude,time:t};a.samples=(a.samples||0)+1;save();refresh();
 },()=>{markGap();refresh()}, {enableHighAccuracy:true,maximumAge:0,timeout:20000});
}
function start(){
 if(state.active)return;
 const driver=document.getElementById('dfa-driver').value;
 state.active={driver,start:new Date().toISOString(),miles:0,samples:0,last:null,incomplete:false};
 save();gps();render();
}
function finish(){
 const a=state.active;if(!a)return;
 stopGPS();
 const earnings=Number(document.getElementById('dfa-earnings').value||0);
 const odometer=Number(document.getElementById('dfa-odo').value||0);
 if(!Number.isFinite(earnings)||earnings<0||!Number.isFinite(odometer)||odometer<0){alert('Enter valid amounts.');return}
 const end=new Date().toISOString();
 const shift={id:Date.now(),driver:a.driver,start:a.start,end,trackedMiles:Math.round(a.miles*10)/10,odometerMiles:odometer>0?odometer:null,incomplete:a.incomplete||a.samples<2,earnings:Math.round(earnings*100)/100};
 state.history.unshift(shift);state.active=null;save();render();
}
function addFuel(){
 const driver=document.getElementById('dfa-fuel-driver').value,amount=Number(document.getElementById('dfa-fuel-amount').value);
 if(!Number.isFinite(amount)||amount<=0){alert('Enter the amount paid for fuel.');return}
 state.fuel.unshift({id:Date.now(),driver,amount:Math.round(amount*100)/100,date:new Date().toISOString()});save();render();
}
function modalHtml(){
 const a=state.active;
 const fuel=state.fuel.slice(0,8).map(f=>'<div class="dfa-line">'+(f.driver==='brother'?'Brother':'You')+' · '+new Date(f.date).toLocaleDateString('en-GB')+' <strong>'+pounds(f.amount)+'</strong></div>').join('');
 const history=state.history.slice(0,8).map(s=>'<div class="dfa-line"><strong>'+(s.driver==='brother'?'Brother':'You')+'</strong> · '+new Date(s.start).toLocaleDateString('en-GB')+' · '+((Date.parse(s.end)-Date.parse(s.start))/3600000).toFixed(1)+' hours · '+(s.odometerMiles??s.trackedMiles).toFixed(1)+' mi '+(s.incomplete?'(GPS partial)':'(GPS tracked)')+' · '+pounds(s.earnings)+'</div>').join('');
 return '<div class="dfa-backdrop" id="dfa-backdrop"><section class="dfa-panel" role="dialog" aria-modal="true" aria-label="Shift tracker"><div class="row"><h2>Smart Shift Tracker</h2><button type="button" class="dfa-close" id="dfa-close">✕</button></div>'+
 '<p class="dfa-note">GPS tracking is experimental in this installed web app. Locking the phone or switching apps can interrupt it. Partial mileage is never treated as a complete trip. Use your odometer to verify totals.</p>'+
 (a?'<div class="dfa-status">Shift active · '+(a.driver==='brother'?'Brother':'You')+'<br><strong id="dfa-live-miles">'+a.miles.toFixed(1)+' miles tracked</strong><br><span id="dfa-gps-note">'+(a.incomplete?'GPS coverage interrupted':'Keep app open for GPS tracking')+'</span></div><label>Earnings this shift (£)<input id="dfa-earnings" type="number" min="0" step=".01" value="0"></label><label>Odometer miles driven (optional; recommended)<input id="dfa-odo" type="number" min="0" step=".1" placeholder="Actual miles from dashboard"></label><button class="dfa-main" id="dfa-end">End Shift & Save</button>':
 '<label>Driver<select id="dfa-driver"><option value="me">My vehicle</option><option value="brother">Brother\'s vehicle</option></select></label><button class="dfa-main" id="dfa-start">▶ Start Shift</button>')+
 '<h3>⛽ Add Fuel</h3><label>Vehicle<select id="dfa-fuel-driver"><option value="me">My vehicle</option><option value="brother">Brother\'s vehicle</option></select></label><label>Amount (£)<input id="dfa-fuel-amount" type="number" min=".01" step=".01" placeholder="60.00"></label><button class="dfa-main dfa-secondary" id="dfa-add-fuel">Save fuel expense</button>'+
 '<h3>Fuel records</h3>'+(fuel||'<p class="dfa-note">No fuel entries yet.</p>')+'<h3>Saved shifts</h3>'+(history||'<p class="dfa-note">No completed shifts yet.</p>')+
 '<p class="dfa-note">Shift and fuel records save to this device only. They do not yet change existing Money Pots or earnings totals, preventing double-counting.</p></section></div>';
}
function refresh(){
 const m=document.getElementById('dfa-live-miles'),n=document.getElementById('dfa-gps-note');
 if(m&&state.active)m.textContent=state.active.miles.toFixed(1)+' miles tracked';
 if(n&&state.active)n.textContent=state.active.incomplete?'GPS coverage interrupted — verify odometer':'GPS active while app is open';
}
function render(){
 if(!modal)return;
 modal.innerHTML=modalHtml();
 document.getElementById('dfa-close').onclick=close;
 document.getElementById('dfa-backdrop').onclick=e=>{if(e.target.id==='dfa-backdrop')close()};
 const startBtn=document.getElementById('dfa-start'),endBtn=document.getElementById('dfa-end');
 if(startBtn)startBtn.onclick=start;if(endBtn)endBtn.onclick=finish;
 document.getElementById('dfa-add-fuel').onclick=addFuel;
}
function open(){
 if(!modal){modal=document.createElement('div');document.body.appendChild(modal)}
 render();document.body.style.overflow='hidden';
 if(state.active&&watch===null){markGap();gps()}
}
function close(){if(modal){modal.remove();modal=null}document.body.style.overflow='';}
function addEntry(){
 const v=document.getElementById('view');if(!v||document.getElementById('dfa-entry'))return;
 const div=document.createElement('div');div.id='dfa-entry';div.className='card';
 div.innerHTML='<div class="title">Smart Shift & Fuel</div><p class="small">Track working hours, log fuel and estimate miles. GPS requires the app to stay open.</p><button class="btn" id="dfa-open">🚕 Start / View Shift</button>';
 v.appendChild(div);document.getElementById('dfa-open').onclick=open;
}
function init(){
 const style=document.createElement('style');style.textContent=`
 .dfa-backdrop{position:fixed;inset:0;z-index:10000;background:#020913d9;display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:15px 12px 35px}
 .dfa-panel{background:linear-gradient(145deg,#071a35,#071021);border:1px solid #308cde85;box-shadow:0 12px 54px #000b,0 0 30px #1d79d040;border-radius:23px;padding:22px;color:#f0f8ff;width:min(440px,100%);margin:auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
 .dfa-panel h2{font-size:21px;margin:0 0 12px}.dfa-panel h3{margin:23px 0 12px;color:#9edbff}.dfa-panel label{display:block;font-weight:650;font-size:13px;margin:13px 0}
 .dfa-panel input,.dfa-panel select{display:block;width:100%;padding:13px;border-radius:11px;border:1px solid #4079a4;background:#091f39;color:white;margin-top:7px;font-size:16px}
 .dfa-note{font-size:12px;line-height:1.55;color:#b1c7d7}.dfa-status{background:#0b3955;border:1px solid #1888a7;border-radius:14px;padding:15px;line-height:1.7}
 .dfa-status strong{font-size:24px;color:#59ebd3}.dfa-main{border:1px solid #54a4ef;background:linear-gradient(120deg,#157eea,#0558a8);padding:14px;border-radius:13px;font-weight:800;color:white;width:100%;font-size:15px;cursor:pointer}
 .dfa-secondary{background:linear-gradient(120deg,#087e80,#136950);border-color:#36bd9c}.dfa-close{border:0;color:white;background:#1b3955;border-radius:10px;font-size:17px;padding:8px 12px}
 .dfa-line{font-size:12px;line-height:1.5;padding:10px 0;border-bottom:1px solid #24455e}.dfa-line strong{color:#6ee8d0}
 `;document.head.appendChild(style);
 // Keep the original financial rendering and storage logic untouched.
 if(typeof window.show==='function'){
 const original=window.show;
 window.show=function(name){const result=original.apply(this,arguments);if(name==='home')addEntry();return result};
 }
 if(document.getElementById('view'))addEntry();
 if(state.active){state.active.incomplete=true;save()} // App may have been closed during an active shift.
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();