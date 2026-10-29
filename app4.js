
const canFS=()=>typeof window.showSaveFilePicker==='function';
async function saveToFile(){
  const txt=JSON.stringify(DB,null,2);
  if(!canFS()){exportJson();alert('เบราว์เซอร์นี้ยังเขียนทับไฟล์เดิมไม่ได้ — ดาวน์โหลดเป็นสำเนาให้แทน (แนะนำใช้ Chrome หรือ Edge)');return}
  try{
    if(!FH)FH=await window.showSaveFilePicker({suggestedName:'hod-beer-cost-data.json',
      types:[{description:'HOD Beer Cost data',accept:{'application/json':['.json']}}]});
    const w=await FH.createWritable(); await w.write(txt); await w.close();
    DB.lastBackup=Date.now(); save(); bkInfo(); flashSave('เขียนไฟล์แล้ว');
  }catch(e){if(e&&e.name==='AbortError')return; FH=null; alert('บันทึกไฟล์ไม่สำเร็จ: '+(e&&e.message||e)+'\nจะดาวน์โหลดเป็นสำเนาให้แทน'); exportJson()}
}
async function openFromFile(){
  if(typeof window.showOpenFilePicker!=='function'){document.getElementById('imp').click();return}
  try{
    const [h]=await window.showOpenFilePicker({types:[{description:'HOD Beer Cost data',accept:{'application/json':['.json']}}]});
    const txt=await (await h.getFile()).text();
    const d=JSON.parse(String(txt).replace(/^﻿/,'')); if(!d.lots)throw new Error('ไฟล์ไม่ใช่ข้อมูลของแอปนี้');
    if(!confirm('โหลด '+d.lots.length+' ล็อตจากไฟล์นี้ แทนที่ข้อมูลที่มีอยู่?'))return;
    DB=d; DB.settings={...DEF_SET,...(d.settings||{})}; FH=h; COMPSEL=null; CHSEL=null;
    const m=migrateSeed(); save(); dsInfo(); bkInfo(); renderList(); go('list');
    alert('โหลดข้อมูลจากไฟล์แล้ว — กด 💾 เพื่อเขียนทับไฟล์นี้ครั้งต่อไป'+(m?'\nอัปเดตชุดข้อมูล Excel เป็นชุดใหม่ให้แล้ว ('+m.removed+' → '+m.added+' ล็อต)':''));
  }catch(e){if(e&&e.name==='AbortError')return; alert('เปิดไฟล์ไม่ได้: '+(e&&e.message||e))}
}
function dsInfo(){
  const el=document.getElementById('dsNote'); if(!el)return;
  const seeded=DB.lots.filter(isSeedLot), mine=DB.lots.filter(l=>!isSeedLot(l));
  const sku=l=>(l.items||[]).length;
  el.className='note ok';
  el.innerHTML='📦 <b>ชุดข้อมูลจาก Excel (v'+SEED_VER+'):</b> '+seeded.length+' ล็อต / '
    +seeded.reduce((a,l)=>a+sku(l),0)+' SKU'
    +(mine.length?' &nbsp;·&nbsp; <b>ล็อตที่คุณสร้างเอง:</b> '+mine.length+' ล็อต / '+mine.reduce((a,l)=>a+sku(l),0)+' SKU':'')
    +' &nbsp;·&nbsp; <b>รวมทั้งหมด '+DB.lots.length+' ล็อต</b>'
    +(seeded.length!==SEED.length?' <span style="color:var(--warn)">⚠️ ชุด Excel ในไฟล์นี้มี '+SEED.length+' ล็อต — กด ↺ เพื่อโหลดทับ</span>':'');
}
function bkInfo(){
  const el=document.getElementById('bkNote'); if(!el)return;
  const t=DB.lastBackup;
  if(!t){el.className='note';el.innerHTML='⚠️ <b>ยังไม่เคยสำรองข้อมูลลงไฟล์</b> — ข้อมูลอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น ถ้าล้าง cache หรือย้ายเครื่องจะหาย กด 💾 เพื่อบันทึกลงไฟล์';return}
  const days=(Date.now()-t)/86400000;
  el.className=days>7?'note':'note ok';
  el.innerHTML=(days>7?'⚠️ ':'✅ ')+'สำรองล่าสุด: <b>'+new Date(t).toLocaleString('th-TH')+'</b>'
    +(days>7?' — นานกว่า '+Math.floor(days)+' วันแล้ว ควรกด 💾 อีกครั้ง':'')
    +(FH?' · ไฟล์ที่ผูกไว้: <b>'+esc(FH.name)+'</b>':'');
}
function importJson(inp){const f2=inp.files[0];if(!f2)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(String(r.result).replace(/^﻿/,''));if(!d.lots)throw 0;
  if(confirm('นำเข้า '+d.lots.length+' ล็อต — เลือก OK = แทนที่ทั้งหมด / Cancel = เพิ่มต่อท้าย')){DB=d;DB.settings={...DEF_SET,...(d.settings||{})}}
  else{d.lots.forEach(l=>{l.id=uid();DB.lots.push(l)}); DB.seedVer=d.seedVer===SEED_VER?DB.seedVer:d.seedVer}
  COMPSEL=null;CHSEL=null;const m=migrateSeed();save();renderList();go('list');
  alert('นำเข้าสำเร็จ'+(m?'\nอัปเดตชุดข้อมูล Excel เป็นชุดใหม่ให้แล้ว ('+m.removed+' → '+m.added+' ล็อต)':''))}catch(e){alert('ไฟล์ไม่ถูกต้อง')}};r.readAsText(f2);inp.value=''}
function csvRow(a){return a.map(v=>{const s=String(v==null?'':v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}).join(',')}
function exportAllCsv(){
  const H=['ล็อต','วันที่','สินค้า','บรรจุ','ปริมาตร L','ABV','จำนวนหน่วย','เรท','ต้นทุนสินค้า','เรือ+พิธีการ','CIF','ขนส่งสมุย','อื่นๆ','สรรพสามิต','กองทุน','ต้นทุนจริงรวม','ราคาแจ้งกรมฯ','ส่วนต่าง(แจ้ง-ทุน)','%ส่วนต่าง','ภาษีมหาดไทย','VAT','ต้นทุนจริงรวมทั้งล็อต','ราคาขายจริง','กำไรจริง/หน่วย','%กำไรจริง','กำไรจริงทั้งล็อต'];
  const L=[csvRow(H)];
  allSkus().forEach(x=>{const r=x.r,w=realCalc(x.lot,x.it,r);
    L.push(csvRow([x.lot.name,x.lot.date,x.it.name,r.P.th,r.vol,r.abv,r.units,r.fx,
    r.goods.toFixed(4),r.freight.toFixed(4),r.cif.toFixed(4),r.samui.toFixed(4),r.other.toFixed(4),r.excise.toFixed(4),r.support.toFixed(4),
    r.totalCost.toFixed(4),r.declared,r.gap.toFixed(4),(r.pctGap*100).toFixed(2),r.mahad.toFixed(4),r.vat.toFixed(4),(r.totalCost*r.units).toFixed(2),
    w?w.price.toFixed(2):'',w?w.profit.toFixed(4):'',w?(w.pct*100).toFixed(2):'',w?(w.profit*r.units).toFixed(2):'']))});
  dl('hod-cost-all.csv',L.join('\n'),'text/csv;charset=utf-8');
}
function exportLotCsv(id){const l=DB.lots.find(x=>x.id===id);if(!l)return;
  const its=l.items||[];const R=its.map(it=>calcItem(l,it));
  const L=[csvRow(['ล็อต',l.name,'วันที่',l.date,'เรท',l.fx])];
  L.push(csvRow(['รายการ (บาท/หน่วย)',...its.map((it,i)=>it.name+' '+R[i].P.th)]));
  ROWS.forEach(([k,lab])=>L.push(csvRow([lab.replace(/^[●=] ?/,''),...R.map(r=>r[k].toFixed(4))])));
  L.push(csvRow(['% ส่วนต่าง',...R.map(r=>(r.pctGap*100).toFixed(2))]));
  L.push(csvRow(['จำนวนหน่วย',...R.map(r=>r.units)]));
  L.push(csvRow(['ต้นทุนจริงรวมทั้งล็อต',...R.map(r=>(r.totalCost*r.units).toFixed(2))]));
  const WW=its.map(it=>realCalc(l,it));
  if(WW.some(Boolean)){
    L.push(csvRow(['ราคาขายจริง',...WW.map(w=>w?w.price.toFixed(2):'')]));
    L.push(csvRow(['กำไรจริง/หน่วย',...WW.map(w=>w?w.profit.toFixed(4):'')]));
    L.push(csvRow(['% กำไรจริง',...WW.map(w=>w?(w.pct*100).toFixed(2):'')]));
    L.push(csvRow(['กำไรจริงทั้งล็อต',...WW.map((w,i)=>w?(w.profit*R[i].units).toFixed(2):'')]));
  }
  dl('cost-'+(l.name||'lot').replace(/[^\w฀-๿-]+/g,'_')+'.csv',L.join('\n'),'text/csv;charset=utf-8');
}
function wipe(){if(confirm('ลบข้อมูลทั้งหมดถาวร? แนะนำ export สำรองก่อน'))if(confirm('ยืนยันอีกครั้ง — ลบทุกล็อต?')){DB={version:1,seedVer:SEED_VER,settings:{...DEF_SET},lots:[]};COMPSEL=null;CHSEL=null;save();renderList();go('list')}}
/* ── ชุดข้อมูลจาก Excel: สร้างใหม่ + ตรวจเวอร์ชัน ── */
function freshSeed(){
  const s=JSON.parse(JSON.stringify(SEED));
  s.forEach(l=>{l.id=uid(); l.src='excel'; l.seedVer=SEED_VER;
    (l.items||[]).forEach(i=>i.id=uid()); (l.pool||[]).forEach(p=>p.id=uid())});
  return s;
}
// ล็อตที่มาจาก Excel (v1 ยังไม่มี flag → ดูจากโน้ต)
function isSeedLot(l){return l&&(l.src==='excel'||/^จาก Samui Cost/.test(String(l.note||'')))}
const batchKey=l=>{const m=String((l&&l.name)||'').match(/Batch\s*(\d+)\s*(·\s*IPA)?/i); return m?('b'+m[1]+(m[2]?'ipa':'')):''};
function migrateSeed(){
  if(!SEED.length)return null;            /* เวอร์ชันคลาวด์: ข้อมูลมาจาก Drive */
  if(DB.seedVer===SEED_VER)return null;
  const old=DB.lots.filter(isSeedLot), mine=DB.lots.filter(l=>!isSeedLot(l));
  DB.seedVer=SEED_VER;
  if(!old.length){save(); return null}
  // เก็บสมมติฐานราคาขายจริงที่ผู้ใช้กรอกไว้ ให้ย้ายมาชุดใหม่
  const wf={};
  old.forEach(l=>(l.items||[]).forEach(i=>{if(i.whatif)wf[batchKey(l)+'|'+i.name+'|'+i.pack]=i.whatif}));
  const fresh=freshSeed();
  let moved=0;
  fresh.forEach(l=>(l.items||[]).forEach(i=>{const k=batchKey(l)+'|'+i.name+'|'+i.pack;
    if(wf[k]){i.whatif=wf[k]; moved++}}));
  DB.lots=fresh.concat(mine);
  COMPSEL=null;CHSEL=null; save();
  return {removed:old.length,added:fresh.length,kept:mine.length,moved};
}
function seedBanner(m){
  if(!m)return;
  const d=document.createElement('div'); d.className='note ok';
  d.style.cssText='position:sticky;top:0;z-index:70;margin:0;border-radius:0;cursor:pointer';
  d.title='คลิกเพื่อปิด'; d.onclick=()=>d.remove();
  d.innerHTML='✅ <b>อัปเดตชุดข้อมูลจาก Excel เป็นชุดใหม่แล้ว</b> — แทนที่ '+m.removed+' ล็อตเดิมด้วย '+m.added+' ล็อต'
    +(m.kept?' · เก็บล็อตที่คุณสร้างเองไว้ '+m.kept+' ล็อต':'')
    +(m.moved?' · ย้ายสมมติฐานราคาขาย '+m.moved+' รายการมาให้':'')
    +' <span style="opacity:.7">(คลิกเพื่อปิด)</span>';
  document.body.insertBefore(d,document.body.firstChild);
}
function loadSeed(){
  if(!SEED.length){alert("เวอร์ชันคลาวด์ไม่ได้ฝังข้อมูลไว้ในไฟล์\nถ้าต้องการดึงข้อมูลล่าสุด กดปุ่ม ⟳ ซิงก์ ด้านบน");return}
  const mine=DB.lots.filter(l=>!isSeedLot(l));
  const seeded=DB.lots.filter(isSeedLot);
  const msg=seeded.length
    ? 'แทนที่ข้อมูลจาก Excel ที่มีอยู่ '+seeded.length+' ล็อต ด้วยชุดใหม่ '+SEED.length+' ล็อต?'
      +(mine.length?'\n(ล็อตที่คุณสร้างเอง '+mine.length+' ล็อต จะไม่ถูกแตะ)':'')
    : 'โหลดข้อมูลจาก Excel '+SEED.length+' ล็อต?';
  if(!confirm(msg))return;
  DB.lots=freshSeed().concat(mine);
  DB.seedVer=SEED_VER;
  COMPSEL=null;CHSEL=null;save();renderList();go('list');
  alert('โหลดชุดข้อมูลจาก Excel แล้ว: '+SEED.length+' ล็อต / '+SEED.reduce((a,l)=>a+l.items.length,0)+' SKU');
}

/* ═══════════════════════════════════════════════════════════════
   CLOUD — ล็อกอินด้วย PIN (ฐานเดียวกับ King Group ACC) + ซิงก์ Google Drive
   ทำงานแบบ offline-first: ข้อมูลอยู่ในเครื่องเป็นหลัก มีเน็ตเมื่อไหร่ค่อยซิงก์
   ═══════════════════════════════════════════════════════════════ */
const API_URL   = 'https://script.google.com/macros/s/AKfycbxrMGG3a7ac8gBVWgd8iLyPqM4qldlql77qrxPb3-rXOdx4SSQXJhe5nJo9TJorU8UD5w/exec';          // ← ใส่ลิงก์ /exec ของ Apps Script หลัง deploy
const CRED_KEY  = 'hodBeerCred_v1';       // ข้อมูลผู้ใช้ + แฮช PIN สำหรับปลดล็อกออฟไลน์
const TOK_KEY   = 'hodBeerTok_v1';        // token ของแอปนี้ (คนละตัวกับแอปอื่น)
const SYNC_KEY  = 'hodBeerSync_v1';       // จำสถานะซิงก์ไว้ข้ามการปิด/เปิดเว็บ
const PBKDF2_ITER = 250000;

let ME = null, TOKEN = null;
let CLOUD = { rev: 0, updatedAt: '', by: '', dirty: false, busy: false, err: '', last: 0 };
let pushTimer = null;

/* จำ rev + สถานะ "ยังไม่ได้ซิงก์" ลงเครื่อง — สำคัญมาก ไม่งั้นแก้ตอนออฟไลน์แล้วปิดเว็บ
   พอเปิดใหม่ระบบจะนึกว่าไม่มีอะไรค้าง แล้วดึงของคลาวด์มาทับของที่แก้ไว้ */
function loadSync() {
  try {
    const s = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null');
    if (s) { CLOUD.rev = s.rev || 0; CLOUD.updatedAt = s.updatedAt || ''; CLOUD.by = s.by || ''; CLOUD.dirty = !!s.dirty }
  } catch (e) {}
}
function saveSync() {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify({ rev: CLOUD.rev, updatedAt: CLOUD.updatedAt, by: CLOUD.by, dirty: CLOUD.dirty })) } catch (e) {}
}

const apiReady = () => API_URL && API_URL.slice(0, 2) !== '__';

async function cloudApi(fn, ...args) {
  if (!apiReady()) throw new Error('ยังไม่ได้ตั้งค่า API_URL ในไฟล์นี้');
  if (!navigator.onLine) throw new Error('OFFLINE');
  const r = await fetch(API_URL, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn, args }), redirect: 'follow'
  });
  if (!r.ok) throw new Error('เชื่อมต่อไม่ได้ (' + r.status + ')');
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'ผิดพลาด');
  return j.result;
}

/* ── แฮช PIN ไว้ในเครื่อง เพื่อปลดล็อกตอนไม่มีเน็ต ── */
const hasSubtle = () => !!(window.crypto && crypto.subtle && crypto.subtle.importKey);
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function pinHash(pin, saltB64) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: PBKDF2_ITER, hash: 'SHA-256' }, key, 256);
  return b64(bits);
}
function getCred() { try { return JSON.parse(localStorage.getItem(CRED_KEY) || 'null') } catch (e) { return null } }
async function setCred(user, pin) {
  const c = { id: user.id, name: user.name, role: user.role, at: Date.now() };
  if (hasSubtle()) {
    c.salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    c.hash = await pinHash(pin, c.salt);
  }
  try { localStorage.setItem(CRED_KEY, JSON.stringify(c)) } catch (e) {}
  ME = c;
}
function clearCred() {
  try { localStorage.removeItem(CRED_KEY); localStorage.removeItem(TOK_KEY) } catch (e) {}
  ME = null; TOKEN = null;
}

/* ── หน้าล็อกอิน ── */
function gateShow(html) {
  document.body.classList.add('locked');
  document.getElementById('gateBody').innerHTML = html;
}
function gateHide() { document.body.classList.remove('locked') }
function gateMsg(m, bad) {
  const el = document.getElementById('gMsg'); if (!el) return;
  el.className = 'gmsg ' + (bad ? 'bad' : '');
  el.textContent = m || '';
}
function gateBusy(on, m) {
  const b = document.getElementById('gBtn'); if (!b) return;
  b.disabled = !!on; b.textContent = on ? (m || 'กำลังตรวจสอบ…') : b.dataset.label;
}

/** โหมดออนไลน์: เลือกชื่อ + ใส่ PIN (ใช้ครั้งแรก หรือหลังออกจากระบบ) */
async function gateOnline(msg) {
  gateShow('<div class="gmsg" id="gMsg">กำลังโหลดรายชื่อ…</div>');
  if (!apiReady()) { gateMsg('ยังไม่ได้ตั้งค่า API_URL ในไฟล์นี้ — ดู README-deploy.md', true); return }
  try {
    const o = await cloudApi('loginOptions');
    if (!o.users.length) { gateMsg('ยังไม่มีผู้ใช้ที่มีสิทธิ์เข้าแอปนี้ (ต้องเป็นบทบาท "เจ้าของ")', true); return }
    const last = (getCred() || {}).id;
    gateShow(
      '<label>ชื่อผู้ใช้</label><select id="gUser">' +
      o.users.map(u => `<option value="${esc(u.id)}"${u.id === last ? ' selected' : ''}>${esc(u.name)} (${esc(u.role)})</option>`).join('') +
      '</select>' +
      '<label>PIN</label><input id="gPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="••••">' +
      `<div class="gmsg${msg ? ' bad' : ''}" id="gMsg">${esc(msg || '')}</div>` +
      '<button class="btn gfull" id="gBtn" data-label="เข้าใช้งาน" onclick="doLogin()">เข้าใช้งาน</button>');
    const p = document.getElementById('gPin');
    p.onkeydown = e => { if (e.key === 'Enter') doLogin() };
    p.focus();
  } catch (e) {
    gateShow('<div class="gmsg bad" id="gMsg">' + esc(e.message === 'OFFLINE' ? 'ไม่มีอินเทอร์เน็ต — การเข้าใช้ครั้งแรกต้องออนไลน์' : e.message) + '</div>' +
      '<button class="btn gfull" id="gBtn" data-label="ลองใหม่" onclick="gateOnline()">ลองใหม่</button>');
  }
}
async function doLogin() {
  const id = document.getElementById('gUser').value;
  const pin = document.getElementById('gPin').value.trim();
  if (!/^\d{4,6}$/.test(pin)) { gateMsg('PIN ต้องเป็นตัวเลข 4-6 หลัก', true); return }
  gateBusy(true);
  try {
    const r = await cloudApi('login', id, pin);
    TOKEN = r.token;
    try { localStorage.setItem(TOK_KEY, TOKEN) } catch (e) {}
    await setCred(r.user, pin);
    gateHide();
    await startApp(true);
  } catch (e) {
    gateBusy(false);
    gateMsg(e.message === 'OFFLINE' ? 'ไม่มีอินเทอร์เน็ต' : e.message, true);
  }
}

/** โหมดปลดล็อก: เคยเข้าแล้ว ใส่ PIN เดิม ใช้ได้แม้ไม่มีเน็ต */
function gateUnlock(msg) {
  const c = getCred();
  if (!c || !c.hash) return gateOnline(msg);
  gateShow(
    `<div class="ghi">สวัสดี <b>${esc(c.name)}</b></div>` +
    '<label>ใส่ PIN เพื่อเข้าใช้งาน</label>' +
    '<input id="gPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="••••">' +
    `<div class="gmsg${msg ? ' bad' : ''}" id="gMsg">${esc(msg || '')}</div>` +
    '<button class="btn gfull" id="gBtn" data-label="ปลดล็อก" onclick="doUnlock()">ปลดล็อก</button>' +
    '<button class="gh gfull" style="margin-top:8px" onclick="clearCred();gateOnline()">เข้าด้วยบัญชีอื่น</button>');
  const p = document.getElementById('gPin');
  p.onkeydown = e => { if (e.key === 'Enter') doUnlock() };
  p.focus();
}
async function doUnlock() {
  const c = getCred(), pin = document.getElementById('gPin').value.trim();
  gateBusy(true, 'กำลังตรวจ PIN…');
  try {
    const h = await pinHash(pin, c.salt);
    if (h !== c.hash) { gateBusy(false); gateMsg('PIN ไม่ถูกต้อง', true); return }
    ME = c; TOKEN = localStorage.getItem(TOK_KEY) || null;
    gateHide();
    await startApp(false);
    // มีเน็ต → ต่อ session ใหม่ด้วย PIN เดิม (ถ้า PIN ถูกเปลี่ยนที่แอปอื่น จะรู้ตรงนี้)
    if (navigator.onLine) {
      try {
        const r = await cloudApi('login', c.id, pin);
        TOKEN = r.token;
        try { localStorage.setItem(TOK_KEY, TOKEN) } catch (e) {}
        await setCred(r.user, pin);
        syncNow(true);
      } catch (e) {
        if (/PIN ไม่ถูกต้อง|ไม่มีสิทธิ์|ไม่พบผู้ใช้/.test(e.message)) {
          clearCred(); gateOnline('PIN ถูกเปลี่ยนที่แอปอื่น กรุณาเข้าใหม่');
        } else { CLOUD.err = e.message; syncChip() }
      }
    } else { CLOUD.err = 'ออฟไลน์'; syncChip() }
  } catch (e) { gateBusy(false); gateMsg(e.message, true) }
}
function doLogout() {
  if (CLOUD.dirty && !confirm('ยังมีการแก้ไขที่ยังไม่ได้ซิงก์ ออกจากระบบเลยไหม?')) return;
  if (TOKEN) cloudApi('logout', TOKEN).catch(() => {});
  clearCred();
  location.reload();
}

/* ── ซิงก์ ── */
function syncChip() {
  const el = document.getElementById('syncChip'); if (!el) return;
  let t = '', cls = '';
  if (!apiReady()) { t = '⚙️ ยังไม่ตั้งค่าคลาวด์'; cls = 'warn' }
  else if (CLOUD.busy) { t = '⏳ กำลังซิงก์…' }
  else if (!navigator.onLine) { t = CLOUD.dirty ? '⚠️ ออฟไลน์ · รอซิงก์' : '📴 ออฟไลน์'; cls = CLOUD.dirty ? 'warn' : '' }
  else if (CLOUD.err) { t = '⚠️ ' + CLOUD.err; cls = 'warn' }
  else if (CLOUD.dirty) { t = '… รอซิงก์'; cls = 'warn' }
  else t = '☁️ ซิงก์แล้ว' + (CLOUD.updatedAt ? ' · ' + CLOUD.updatedAt.slice(5, 16) : '');
  el.className = 'chip ' + cls;
  el.textContent = t;
  el.title = CLOUD.updatedAt ? ('บันทึกล่าสุดบนคลาวด์ ' + CLOUD.updatedAt + ' โดย ' + CLOUD.by + ' (rev ' + CLOUD.rev + ')') : '';
}
/** เรียกทุกครั้งที่ข้อมูลเปลี่ยน → ตั้งเวลาส่งขึ้นคลาวด์ */
function cloudTouch() {
  CLOUD.dirty = true; saveSync(); syncChip();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => syncPush(), 3000);
}
async function syncPull(replace) {
  const r = await cloudApi('beerLoad', TOKEN);
  CLOUD.rev = r.rev; CLOUD.updatedAt = r.updatedAt; CLOUD.by = r.by;
  if (r.data && replace) {
    DB = r.data;
    DB.settings = { ...DEF_SET, ...(DB.settings || {}) };
    DB.lots = DB.lots || [];
    COMPSEL = null; CHSEL = null;
    CLOUD.dirty = false;
    saveLocal();
    renderList();
  }
  saveSync();
  return r;
}
async function syncPush(force) {
  if (!TOKEN || CLOUD.busy) return;
  CLOUD.busy = true; CLOUD.err = ''; syncChip();
  try {
    const r = await cloudApi('beerSave', TOKEN, { baseRev: force ? -1 : CLOUD.rev, data: DB });
    if (r.conflict) {
      CLOUD.busy = false;
      return conflictBox(r);
    }
    CLOUD.rev = r.rev; CLOUD.updatedAt = r.updatedAt; CLOUD.by = r.by;
    CLOUD.dirty = false; CLOUD.last = Date.now(); saveSync();
  } catch (e) {
    if (e.message === 'SESSION_EXPIRED') { CLOUD.err = 'หมดเวลาใช้งาน'; gateUnlock('หมดเวลาใช้งาน กรุณาใส่ PIN ใหม่') }
    else CLOUD.err = e.message === 'OFFLINE' ? 'ออฟไลน์' : e.message;
  } finally { CLOUD.busy = false; syncChip() }
}
async function syncNow(silent) {
  if (!TOKEN) return;
  CLOUD.busy = true; CLOUD.err = ''; syncChip();
  try {
    const m = await cloudApi('beerMeta', TOKEN);
    CLOUD.busy = false;
    if (m.rev > CLOUD.rev && CLOUD.dirty) return conflictBox(m);
    if (m.rev > CLOUD.rev) { await syncPull(true); if (!silent) alert('ดึงข้อมูลใหม่จากคลาวด์แล้ว (rev ' + CLOUD.rev + ')') ; syncChip(); return }
    if (CLOUD.dirty) return syncPush();
    CLOUD.rev = m.rev; CLOUD.updatedAt = m.updatedAt; CLOUD.by = m.by;
    if (!silent) alert('ข้อมูลตรงกับคลาวด์อยู่แล้ว (rev ' + CLOUD.rev + ')');
  } catch (e) {
    if (e.message === 'SESSION_EXPIRED') { gateUnlock('หมดเวลาใช้งาน กรุณาใส่ PIN ใหม่') }
    else CLOUD.err = e.message === 'OFFLINE' ? 'ออฟไลน์' : e.message;
  } finally { CLOUD.busy = false; syncChip() }
}
function conflictBox(r) {
  CLOUD.err = 'ข้อมูลชนกัน';
  syncChip();
  const m = document.getElementById('modal');
  document.getElementById('modalBox').innerHTML =
    '<h3 style="color:var(--acc2)">⚠️ ข้อมูลบนคลาวด์ใหม่กว่าของในเครื่อง</h3>' +
    `<p class="hint">บนคลาวด์: rev ${r.rev} · แก้ล่าสุด ${esc(r.updatedAt || '-')} โดย ${esc(r.by || '-')}<br>` +
    `ในเครื่อง: อ้างอิง rev ${CLOUD.rev} และมีการแก้ที่ยังไม่ได้ส่งขึ้น</p>` +
    '<div class="row" style="margin-top:14px">' +
    '<button class="btn" onclick="resolveConflict(\'pull\')">ใช้ของบนคลาวด์ (ทิ้งที่แก้ในเครื่อง)</button>' +
    '<button class="gh" onclick="resolveConflict(\'push\')">ใช้ของในเครื่อง (ทับคลาวด์)</button>' +
    '<button class="gh" onclick="resolveConflict(\'later\')">ไว้ก่อน</button>' +
    '</div><p class="hint" style="margin-top:10px">แนะนำ: กด "ไว้ก่อน" แล้ว Export สำรองไว้ก่อนตัดสินใจ</p>';
  m.classList.add('on');
}
async function resolveConflict(how) {
  document.getElementById('modal').classList.remove('on');
  if (how === 'later') return;
  if (how === 'pull') { CLOUD.dirty = false; saveSync(); await syncPull(true); CLOUD.err = ''; syncChip(); alert('ดึงข้อมูลจากคลาวด์แล้ว') }
  if (how === 'push') { CLOUD.err = ''; await syncPush(true); alert('ส่งข้อมูลในเครื่องทับคลาวด์แล้ว') }
}

/* ── เปลี่ยน PIN (มีผลกับทุกแอปที่ใช้ฐานเดียวกัน) ── */
function openChangePin() {
  const m = document.getElementById('modal');
  document.getElementById('modalBox').innerHTML =
    '<h3 style="color:var(--acc2)">เปลี่ยน PIN</h3>' +
    '<p class="hint">PIN นี้ใช้ร่วมกับแอปอื่นในเครือ เปลี่ยนที่นี่มีผลทุกแอป</p>' +
    '<div class="grid g3" style="margin-top:10px">' +
    '<div><label>PIN เดิม</label><input id="cpOld" type="password" inputmode="numeric" maxlength="6"></div>' +
    '<div><label>PIN ใหม่</label><input id="cpNew" type="password" inputmode="numeric" maxlength="6"></div>' +
    '<div><label>PIN ใหม่ อีกครั้ง</label><input id="cpNew2" type="password" inputmode="numeric" maxlength="6"></div></div>' +
    '<div class="gmsg" id="cpMsg"></div>' +
    '<div class="row" style="margin-top:12px;justify-content:flex-end">' +
    '<button class="gh" onclick="document.getElementById(\'modal\').classList.remove(\'on\')">ยกเลิก</button>' +
    '<button class="btn" onclick="doChangePin()">บันทึก PIN ใหม่</button></div>';
  m.classList.add('on');
}
async function doChangePin() {
  const o = document.getElementById('cpOld').value.trim();
  const n = document.getElementById('cpNew').value.trim();
  const n2 = document.getElementById('cpNew2').value.trim();
  const msg = document.getElementById('cpMsg');
  const bad = t => { msg.className = 'gmsg bad'; msg.textContent = t };
  if (n !== n2) return bad('PIN ใหม่ 2 ช่องไม่ตรงกัน');
  if (!/^\d{4,6}$/.test(n)) return bad('PIN ต้องเป็นตัวเลข 4-6 หลัก');
  try {
    await cloudApi('changePin', TOKEN, o, n);
    await setCred(ME, n);
    document.getElementById('modal').classList.remove('on');
    alert('เปลี่ยน PIN แล้ว — ใช้ PIN ใหม่กับทุกแอป');
  } catch (e) { bad(e.message === 'OFFLINE' ? 'ต้องมีอินเทอร์เน็ตเพื่อเปลี่ยน PIN' : e.message) }
}

/* ── เริ่มแอปหลังผ่านด่าน PIN ── */
async function startApp(freshLogin) {
  buildNav(); storeWarn();
  const who = document.getElementById('whoChip');
  if (who && ME) who.textContent = '👤 ' + ME.name;
  syncChip();
  go('list');
  if (!TOKEN) return;
  try {
    const m = await cloudApi('beerMeta', TOKEN);
    const empty = !DB.lots.length;
    if (!m.hasData) {
      CLOUD.rev = m.rev; CLOUD.updatedAt = m.updatedAt; CLOUD.by = m.by; saveSync();
      if (!empty) cloudTouch();                       // คลาวด์ว่าง แต่ในเครื่องมีข้อมูล → อัปขึ้นให้
    } else if (freshLogin || empty) {
      await syncPull(true);                           // เข้าบัญชีใหม่ / เครื่องนี้ยังไม่มีข้อมูล → เอาของคลาวด์
    } else if (CLOUD.dirty) {
      if (m.rev > CLOUD.rev) conflictBox(m);          // ค้างไว้ตอนออฟไลน์ + คลาวด์ก็เปลี่ยน → ให้เลือกเอง
      else await syncPush();                          // ค้างไว้เฉยๆ → ส่งขึ้นให้
    } else if (m.rev !== CLOUD.rev) {
      await syncPull(true);                           // คลาวด์ใหม่กว่า และในเครื่องไม่มีอะไรค้าง
    } else {
      CLOUD.updatedAt = m.updatedAt; CLOUD.by = m.by; saveSync();
    }
  } catch (e) {
    if (e.message === 'SESSION_EXPIRED') { TOKEN = null; CLOUD.err = 'หมดเวลาใช้งาน' }
    else CLOUD.err = e.message === 'OFFLINE' ? 'ออฟไลน์' : e.message;
  }
  syncChip();
}
window.addEventListener('online', () => { syncChip(); if (CLOUD.dirty) syncPush() });
window.addEventListener('offline', syncChip);

/* ═══════════ BOOT ═══════════ */
load(); loadSync();
// เวอร์ชันคลาวด์: ต้องผ่านด่าน PIN ก่อน แล้วค่อยดึงข้อมูลจาก Google Drive
(function(){
  const c=getCred();
  if(c&&c.hash) gateUnlock(); else gateOnline();
})();
window.addEventListener('resize',()=>{if(document.getElementById('p-chart').classList.contains('on'))renderChart()});