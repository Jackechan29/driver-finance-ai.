(function(){
'use strict';
const original=window.show;
if(typeof original!=='function')return;
const $=id=>document.getElementById(id);
let current='home';
function btn(text,fn){const b=document.createElement('button');b.type='button';b.className='ux-button';b.textContent=text;b.onclick=fn;return b}
function openFeature(which){
 const target={shift:window.DFAOpenShift,guide:window.DFAOpenMoneyGuide,receipt:window.DFAOpenReceipts}[which];
 if(typeof target==='function'){target();return}
 const view=document.getElementById('view');
 if(view){
  const message=document.createElement('p');
  message.className='ux-note';message.textContent='This feature did not load. Please reopen the app when your shift is finished.';
  view.prepend(message);
 }
}

function buildNav(){
 const nav=document.querySelector('.nav');if(!nav)return;
 nav.replaceChildren();
 for(const [id,symbol,title] of [['home','⌂','Home'],['shift','◉','Shift'],['planner','◇','Planner'],['records','▤','Records'],['settings','⚙','Settings']]){
  const b=document.createElement('button');b.type='button';b.id=({home:'navhome',planner:'navpots',records:'navrecords',settings:'navsettings',shift:'navshift'})[id];b.className=current===id?'active':'';
  const i=document.createElement('span');i.textContent=symbol;b.append(i,document.createTextNode(title));b.onclick=()=>render(id);nav.append(b);
 }
}
function rentLine(){
 try{const d=JSON.parse(localStorage.getItem('dfa-smart-planner-v1')||'{}');const rent=Number(d.rent)||530,saved=Number(d.rentBalance)||0;return 'Next rent: £'+Math.max(0,rent-saved).toFixed(2)+' remaining'}catch(e){return 'Review your next rent target in Planner'}
}
function panel(title,description){
 const s=document.createElement('section');s.className='ux-panel';s.id='ux-panel';const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=description;s.append(h,p);$('view').prepend(s);return s
}
function render(name){
 current=name;original(name==='shift'||name==='planner'?'home':name);
 const view=$('view');if(!view)return;
 view.classList.remove('ux-home','ux-shift','ux-planner','ux-records','ux-settings');
 view.classList.add('ux-'+name);
 if(name==='home'){
  const box=document.createElement('section');box.className='ux-home-actions';box.id='ux-home-actions';
  const h=document.createElement('h3');h.textContent='Quick actions';
  const group=document.createElement('div');group.className='ux-group';
  group.append(btn('▶ Shift',()=>openFeature('shift')),btn('＋ Earnings',()=>original('review')),btn('▧ Receipt',()=>openFeature('receipt')));
  const hint=document.createElement('p');hint.className='ux-insight';hint.textContent=rentLine();
  box.append(h,group,hint);
  const safe=view.querySelector('.safe-card');if(safe)safe.insertAdjacentElement('afterend',box);else view.prepend(box);
 }
 if(name==='shift'){
  const s=panel('Shift & Mileage','Everything for your working day in one place.');
  const c=document.createElement('div');c.className='ux-feature';const h=document.createElement('h3');h.textContent='Smart Shift Tracker';
  const p=document.createElement('p');p.textContent='Live GPS status, mileage, working hours, fuel and completed shifts.';
  c.append(h,p,btn('Open Shift Tracker',()=>openFeature('shift')));s.append(c);
  const note=document.createElement('p');note.className='ux-note';note.textContent='GPS may miss miles while locked or in other apps. Check against your car trip meter.';s.append(note);
 }
 if(name==='planner'){
  const s=panel('Money Planner','Rent, savings and household bills.');
  const c=document.createElement('div');c.className='ux-feature';const h=document.createElement('h3');h.textContent=rentLine();
  const p=document.createElement('p');p.textContent='Only mark money as saved when you have genuinely set it aside.';
  c.append(h,p,btn('Open Money Guide',()=>openFeature('guide')));s.append(c);
  const d=document.createElement('div');d.className='ux-feature';const h2=document.createElement('h3');h2.textContent='Bills & Money Pots';
  d.append(h2,btn('Manage Bills',()=>{original('pots');$('view')?.classList.remove('ux-planner');current='planner';buildNav()}));s.append(d);
 }
 if(name==='records'){
  const s=document.createElement('section');s.className='ux-feature';s.id='ux-record-top';
  const h=document.createElement('h3');h.textContent='Receipts & Expenses';
  const group=document.createElement('div');group.className='ux-group';
  group.append(btn('Receipt Folder',()=>openFeature('receipt')),btn('Shift History',()=>openFeature('shift')));
  s.append(h,group);view.prepend(s);
  const obsolete=view.querySelector('.hint');if(obsolete&&obsolete.textContent.includes('Receipt scanning and accountant ZIP'))obsolete.remove()
 }
 buildNav();
}
window.show=function(name){
 if(name==='home'||name==='records'||name==='settings')return render(name);
 if(name==='pots'){original(name);$('view')?.classList.remove('ux-planner');current='planner';buildNav();return}
 return original.apply(this,arguments)
};
function init(){
 const css=[
 '.nav{z-index:9000!important;background:#061326!important;border-top:1px solid #285c83!important;padding:11px 3px max(15px,env(safe-area-inset-bottom))!important}',
 '.nav button{font-size:10px!important;flex:1!important;min-width:0!important;color:#a5bace!important}.nav button.active{color:#40c7ff!important}.nav span{font-size:21px!important}',
 '#view.ux-home>.actions,#view.ux-home>#dfa-entry,#view.ux-home>#sm-card,#view.ux-home>#rv-card{display:none!important}',
 '#view.ux-shift>:not(#ux-panel),#view.ux-planner>:not(#ux-panel){display:none!important}',
 '#view.ux-shift>#dfa-entry,#view.ux-shift>#sm-card,#view.ux-shift>#rv-card,#view.ux-planner>#dfa-entry,#view.ux-planner>#sm-card,#view.ux-planner>#rv-card{display:none!important}',
 '#view.ux-records>#dfa-entry,#view.ux-records>#sm-card,#view.ux-records>#rv-card{display:none!important}',
 '.ux-home-actions,.ux-feature{background:linear-gradient(130deg,#0a2a48,#061525);border:1px solid #227ec0;border-radius:18px;padding:16px;margin:16px 0;color:white}',
 '.ux-home-actions h3,.ux-feature h3{font:bold 18px system-ui;margin:0 0 12px}.ux-group{display:flex;gap:8px}',
 '.ux-button{flex:1;min-width:0;min-height:55px;border:1px solid #298fd0;border-radius:12px;background:linear-gradient(110deg,#106fbb,#0b3e75);color:white;font:700 13px system-ui;padding:12px 5px}',
 '.ux-insight,.ux-note{font:12px/1.6 system-ui;color:#a6d9d7;margin:13px 0 0}',
 '.ux-panel{min-height:50vh;padding:8px 0;color:white}.ux-panel h2{font:bold 24px system-ui;margin:8px 0}.ux-panel>p,.ux-feature>p{font:13px/1.6 system-ui;color:#b9cede}',
 '.ux-feature .ux-button{width:100%;font-size:15px}',
 '#dfa-mileage-banner{padding:7px 12px!important;font-size:12px!important;line-height:1.4!important}#dfa-mileage-banner>div:first-child{font-size:15px!important}',
 '#view.ux-home .footer{display:none!important}'
 ].join('\n');
 const style=document.createElement('style');style.textContent=css;document.head.append(style);render('home')
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();