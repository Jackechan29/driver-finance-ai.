/* Driver Finance AI optional receipt OCR helper. No receipt image is sent to our server. */
(function(){
'use strict';
let running=false,loading=null;
const $=id=>document.getElementById(id);
function load(){
 if(window.Tesseract?.recognize)return Promise.resolve(window.Tesseract);
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  s.onload=()=>window.Tesseract?.recognize?resolve(window.Tesseract):reject(Error('OCR library did not initialize'));
  s.onerror=()=>reject(Error('OCR download failed; internet connection is needed for the first scan'));
  document.head.appendChild(s)
 }).catch(e=>{loading=null;throw e});
 return loading;
}
function amountFrom(text){
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const candidates=[];
 for(const line of lines){
  if(!(/(?:^|\b)(?:grand total|total paid|total due|amount paid|amount due|balance due|total)(?:\b|:)/i.test(line)))continue;
  if(/subtotal|sub-total|total vat|vat total/i.test(line))continue;
  const amounts=[...line.matchAll(/(?:£\s*)?(\d{1,5}[.,]\d{2})(?!\d)/g)];
  if(amounts.length!==1)continue;
  const value=Number(amounts[0][1].replace(',','.'));
  if(Number.isFinite(value)&&value<=99999)candidates.push({value,line});
 }
 const choices=[...new Set(candidates.map(c=>c.value.toFixed(2)))];
 if(choices.length!==1)return {value:null,reason:choices.length?'Multiple totals detected. Please select the correct amount.':'Total not clearly recognized.'};
 return {value:Number(choices[0]),reason:candidates[0].line};
}
function dateFrom(text){
 const found=text.match(/\b([0-3]?\d)[\/.\-]([01]?\d)[\/.\-](20\d{2}|\d{2})\b/);
 if(!found)return null;
 const d=+found[1],m=+found[2],y=found[3].length===2?2000+(+found[3]):+found[3],check=new Date(y,m-1,d);
 if(check.getDate()!==d||check.getMonth()!==m-1||check.getFullYear()!==y)return null;
 return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
async function scan(){
 if(running)return;
 const file=$('rv-photo')?.files?.[0],status=$('rv-ai-status'),button=$('rv-ai-scan');
 if(!file)return status.textContent='Select or photograph a receipt first.';
 if(!file.type.startsWith('image/'))return status.textContent='Choose an image to scan.';
 running=true;button.disabled=true;status.textContent='Loading receipt reader…';
 try{
  const ocr=await load();status.textContent='Reading text on this device — please wait…';
  const result=await ocr.recognize(file,'eng'),raw=result?.data?.text||'';
  if(!raw.trim())throw Error('Could not read text. Try a well-lit, sharp photo.');
  const total=amountFrom(raw),date=dateFrom(raw),amount=$('rv-amount');
  if(total.value!==null&&!amount.value)amount.value=total.value.toFixed(2);
  if(date)$('rv-date').value=date;
  const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const vendor=lines.find(x=>/[A-Za-z]{3}/.test(x)&&!/\b(receipt|invoice|date|total|cash|change|thank|vat|card)\b/i.test(x));
  if(vendor&&!$('rv-merchant').value)$('rv-merchant').value=vendor.slice(0,120);
  const panel=$('rv-ai-results');panel.replaceChildren();panel.hidden=false;
  const strong=document.createElement('strong');strong.textContent=total.value===null?'Total needs manual entry':'Possible total: £'+total.value.toFixed(2);
  const p=document.createElement('p');p.textContent=total.reason+'. Verify the amount, shop and date before saving.';
  const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');
  summary.textContent='View recognized text';pre.textContent=raw.slice(0,4000);pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto';details.append(summary,pre);
  panel.append(strong,p,details);status.textContent='Scan completed. Review fields, then save the receipt.';
 }catch(err){status.textContent='Scan unavailable: '+(err?.message||err)+'. Manual receipt saving still works.'}
 finally{running=false;button.disabled=false}
}
function attach(){
 const field=$('rv-photo');if(!field||$('rv-ai-scan'))return;
 const wrapper=document.createElement('section');wrapper.id='rv-ai-tools';wrapper.style.cssText='margin:12px 0;padding:13px;border:1px solid #237fa9;border-radius:13px;background:#0a2d49;color:#e2f7ff';
 const button=document.createElement('button');button.id='rv-ai-scan';button.type='button';button.textContent='✨ Read receipt automatically';button.style.cssText='width:100%;background:linear-gradient(120deg,#148de9,#0569b3);color:white;border:1px solid #39a9eb;border-radius:11px;font-weight:800;padding:13px';
 const message=document.createElement('p');message.id='rv-ai-status';message.style.cssText='font:12px/1.5 system-ui;color:#b9d7e9';message.textContent='Optional: requires internet to load OCR software. Image processing happens on your device. Please check the result.';
 const results=document.createElement('div');results.id='rv-ai-results';results.hidden=true;results.style.cssText='font:13px/1.5 system-ui;color:#e9fbff;overflow-wrap:anywhere';
 button.onclick=scan;
 field.addEventListener('change',()=>{message.textContent='Photo selected. Tap Read receipt automatically.';results.hidden=true});
 wrapper.append(button,message,results);
 field.closest('label')?.insertAdjacentElement('afterend',wrapper);
}
function init(){new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});attach()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();