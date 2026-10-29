/* ═══════════════════════════════════════════════════════
   HOD Beer Cost Calculator — single file, offline
   ═══════════════════════════════════════════════════════ */
const KEY='hodBeerCost_v1';
const DEF_SET={fx:35,adv:0.22,alc:430,lit:8,sup:17.5,mah:10,vat:7,incm:'no'};
const PACKS={bottle:{th:'ขวด',cls:'b',unit:'ขวด',cased:true},can:{th:'กระป๋อง',cls:'c',unit:'กระป๋อง',cased:true},keg:{th:'ถัง (Keg)',cls:'k',unit:'ถัง',cased:false}};
const TYPES={cif:'รวมใน CIF (ค่าเรือ/พิธีการ)',samui:'ขนส่งถึงสมุย',other:'ค่าใช้จ่ายอื่น'};
const SEED=[];   /* ข้อมูลอยู่บน Google Drive ไม่ฝังในไฟล์นี้ */

const SEED_VER=2;   // เพิ่มเลขนี้ทุกครั้งที่แก้ข้อมูลจาก Excel → เบราว์เซอร์จะอัปเดตชุดข้อมูลให้เอง
let DB={version:1,seedVer:SEED_VER,settings:{...DEF_SET},lots:[]};
let draft=null, cur=null, dScope='unit';

/* ── storage ── */
let STORE_OK=true;
(function(){try{localStorage.setItem('__t','1');localStorage.removeItem('__t')}catch(e){STORE_OK=false}})();
function storeWarn(){
  if(STORE_OK)return;
  const d=document.createElement('div'); d.className='note err';
  d.style.cssText='position:sticky;top:0;z-index:70;margin:0;border-radius:0';
  d.innerHTML='⚠️ <b>เบราว์เซอร์นี้บันทึกข้อมูลถาวรไม่ได้</b> — ข้อมูลจะหายเมื่อปิดหน้า. แนะนำเปิดไฟล์นี้ด้วย Chrome หรือ Edge, และกด Export สำรองไว้ทุกครั้ง';
  document.body.insertBefore(d,document.body.firstChild);
}
function load(){
  try{const r=localStorage.getItem(KEY); if(r){DB=JSON.parse(r); DB.settings={...DEF_SET,...(DB.settings||{})}; DB.lots=DB.lots||[];}}
  catch(e){console.warn('load fail',e)}
}
function saveLocal(){
  try{localStorage.setItem(KEY,JSON.stringify(DB)); flashSave('บันทึกแล้ว')}
  catch(e){flashSave('บันทึกไม่ได้!')}
}
function save(){ saveLocal(); try{cloudTouch()}catch(e){} }
function flashSave(t){const b=document.getElementById('saveInd'); b.textContent=t; b.style.color='var(--ok)'; setTimeout(()=>b.style.color='',1200)}
function quickSave(){save()}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const n=v=>{const x=parseFloat(v); return isFinite(x)?x:0};

/* ── number format ── */
function f(v,d){d=d===undefined?2:d; if(!isFinite(v))return '–'; return v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})}
function f0(v){return f(v,0)}
function pct(v){if(!isFinite(v))return '–'; return (v*100).toFixed(2)+'%'}
function sgn(v,d){const s=f(v,d); return '<span class="'+(v<0?'neg':'pos')+'">'+(v>0?'+':'')+s+'</span>'}

/* ═══════════ CALC ENGINE ═══════════ */
// ปริมาตรรวม (ลิตร) ของ SKU หนึ่ง
function itemLitres(it){
  const P=PACKS[it.pack]||PACKS.bottle;
  const u=P.cased?n(it.packQty)*(n(it.qtyPerCase)||1):n(it.packQty);
  return u*n(it.volumeL);
}
// สัดส่วนแบ่งค่าใช้จ่ายร่วมตามปริมาตร — รวมกันได้ 100% เสมอ
function volShares(lot){
  const L=(lot.items||[]).map(itemLitres);
  const t=L.reduce((a,b)=>a+b,0);
  if(t>0)return L.map(v=>v/t*100);
  const k=(lot.items||[]).length;
  return (lot.items||[]).map(()=>k?100/k:0);   // ยังไม่กรอกปริมาตร → แบ่งเท่ากัน
}
function isAuto(lot){return lot.autoShare!==false}
// % ที่ใช้จริงของ SKU นี้
function effShare(lot,it){
  if(!isAuto(lot))return n(it.sharePct);
  const items=lot.items||[];
  let i=items.indexOf(it);
  if(i<0&&it.id)i=items.findIndex(x=>x&&x.id===it.id);  // สำเนาของ SKU เดิม (เช่นตอนลองราคาขาย)
  if(i>=0)return volShares(lot)[i];
  const t=items.reduce((a,b)=>a+itemLitres(b),0)+itemLitres(it);  // SKU ใหม่ที่ยังไม่อยู่ในล็อต
  return t>0?itemLitres(it)/t*100:(items.length?0:100);
}
function calcItem(lot,it,S){
  S=S||DB.settings;
  const P=PACKS[it.pack]||PACKS.bottle;
  const fx=n(lot.fx)||n(S.fx);
  const qpc=P.cased?(n(it.qtyPerCase)||1):1;
  const packQty=n(it.packQty);
  const units=P.cased?packQty*qpc:packQty;
  const vol=n(it.volumeL), abv=n(it.abv);
  const litres=units*vol;

  // goods cost per unit
  const cpp=n(it.costPerPack);
  const goods=(it.costCur==='THB'?cpp:cpp*fx)/qpc;

  // shared allocation — auto ตามปริมาตร หรือกำหนดเอง
  const sharePctEff=effShare(lot,it);
  const share=sharePctEff/100;
  const pool=(lot.pool||[]), own=(it.costs||[]);
  const bucket=t=>pool.filter(x=>x.type===t).reduce((a,b)=>a+n(b.amount),0)*share
                 + own.filter(x=>x.type===t).reduce((a,b)=>a+n(b.amount),0);
  const cifPot=bucket('cif'), samuiPot=bucket('samui'), otherPot=bucket('other');
  const freight = units>0?cifPot/units:0;
  const samui   = units>0?samuiPot/units:0;
  const other   = units>0?otherPot/units:0;

  const cif=goods+freight;

  // taxes
  // ราคาแจ้งกรมฯ — กรอกเป็นต่อหน่วยหรือต่อลังก็ได้ ระบบหารลงหน่วยให้
  const declRaw = n(it.sellPrice);
  const sellUnit = (it.sellPriceB==='case'&&P.cased) ? declRaw/qpc : declRaw;
  const retail = it.retailPrice!==''&&it.retailPrice!=null&&n(it.retailPrice)>0 ? n(it.retailPrice) : sellUnit;
  const adv = retail*n(S.adv);
  const specA=(vol*abv*n(S.alc))/100;
  const specV=vol*n(S.lit);
  const excise=adv+Math.max(specA,specV);
  const support=excise*n(S.sup)/100;
  const mahad=excise*n(S.mah)/100;
  const incM=S.incm==='yes';

  const totalCost=cif+samui+other+excise+support+(incM?mahad:0);
  // ⚠️ sell = "ราคาแจ้งกรมสรรพสามิต / ราคาขายปลีกแนะนำ" ไม่ใช่ราคาขายจริง
  //    ดังนั้น profit ที่ได้คือ "ส่วนต่างจากราคาแจ้ง" (gap) ไม่ใช่กำไรจริง
  const sell=sellUnit;
  const profit=sell-totalCost;
  const vat=(goods+samui+excise+mahad)*n(S.vat)/100;

  return {P,fx,qpc,units,vol,abv,litres,goods,freight,samui,other,cif,sharePctEff,auto:isAuto(lot),
    retail,adv,specA,specV,excise,support,mahad,incM,
    totalCost,sell,profit,pctProfit:sell?profit/sell:NaN,
    declared:sell,gap:profit,pctGap:sell?profit/sell:NaN,
    taxTotal:excise+support,pctTax:sell?(excise+support)/sell:NaN,vat,
    label:(it.name||'(ไม่มีชื่อ)')+' · '+P.th};
}
/* ── กำไรจริง: ใช้สมมติฐานราคาขายจริงที่บันทึกไว้ในหน้า "คิดราคาขาย" ── */
function hasReal(it){return !!(it&&it.whatif&&n(it.whatif.price)>0)}
function realCalc(lot,it,r){
  if(!hasReal(it))return null;
  return whatIfCalc({lot,it,r:r||calcItem(lot,it)},it.whatif);
}
function scale(r,scope){
  const m = scope==='case' ? r.qpc : scope==='lot' ? r.units : 1;
  const o={};['goods','freight','samui','other','cif','excise','support','mahad','totalCost','sell','profit','vat','taxTotal'].forEach(k=>o[k]=r[k]*m);
  o.mult=m; return o;
}
function lotSummary(lot){
  let cost=0,sell=0,units=0,lit=0,tax=0;
  let rRev=0,rCost=0,rUnits=0,rN=0;                     // ส่วนที่มีราคาขายจริงบันทึกไว้
  (lot.items||[]).forEach(it=>{
    const r=calcItem(lot,it);
    cost+=r.totalCost*r.units; sell+=r.sell*r.units; units+=r.units; lit+=r.litres; tax+=r.taxTotal*r.units;
    const w=realCalc(lot,it,r);
    if(w){rN++; rUnits+=r.units; rRev+=w.netRev*r.units; rCost+=w.cost*r.units}
  });
  const nIt=(lot.items||[]).length;
  return {cost,sell,units,lit,tax,gap:sell-cost,pctGap:sell?(sell-cost)/sell:NaN,
    profit:sell-cost,pct:sell?(sell-cost)/sell:NaN,          // alias (เดิม)
    realN:rN,realAll:nIt>0&&rN===nIt,realUnits:rUnits,realRev:rRev,realCost:rCost,
    realProfit:rRev-rCost,realPct:rRev?(rRev-rCost)/rRev:NaN};
}

/* ═══════════ NAV ═══════════ */
const PAGES=[['list','📋 รายการล็อต'],['edit','✎ กรอก / แก้ไข'],['detail','🔍 รายละเอียด'],['comp','📊 เปรียบเทียบ'],['chart','📈 กราฟ'],['price','💰 คิดราคาขาย'],['set','⚙️ ตั้งค่า']];
function buildNav(){
  document.getElementById('nav').innerHTML=PAGES.filter(p=>p[0]!=='detail').map(p=>`<button data-p="${p[0]}" onclick="go('${p[0]}')">${p[1]}</button>`).join('');
}
function go(p){
  document.querySelectorAll('.page').forEach(e=>e.classList.remove('on'));
  document.getElementById('p-'+p).classList.add('on');
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
  document.getElementById('fab').style.display=(p==='list')?'block':'none';
  window.scrollTo(0,0);
  if(p==='list')renderList();
  if(p==='comp')renderComp();
  if(p==='chart')renderChart();
  if(p==='price')pkLoad();
  if(p==='set')fillSettings();
}

/* ═══════════ LIST ═══════════ */
function renderList(){
  const q=(document.getElementById('q').value||'').toLowerCase().trim();
  const [k,dir]=[document.getElementById('sortBy').value.slice(0,-1),document.getElementById('sortBy').value.slice(-1)];
  let L=DB.lots.slice();
  if(q)L=L.filter(l=>(l.name||'').toLowerCase().includes(q)||(l.items||[]).some(i=>(i.name||'').toLowerCase().includes(q))||(l.note||'').toLowerCase().includes(q));
  L.sort((a,b)=>{
    let x,y;
    if(k==='date'){x=a.date||'';y=b.date||''}
    else if(k==='name'){x=a.name||'';y=b.name||''}
    else {x=lotSummary(a).cost;y=lotSummary(b).cost}
    const c = x>y?1:x<y?-1:0; return dir==='+'?c:-c;
  });

  // KPIs
  const all=DB.lots.map(l=>lotSummary(l));
  const tc=all.reduce((a,b)=>a+b.cost,0), ts=all.reduce((a,b)=>a+b.sell,0), tt=all.reduce((a,b)=>a+b.tax,0);
  const rp=all.reduce((a,b)=>a+b.realProfit,0), rr=all.reduce((a,b)=>a+b.realRev,0), rn=all.reduce((a,b)=>a+b.realN,0);
  document.getElementById('listKpis').innerHTML=DB.lots.length?[
    ['ล็อตทั้งหมด',DB.lots.length+' ล็อต','',''],
    ['ต้นทุนจริงรวมสะสม',f0(tc)+' ฿','','ทุน+ภาษี ถึงสมุย'],
    ['มูลค่าตามราคาแจ้ง',f0(ts)+' ฿','','ราคาแจ้งกรมฯ × จำนวน'],
    ['ภาษีรวมสะสม',f0(tt)+' ฿','',ts?((tt/ts)*100).toFixed(1)+'% ของราคาแจ้ง':''],
    ['ส่วนต่างราคาแจ้ง − ต้นทุน',(ts-tc>=0?'+':'')+f0(ts-tc)+' ฿',(ts-tc>=0?'pos':'neg'),ts?pct((ts-tc)/ts):''],
    ...(rn?[['กำไรจริงสะสม',(rp>=0?'+':'')+f0(rp)+' ฿',(rp>=0?'pos':'neg'),rr?pct(rp/rr)+' · '+rn+' SKU':'']]:[])
  ].map(k=>`<div class="kpi"><span>${k[0]}</span><b class="${k[2]}">${k[1]}</b><small>${k[3]}</small></div>`).join(''):'';

  const box=document.getElementById('lotList');
  if(!L.length){
    box.innerHTML=`<div class="empty"><b>${DB.lots.length?'ไม่พบล็อตที่ค้นหา':'ยังไม่มีข้อมูลล็อต'}</b>
      ${DB.lots.length?'ลองเปลี่ยนคำค้น':'กด "+ ล็อตใหม่" เพื่อเริ่ม หรือไปที่ ⚙️ ตั้งค่า → โหลดข้อมูลจาก Excel เดิม'}</div>`;
    return;
  }
  box.innerHTML=L.map(l=>{
    const s=lotSummary(l);
    const chips=(l.items||[]).map(i=>{const P=PACKS[i.pack]||PACKS.bottle;return `<span class="pill ${P.cls}">${i.name||'?'} · ${P.th}</span>`}).join(' ');
    return `<div class="lot" onclick="openLot('${l.id}')">
      <div class="lh">
        <div><div class="ln">${esc(l.name||'(ไม่มีชื่อ)')}</div>
        <div class="ld">${l.date||'ไม่ระบุวันที่'} · เรท ${f(n(l.fx)||n(DB.settings.fx),2)} ฿/USD · ${(l.items||[]).length} SKU</div></div>
        <div style="text-align:right"><b style="font-size:16px">${f0(s.cost)} ฿</b><div class="ld">ต้นทุนรวมล็อต</div></div>
      </div>
      <div style="margin-top:8px">${chips}</div>
      <div class="lst">
        <div><span>มูลค่าตามราคาแจ้ง</span><b>${f0(s.sell)} ฿</b></div>
        <div><span>ส่วนต่าง (แจ้ง−ทุน)</span><b class="${s.gap>=0?'pos':'neg'}">${(s.gap>=0?'+':'')+f0(s.gap)} ฿</b></div>
        <div><span>% ส่วนต่าง</span><b class="${s.gap>=0?'pos':'neg'}">${pct(s.pctGap)}</b></div>
        ${s.realN?`<div><span>กำไรจริง${s.realAll?'':' ('+s.realN+'/'+(l.items||[]).length+' SKU)'}</span><b class="${s.realProfit>=0?'pos':'neg'}">${(s.realProfit>=0?'+':'')+f0(s.realProfit)} ฿</b></div>`:''}
        <div><span>ภาษีรวม</span><b>${f0(s.tax)} ฿</b></div>
        <div><span>ปริมาตร</span><b>${f0(s.lit)} L</b></div>
      </div>
      ${l.note?`<div class="ld" style="margin-top:7px">📝 ${esc(l.note)}</div>`:''}
    </div>`;
  }).join('');
}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

/* ═══════════ EDIT ═══════════ */
function blankItem(){return {id:uid(),name:'',pack:'bottle',volumeL:0.33,abv:4.9,qtyPerCase:24,packQty:'',costCur:'USD',costPerPack:'',sharePct:100,sellPrice:'',sellPriceB:'unit',retailPrice:'',costs:[]}}
function blankLot(){return {id:uid(),name:'',date:new Date().toISOString().slice(0,10),fx:DB.settings.fx,yieldL:'',note:'',autoShare:true,
  pool:[{id:uid(),label:'ค่าเรือ (Freight)',amount:'',type:'cif'},{id:uid(),label:'ค่าพิธีการ/ขนส่งต้นทาง (Ship)',amount:'',type:'cif'},{id:uid(),label:'ค่าขนส่งถึงสมุย',amount:'',type:'samui'}],
  items:[blankItem()]}}
function newLot(){draft=blankLot(); fillEdit(); go('edit')}
function editLot(id){const l=DB.lots.find(x=>x.id===id); if(!l)return; draft=JSON.parse(JSON.stringify(l)); if(!draft.pool)draft.pool=[]; fillEdit(); go('edit')}
function fillEdit(){
  document.getElementById('editTitle').textContent=DB.lots.some(x=>x.id===draft.id)?'แก้ไขล็อต: '+(draft.name||''):'ล็อตใหม่';
  ['name','date','fx','yield','note'].forEach(k=>{const el=document.getElementById('f_'+k); el.value=draft[k==='yield'?'yieldL':k]??''});
  ['f_name','f_date','f_fx','f_yield','f_note'].forEach(id=>{const el=document.getElementById(id); el.oninput=()=>{const k=id.slice(2); draft[k==='yield'?'yieldL':k]=el.value; renderLive()}});
  document.getElementById('f_auto').value=isAuto(draft)?'auto':'man';
  renderPool(); renderItems(); renderLive();
}
function setAuto(v){draft.autoShare=(v==='auto'); renderItems(); renderLive()}
function renderPool(){
  document.getElementById('poolRows').innerHTML=(draft.pool||[]).map((p,i)=>`
    <div class="crow">
      <input value="${esc(p.label)}" oninput="draft.pool[${i}].label=this.value" placeholder="ชื่อรายการ">
      <input type="number" step="0.01" value="${p.amount??''}" oninput="draft.pool[${i}].amount=this.value;renderLive()" placeholder="0.00">
      <select onchange="draft.pool[${i}].type=this.value;renderLive()">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${p.type===k?'selected':''}>${v}</option>`).join('')}</select>
      <button class="xb" onclick="draft.pool.splice(${i},1);renderPool();renderLive()">✕</button>
    </div>`).join('') || '<p class="hint">ยังไม่มีค่าใช้จ่ายร่วม</p>';
}
function addPool(){draft.pool.push({id:uid(),label:'',amount:'',type:'other'}); renderPool()}
function addItem(){draft.items.push(blankItem()); renderItems(); renderLive()}
function renderItems(){
  document.getElementById('itemRows').innerHTML=draft.items.map((it,i)=>{
    const P=PACKS[it.pack]||PACKS.bottle;
    return `<div class="item">
      <div class="ih"><b>SKU ${i+1} <span class="pill ${P.cls}">${P.th}</span></b>
        <div class="row">
          <button class="gh sm" onclick="dupItem(${i})">⧉ ทำซ้ำ</button>
          ${draft.items.length>1?`<button class="dg" onclick="draft.items.splice(${i},1);renderItems();renderLive()">ลบ</button>`:''}
        </div></div>
      <div class="grid g4">
        <div><label>ชื่อสินค้า *</label><input value="${esc(it.name)}" oninput="U(${i},'name',this.value)" placeholder="Golden Ale"></div>
        <div><label>บรรจุภัณฑ์</label><select onchange="Upack(${i},this.value)">${Object.entries(PACKS).map(([k,v])=>`<option value="${k}" ${it.pack===k?'selected':''}>${v.th}</option>`).join('')}</select></div>
        <div><label>ปริมาตร/หน่วย (ลิตร)</label><input type="number" step="0.001" value="${it.volumeL??''}" oninput="U(${i},'volumeL',this.value)"></div>
        <div><label>ดีกรี ABV (%)</label><input type="number" step="0.1" value="${it.abv??''}" oninput="U(${i},'abv',this.value)"></div>

        ${P.cased?`<div><label>จำนวน/ลัง (${P.unit})</label><input type="number" step="1" value="${it.qtyPerCase??''}" oninput="U(${i},'qtyPerCase',this.value)"></div>`:''}
        <div><label>จำนวน${P.cased?'ลัง':'ถัง'}ในล็อต</label><input type="number" step="1" value="${it.packQty??''}" oninput="U(${i},'packQty',this.value)"></div>
        <div><label>สกุลเงินต้นทุน</label><select onchange="U(${i},'costCur',this.value)"><option value="USD" ${it.costCur==='USD'?'selected':''}>USD</option><option value="THB" ${it.costCur==='THB'?'selected':''}>THB</option></select></div>
        <div><label>ต้นทุนสินค้า/${P.cased?'ลัง':'ถัง'}</label><input type="number" step="0.01" value="${it.costPerPack??''}" oninput="U(${i},'costPerPack',this.value)"></div>

        <div><label>สัดส่วนค่าใช้จ่ายร่วม (%)</label>
          ${isAuto(draft)
            ? `<input value="${f(effShare(draft,it),2)}" readonly style="opacity:.75;cursor:not-allowed" title="คำนวณอัตโนมัติตามปริมาตร"><div class="hint">⚖ auto ตามลิตร</div>`
            : `<input type="number" step="0.01" value="${it.sharePct??''}" oninput="U(${i},'sharePct',this.value)">`}</div>
        <div><label>ราคาแจ้งกรมฯ (฿) *</label><input type="number" step="0.01" value="${it.sellPrice??''}" oninput="U(${i},'sellPrice',this.value)">
          <div class="hint">ราคาขายปลีกแนะนำที่แจ้งกรมสรรพสามิต ใช้เป็นฐานคิดภาษี <b>ไม่ใช่ราคาขายจริง</b></div></div>
        <div><label>ราคาแจ้งนี้ใส่เป็น…</label>
          ${P.cased
            ? `<select onchange="U(${i},'sellPriceB',this.value)"><option value="unit" ${it.sellPriceB!=='case'?'selected':''}>บาท / ${P.unit}</option><option value="case" ${it.sellPriceB==='case'?'selected':''}>บาท / ลัง (หารลงหน่วยให้)</option></select>`
            : `<input value="บาท / ถัง" readonly style="opacity:.7;cursor:not-allowed">`}
          <div class="hint" id="declInfo${i}"></div></div>
        <div><label>&nbsp;</label><div class="hint" id="miniCalc${i}"></div></div>
      </div>
      <div style="margin-top:10px">
        <label>ค่าใช้จ่ายเฉพาะ SKU นี้ (ยอดรวมทั้ง SKU, บาท)</label>
        <div id="icosts${i}">${(it.costs||[]).map((c,j)=>`
          <div class="crow">
            <input value="${esc(c.label)}" oninput="draft.items[${i}].costs[${j}].label=this.value" placeholder="ชื่อรายการ">
            <input type="number" step="0.01" value="${c.amount??''}" oninput="draft.items[${i}].costs[${j}].amount=this.value;renderLive()" placeholder="0.00">
            <select onchange="draft.items[${i}].costs[${j}].type=this.value;renderLive()">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${c.type===k?'selected':''}>${v}</option>`).join('')}</select>
            <button class="xb" onclick="draft.items[${i}].costs.splice(${j},1);renderItems();renderLive()">✕</button>
          </div>`).join('')}</div>
        <button class="gh sm" onclick="addICost(${i})">+ เพิ่มค่าใช้จ่ายเฉพาะ SKU</button>
      </div>
    </div>`;
  }).join('');
  updateShareSum();
}
function U(i,k,v){draft.items[i][k]=v; renderLive(); if(k==='sharePct')updateShareSum()}
function Upack(i,v){const it=draft.items[i]; it.pack=v;
  if(v==='keg'){if(n(it.volumeL)<1)it.volumeL=20}else{if(n(it.volumeL)>=1)it.volumeL=0.33; if(!n(it.qtyPerCase))it.qtyPerCase=24}
  renderItems(); renderLive()}
function dupItem(i){const c=JSON.parse(JSON.stringify(draft.items[i])); c.id=uid(); draft.items.splice(i+1,0,c); renderItems(); renderLive()}
function addICost(i){draft.items[i].costs=draft.items[i].costs||[]; draft.items[i].costs.push({id:uid(),label:'',amount:'',type:'other'}); renderItems()}
function updateShareSum(){
  const el=document.getElementById('shareSum'), inf=document.getElementById('shareInfo');
  const auto=isAuto(draft);
  const eff=draft.items.map(it=>effShare(draft,it));
  const s=eff.reduce((a,b)=>a+b,0);
  const detail=draft.items.map((it,i)=>`${esc(it.name||'SKU '+(i+1))} ${f(eff[i],2)}%`).join(' · ');
  if(el)el.innerHTML=auto
    ? '⚖ แบ่งอัตโนมัติตามปริมาตร — รวม <b style="color:var(--ok)">100.00%</b> เสมอ'
    : 'รวม % = <b style="color:'+(Math.abs(s-100)<0.01?'var(--ok)':'var(--warn)')+'">'+f(s,2)+'%</b>'+(Math.abs(s-100)<0.01?'':' ← ควรรวมได้ 100%');
  if(inf)inf.innerHTML=(auto?'สัดส่วนที่คำนวณได้: ':'สัดส่วนที่ใช้: ')+'<br><b style="color:var(--acc2)">'+detail+'</b>';
}
function autoShare(){
  const L=draft.items.map(itemLitres);
  const t=L.reduce((a,b)=>a+b,0); if(!t){alert('กรอกจำนวนและปริมาตรก่อน');return}
  draft.items.forEach((it,i)=>it.sharePct=+(L[i]/t*100).toFixed(4));
  draft.autoShare=false;
  document.getElementById('f_auto').value='man';
  renderItems(); renderLive();
}
function renderLive(){
  const rows=draft.items.map(it=>({it,r:calcItem(draft,it)}));
  rows.forEach((x,i)=>{
    const el=document.getElementById('miniCalc'+i);
    if(el)el.innerHTML=`${f0(x.r.units)} ${x.r.P.unit} · ${f0(x.r.litres)} L<br>ต้นทุน <b style="color:var(--acc2)">${f(x.r.totalCost,2)} ฿</b>/${x.r.P.unit}`;
    const dl=document.getElementById('declInfo'+i);
    if(dl)dl.innerHTML=x.r.declared?`= <b style="color:var(--acc2)">${f(x.r.declared,2)}</b> ฿/${x.r.P.unit}${x.r.P.cased?' · '+f(x.r.declared*x.r.qpc,2)+' ฿/ลัง':''}`:'';
  });
  document.getElementById('livePrev').innerHTML=rows.some(x=>x.r.units>0)?tblUnits(draft,'unit'):'<p class="hint">กรอกจำนวนและต้นทุนเพื่อดูผลคำนวณ</p>';
}
function saveLot(){
  if(!(draft.name||'').trim()){alert('กรุณาใส่ชื่อล็อต');return}
  if(!draft.items.length){alert('ต้องมีอย่างน้อย 1 SKU');return}
  const i=DB.lots.findIndex(x=>x.id===draft.id);
  if(i>=0)DB.lots[i]=draft; else DB.lots.push(draft);
  save(); openLot(draft.id);
}

/* ═══════════ DETAIL ═══════════ */
function openLot(id){
  cur=DB.lots.find(x=>x.id===id); if(!cur)return;
  const s=lotSummary(cur);
  document.getElementById('dTitle').textContent=cur.name||'(ไม่มีชื่อ)';
  document.getElementById('dSub').textContent=(cur.date||'ไม่ระบุวันที่')+' · เรท '+f(n(cur.fx)||n(DB.settings.fx),2)+' ฿/USD · '+f0(s.units)+' หน่วย · '+f0(s.lit)+' L';
  document.getElementById('dNote').innerHTML=cur.note?`<div class="note">📝 ${esc(cur.note)}</div>`:'';
  document.getElementById('dScope').innerHTML=[['unit','ต่อหน่วย'],['case','ต่อลัง'],['lot','ต่อล็อต (รวม)']]
    .map(x=>`<button class="${dScope===x[0]?'on':''}" onclick="dScope='${x[0]}';openLot('${id}')">${x[1]}</button>`).join('');
  const neg=(cur.items||[]).filter(it=>calcItem(cur,it).gap<0);
  document.getElementById('dBody').innerHTML=
    `<div class="note">ℹ️ <b>ราคาแจ้งกรมฯ ≠ ราคาขายจริง</b> — ตัวเลข "ราคาแจ้ง" ในหน้านี้คือราคาขายปลีกแนะนำที่ใช้เป็นฐานคิดภาษีสรรพสามิต
      ตัวเลขที่ได้จึงเป็น <b>ส่วนต่าง (ราคาแจ้ง − ต้นทุนจริง)</b> ไม่ใช่กำไร · อยากดูกำไรจริงให้ไปหน้า <b>💰 คิดราคาขาย</b> ใส่ราคาขายจริง + ค่าขนส่ง/คอมมิชชั่น แล้วกดบันทึกสมมติฐาน</div>`
    +(neg.length?`<div class="note err">⚠️ <b>ต้นทุนจริงสูงกว่าราคาแจ้ง</b> ${neg.length} รายการ: ${neg.map(x=>esc(x.name)+' ('+PACKS[x.pack].th+')').join(', ')} — ต้องขายสูงกว่าราคาแจ้งจึงจะมีกำไร ตรวจสอบว่าราคาแจ้งต่ำเกินไปหรือค่าใช้จ่ายในล็อตแบ่งถูกไหม</div>`:'')
    +kpiLot(s,cur)+tblUnits(cur,dScope)+realTbl(cur,dScope)+poolTbl(cur);
  go('detail');
}
function kpiLot(s,lot){
  const nIt=((lot&&lot.items)||[]).length;
  return `<div class="kpis">
    <div class="kpi"><span>ต้นทุนจริงรวมล็อต</span><b>${f0(s.cost)}</b><small>บาท (ทุน+ภาษี ถึงสมุย)</small></div>
    <div class="kpi"><span>มูลค่าตามราคาแจ้ง</span><b>${f0(s.sell)}</b><small>บาท (ฐานภาษี ไม่ใช่ยอดขาย)</small></div>
    <div class="kpi"><span>ส่วนต่าง (แจ้ง − ทุน)</span><b class="${s.gap>=0?'pos':'neg'}">${(s.gap>=0?'+':'')+f0(s.gap)}</b><small>${pct(s.pctGap)} ของราคาแจ้ง</small></div>
    ${s.realN?`<div class="kpi"><span>กำไรจริงรวม${s.realAll?'':' ('+s.realN+'/'+nIt+' SKU)'}</span><b class="${s.realProfit>=0?'pos':'neg'}">${(s.realProfit>=0?'+':'')+f0(s.realProfit)}</b><small>${pct(s.realPct)} · จากราคาขายจริงที่บันทึก</small></div>`:''}
    <div class="kpi"><span>ภาษีรวม</span><b>${f0(s.tax)}</b><small>${s.sell?pct(s.tax/s.sell):''} ของราคาแจ้ง</small></div>
    <div class="kpi"><span>ต้นทุน/ลิตร</span><b>${f(s.lit?s.cost/s.lit:0,2)}</b><small>บาท/L</small></div>
  </div>`;
}
const ROWS=[
  ['goods','ต้นทุนสินค้า (Ex-work)'],
  ['freight','ค่าเรือ + พิธีการ (แบ่งมา)'],
  ['cif','= CIF (ต้นทุน+ขนส่ง)',1],
  ['samui','ค่าขนส่งถึงสมุย'],
  ['other','ค่าใช้จ่ายอื่น'],
  ['excise','ภาษีสรรพสามิต'],
  ['support','เงินสนับสนุนกองทุน'],
  ['totalCost','● ต้นทุนจริงรวมทั้งหมด',2],
  ['sell','ราคาแจ้งกรมฯ (ฐานภาษี)'],
  ['profit','ส่วนต่าง (ราคาแจ้ง − ต้นทุน)',3],
  ['mahad','ภาษีมหาดไทย (แยก)'],
  ['vat','VAT (แยก)']
];