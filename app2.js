
function tblUnits(lot,scope){
  const its=(lot.items||[]).filter(it=>calcItem(lot,it).units>0||n(it.costPerPack));
  if(!its.length)return '<p class="hint">ไม่มีข้อมูล</p>';
  const R=its.map(it=>({it,r:calcItem(lot,it),s:null}));
  R.forEach(x=>x.s=scale(x.r,scope));
  const head=R.map(x=>{const P=x.r.P; return `<th>${esc(x.it.name||'?')}<br><span class="pill ${P.cls}">${P.th}</span></th>`}).join('');
  const scopeTxt=scope==='unit'?'ต่อหน่วย':scope==='case'?'ต่อลัง':'ทั้งล็อต';
  let body='';
  ROWS.forEach(([k,lab,flag])=>{
    if(k==='other'&&R.every(x=>Math.abs(x.s.other)<0.005))return;
    const cls=flag===1?'sub':flag===2?'tot':'';
    body+=`<tr class="${cls}"><td>${lab}</td>`+R.map(x=>{
      const v=x.s[k];
      if(k==='profit')return `<td>${sgn(v,2)}</td>`;
      return `<td>${f(v,2)}</td>`;
    }).join('')+'</tr>';
  });
  // extra ratio rows
  body+=`<tr class="sub"><td>% ส่วนต่าง (จากราคาแจ้ง)</td>`+R.map(x=>`<td class="${x.r.gap>=0?'pos':'neg'}">${pct(x.r.pctGap)}</td>`).join('')+'</tr>';
  body+=`<tr class="sub"><td>% ภาษี / ราคาแจ้ง</td>`+R.map(x=>`<td>${pct(x.r.pctTax)}</td>`).join('')+'</tr>';
  body+=`<tr class="sub"><td>ต้นทุน / ลิตร</td>`+R.map(x=>`<td>${f(x.r.vol?x.r.totalCost/x.r.vol:0,2)}</td>`).join('')+'</tr>';
  body+=`<tr class="sub"><td>จำนวน${scope==='lot'?' (หน่วย)':''}</td>`+R.map(x=>`<td>${scope==='lot'?f0(x.r.units):scope==='case'?f0(x.r.qpc):'1'} ${x.r.P.unit}</td>`).join('')+'</tr>';
  body+=`<tr class="sub"><td>สัดส่วนค่าใช้จ่ายร่วม ${isAuto(lot)?'(⚖ auto)':'(✎ manual)'}</td>`+R.map(x=>`<td>${f(x.r.sharePctEff,2)}%</td>`).join('')+'</tr>';
  return `<div class="card"><h3>ตารางต้นทุน <span class="badge">${scopeTxt} · บาท</span></h3>
    <div class="tw"><table><thead><tr><th>รายการ</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
    ${scope==='case'&&R.some(x=>!x.r.P.cased)?'<p class="hint">* Keg ไม่มีหน่วยลัง — คอลัมน์ Keg แสดงค่าต่อถัง</p>':''}
    </div>`;
}
/* ตารางกำไรจริง — เฉพาะ SKU ที่บันทึกราคาขายจริงไว้ในหน้าคิดราคาขาย */
function realTbl(lot,scope){
  const R=(lot.items||[]).map(it=>{const r=calcItem(lot,it);return {it,r,w:realCalc(lot,it,r)}}).filter(x=>x.w);
  if(!R.length)return `<div class="card"><h3>กำไรจริง <span class="badge">ยังไม่มีข้อมูล</span></h3>
    <p class="hint">ยังไม่ได้บันทึกราคาขายจริงของ SKU ในล็อตนี้ — ไปหน้า <b>💰 คิดราคาขาย</b> เลือก SKU ใส่ราคาขายจริง ค่าขนส่ง ค่าคอมมิชชั่น แล้วกด <b>💾 บันทึกสมมติฐาน</b> ตัวเลขกำไรจริงจะขึ้นที่นี่</p></div>`;
  const M=x=>scope==='case'?(x.r.qpc||1):scope==='lot'?x.r.units:1;
  const head=R.map(x=>`<th>${esc(x.it.name||'?')}<br><span class="pill ${x.r.P.cls}">${x.r.P.th}</span></th>`).join('');
  const row=(lab,fn,cls,style)=>`<tr class="${style||''}"><td>${lab}</td>`+R.map(x=>{
    const v=fn(x)*M(x);
    return `<td class="${cls==='p'?(v>=0?'pos':'neg'):cls==='m'?'mut':''}">${cls==='p'?(v>0?'+':'')+f(v,2):f(v,2)}</td>`}).join('')+'</tr>';
  let b='';
  b+=row('ราคาขายจริง',x=>x.w.price);
  b+=row('(−/+) VAT 7%',x=>x.w.vatOut,'m');
  b+=row('= รายได้สุทธิ',x=>x.w.netRev,'','sub');
  b+=row('ต้นทุนจริงจากล็อต (ทุน+ภาษี)',x=>x.r.totalCost);
  b+=row('ค่าขนส่งไปส่งลูกค้า',x=>x.w.ship);
  b+=row('ค่าคอมมิชชั่น',x=>x.w.com);
  b+=row('ค่าใช้จ่ายอื่น',x=>x.w.extraT);
  b+=row('● ต้นทุนรวมขั้นสุดท้าย',x=>x.w.cost,'','tot');
  b+=row('กำไรจริง',x=>x.w.profit,'p','tot');
  b+=`<tr class="sub"><td>% กำไรจริง</td>`+R.map(x=>`<td class="${x.w.profit>=0?'pos':'neg'}">${pct(x.w.pct)}</td>`).join('')+'</tr>';
  b+=`<tr class="sub"><td>ส่วนต่างราคาขายจริง vs ราคาแจ้ง</td>`+R.map(x=>{const d=x.w.price-x.r.declared;
    return `<td class="${d>=0?'pos':'neg'}">${(d>0?'+':'')+f(d,2)}</td>`}).join('')+'</tr>';
  const scopeTxt=scope==='unit'?'ต่อหน่วย':scope==='case'?'ต่อลัง':'ทั้งล็อต';
  const miss=(lot.items||[]).length-R.length;
  return `<div class="card"><h3>กำไรจริง (จากราคาขายจริงที่บันทึก) <span class="badge">${scopeTxt} · บาท</span></h3>
    <div class="tw"><table><thead><tr><th>รายการ</th>${head}</tr></thead><tbody>${b}</tbody></table></div>
    ${miss>0?`<p class="hint">⚠️ ยังขาดราคาขายจริงอีก ${miss} SKU — ตัวเลขนี้ยังไม่ครบทั้งล็อต</p>`:''}</div>`;
}
function poolTbl(lot){
  const p=(lot.pool||[]).filter(x=>n(x.amount));
  const anyOwn=(lot.items||[]).some(i=>(i.costs||[]).some(c=>n(c.amount)));
  if(!p.length&&!anyOwn)return '';
  let rows=p.map(x=>`<tr><td>${esc(x.label||'-')}</td><td>${TYPES[x.type]}</td><td>${f(n(x.amount),2)}</td><td class="mut">pool</td></tr>`).join('');
  (lot.items||[]).forEach(i=>(i.costs||[]).forEach(c=>{if(n(c.amount))rows+=`<tr><td>${esc(c.label||'-')}</td><td>${TYPES[c.type]}</td><td>${f(n(c.amount),2)}</td><td class="mut">${esc(i.name)}</td></tr>`}));
  const tot=p.reduce((a,b)=>a+n(b.amount),0)+(lot.items||[]).reduce((a,i)=>a+(i.costs||[]).reduce((x,c)=>x+n(c.amount),0),0);
  const shares=(lot.items||[]).map(i=>`${esc(i.name)} (${(PACKS[i.pack]||PACKS.bottle).th}): <b>${f(effShare(lot,i),2)}%</b>`).join(' · ');
  return `<div class="card"><h3>ค่าใช้จ่ายที่กรอก</h3>
    <div class="tw"><table><thead><tr><th>รายการ</th><th>ประเภท</th><th>ยอด (฿)</th><th>ผูกกับ</th></tr></thead>
    <tbody>${rows}<tr class="tot"><td>รวม</td><td></td><td>${f(tot,2)}</td><td></td></tr></tbody></table></div>
    <p class="hint">${isAuto(lot)?'⚖ แบ่ง pool อัตโนมัติตามปริมาตร (ลิตร)':'✎ แบ่ง pool ตาม % ที่กำหนดเอง'} → ${shares}</p></div>`;
}

/* ═══════════ COMPARE ═══════════ */
function allSkus(){
  const out=[];
  DB.lots.forEach(l=>(l.items||[]).forEach(it=>{const r=calcItem(l,it); if(r.units>0||n(it.costPerPack))out.push({lot:l,it,r})}));
  return out;
}
const skuKey=x=>x.lot.id+'::'+(x.it.id||'');
let COMPSEL=null;                       // null = เลือกทั้งหมด (หน้าเปรียบเทียบ)
let compSort={k:'date',d:1};
function compCands(){
  const A=allSkus();
  const sel=document.getElementById('cProd'); const prods=[...new Set(A.map(x=>x.it.name||'?'))].sort();
  const keep=sel.value;
  sel.innerHTML='<option value="">ทั้งหมด</option>'+prods.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
  if(prods.includes(keep))sel.value=keep;
  const fp=sel.value, fk=document.getElementById('cPack').value;
  return A.filter(x=>(!fp||(x.it.name||'?')===fp)&&(!fk||x.it.pack===fk));
}
function isPicked(x){return COMPSEL===null||COMPSEL.has(skuKey(x))}
function ensureSel(C){if(COMPSEL===null){COMPSEL=new Set(C.map(skuKey))}}
function toggleSku(k){ensureSel(compCands()); COMPSEL.has(k)?COMPSEL.delete(k):COMPSEL.add(k); renderComp()}
function toggleLot(id){
  const C=compCands(); ensureSel(C);
  const ks=C.filter(x=>x.lot.id===id).map(skuKey);
  const allOn=ks.every(k=>COMPSEL.has(k));
  ks.forEach(k=>allOn?COMPSEL.delete(k):COMPSEL.add(k));
  renderComp();
}
function compAll(on){const C=compCands(); COMPSEL=new Set(on?C.map(skuKey):[]); renderComp()}
function compLatest(){
  const C=compCands();
  const lots=[...new Set(C.map(x=>x.lot.id))]
    .map(id=>C.find(x=>x.lot.id===id).lot)
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,2).map(l=>l.id);
  COMPSEL=new Set(C.filter(x=>lots.includes(x.lot.id)).map(skuKey));
  renderComp();
}
function compSortBy(k){compSort = compSort.k===k?{k,d:-compSort.d}:{k,d:(k==='date'||k==='lot')?1:-1}; renderComp()}
/* ── ตัวเลือกติ๊กเลือกล็อต/SKU (ใช้ร่วมกันทั้งหน้าเปรียบเทียบและกราฟ) ── */
function pickHTML(C,picked,fnLot,fnSku){
  const lots=[]; C.forEach(x=>{if(!lots.some(l=>l.id===x.lot.id))lots.push(x.lot)});
  lots.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  return lots.map(l=>{
    const its=C.filter(x=>x.lot.id===l.id);
    const onN=its.filter(picked).length;
    return `<div class="lotgrp">
      <div class="lg">
        <label class="pk ${onN===its.length?'on':''}" style="margin:0" onclick="event.preventDefault();${fnLot}('${l.id}')">
          <input type="checkbox" ${onN===its.length?'checked':''}><b>${esc(l.name)}</b></label>
        <span class="hint">${l.date||'ไม่ระบุวันที่'} · เลือก ${onN}/${its.length}</span>
      </div>
      <div class="picks">${its.map(x=>{const k=skuKey(x);
        return `<label class="pk ${picked(x)?'on':''}" onclick="event.preventDefault();${fnSku}('${k}')">
          <input type="checkbox" ${picked(x)?'checked':''}>${esc(x.it.name||'?')} · ${x.r.P.th}</label>`}).join('')}</div>
    </div>`;
  }).join('');
}
function renderPick(C){
  const box=document.getElementById('compPick');
  box.innerHTML=C.length?pickHTML(C,isPicked,'toggleLot','toggleSku'):'';
}
function compSet(){                                   // ชุดข้อมูลที่เลือก + เรียงแล้ว
  const C=compCands(), scope=document.getElementById('cScope').value;
  const S=C.filter(isPicked).map(x=>({...x,s:scale(x.r,scope)}));
  const {k,d}=compSort;
  S.sort((a,b)=>{
    let r;
    if(k==='date')r=String(a.lot.date||'').localeCompare(String(b.lot.date||''))||String(a.lot.name).localeCompare(String(b.lot.name));
    else if(k==='lot')r=String(a.lot.name).localeCompare(String(b.lot.name))||String(a.it.name||'').localeCompare(String(b.it.name||''));
    else if(k==='pctProfit')r=(a.r.pctProfit||0)-(b.r.pctProfit||0);
    else r=a.s[k]-b.s[k];
    return r*d;
  });
  return {S,scope,C};
}
function renderComp(){
  const {S,scope,C}=compSet();
  renderPick(C);
  const box=document.getElementById('compBody');
  if(!C.length){box.innerHTML='<div class="empty"><b>ไม่มีข้อมูลตามเงื่อนไข</b>ลองเปลี่ยนตัวกรอง</div>';return}
  if(!S.length){box.innerHTML='<div class="empty"><b>ยังไม่ได้ติ๊กเลือกรายการ</b>ติ๊กล็อต/SKU ด้านบนที่ต้องการเทียบ</div>';return}

  const cols=[['goods','ต้นทุนสินค้า'],['freight','เรือ+พิธีการ'],['cif','CIF'],['samui','ขนส่งสมุย'],['other','อื่นๆ'],['excise','สรรพสามิต'],['support','กองทุน'],['totalCost','ต้นทุนจริงรวม'],['sell','ราคาแจ้งกรมฯ'],['profit','ส่วนต่าง<br>(แจ้ง−ทุน)']];
  const Cc=cols.filter(c=>c[0]!=='other'||S.some(x=>Math.abs(x.s.other)>0.005));
  const avg={}; Cc.forEach(c=>avg[c[0]]=S.reduce((a,b)=>a+b.s[c[0]],0)/S.length);
  const ar=(k)=>compSort.k===k?(compSort.d>0?' ▲':' ▼'):'';
  const th=(k,lab)=>`<th class="srt ${compSort.k===k?'act':''}" onclick="compSortBy('${k}')">${lab}${ar(k)}</th>`;

  let rows=S.map((x,i)=>{
    const prev=i>0?S[i-1]:null;
    const dd=prev?x.s.totalCost-prev.s.totalCost:null;
    const dp=prev&&prev.s.totalCost?dd/prev.s.totalCost:null;
    return `<tr>
      <td><b>${esc(x.lot.name)}</b><br><span class="mut" style="font-size:11px">${esc(x.it.name)} · ${x.r.P.th} · ${x.lot.date||''}</span></td>
      ${Cc.map(c=>`<td class="${c[0]==='profit'?(x.s.profit>=0?'pos':'neg'):''}">${f(x.s[c[0]],2)}</td>`).join('')}
      <td class="${x.r.profit>=0?'pos':'neg'}">${pct(x.r.pctProfit)}</td>
      <td>${dd===null?'<span class="mut">–</span>':`<span class="${dd>0?'neg':'pos'}">${dd>0?'▲':'▼'} ${f(Math.abs(dd),2)}<br><small>${(dp*100).toFixed(1)}%</small></span>`}</td>
    </tr>`;
  }).join('');
  rows+=`<tr class="tot"><td>ค่าเฉลี่ย (${S.length} รายการ)</td>${Cc.map(c=>`<td>${f(avg[c[0]],2)}</td>`).join('')}<td>${pct(S.reduce((a,b)=>a+(isFinite(b.r.pctProfit)?b.r.pctProfit:0),0)/S.length)}</td><td></td></tr>`;
  const mn=Math.min(...S.map(x=>x.s.totalCost)), mx=Math.max(...S.map(x=>x.s.totalCost));
  const lo=S.find(x=>x.s.totalCost===mn), hi=S.find(x=>x.s.totalCost===mx);

  box.innerHTML=`
  <div class="note" style="font-size:12px">ℹ️ คอลัมน์ <b>ราคาแจ้งกรมฯ</b> คือราคาขายปลีกแนะนำที่ใช้เป็นฐานภาษี — <b>ส่วนต่าง</b> จึงไม่ใช่กำไรจริง (ดูกำไรจริงที่หน้า 💰 คิดราคาขาย)</div>
  <div class="kpis">
    <div class="kpi"><span>ต้นทุนจริงเฉลี่ย</span><b>${f(avg.totalCost,2)}</b><small>บาท ${scope==='unit'?'/หน่วย':scope==='case'?'/ลัง':'/ล็อต'}</small></div>
    <div class="kpi"><span>ถูกสุด</span><b class="pos">${f(mn,2)}</b><small>${esc(lo.lot.name)}</small></div>
    <div class="kpi"><span>แพงสุด</span><b class="neg">${f(mx,2)}</b><small>${esc(hi.lot.name)}</small></div>
    <div class="kpi"><span>ช่วงห่าง</span><b>${f(mx-mn,2)}</b><small>${mn?((mx-mn)/mn*100).toFixed(1)+'%':''}</small></div>
    <div class="kpi"><span>ภาษีเฉลี่ย</span><b>${f(avg.excise+avg.support,2)}</b><small>บาท</small></div>
  </div>
  <div class="tw"><table><thead><tr>${th('lot','ล็อต / SKU')}${Cc.map(c=>th(c[0],c[1])).join('')}${th('pctProfit','%ส่วนต่าง')}<th>Δ ต้นทุน<br>vs แถวก่อน</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="hint">คลิกหัวคอลัมน์เพื่อเรียงลำดับ · ตอนนี้เรียงตาม <b>${String(({date:'วันที่',lot:'ชื่อล็อต',pctProfit:'%ส่วนต่าง'}[compSort.k])||(cols.find(c=>c[0]===compSort.k)||[,compSort.k])[1]).replace(/<br>/g,' ')}</b> ${compSort.d>0?'น้อย→มาก':'มาก→น้อย'} · Δ เทียบแถวก่อนหน้า</p>
  <div class="row noprint" style="margin-top:8px"><button class="gh sm" onclick="compSortBy('date')">เรียงตามวันที่</button></div>`;
}

/* ═══════════ CHART (canvas, no CDN) ═══════════ */
const PAL=['#f5a623','#4a9eff','#3fb950','#f85149','#bc8cff','#39c5cf','#ffcd6b','#ff7b72'];
let CHSEL=null;                       // null = เลือกทั้งหมด
function chCands(){
  const A=allSkus();
  const sel=document.getElementById('chProd'); const prods=[...new Set(A.map(x=>x.it.name||'?'))].sort();
  const keep=sel.value;
  sel.innerHTML='<option value="">ทั้งหมด</option>'+prods.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
  if(prods.includes(keep))sel.value=keep;
  const fp=sel.value, fk=document.getElementById('chPack').value;
  return A.filter(x=>(!fp||(x.it.name||'?')===fp)&&(!fk||x.it.pack===fk));
}
function chPicked(x){return CHSEL===null||CHSEL.has(skuKey(x))}
function chEnsure(C){if(CHSEL===null)CHSEL=new Set(C.map(skuKey))}
function chToggleSku(k){chEnsure(chCands()); CHSEL.has(k)?CHSEL.delete(k):CHSEL.add(k); renderChart()}
function chToggleLot(id){
  const C=chCands(); chEnsure(C);
  const ks=C.filter(x=>x.lot.id===id).map(skuKey);
  const allOn=ks.every(k=>CHSEL.has(k));
  ks.forEach(k=>allOn?CHSEL.delete(k):CHSEL.add(k));
  renderChart();
}
function chAll(on){const C=chCands(); CHSEL=new Set(on?C.map(skuKey):[]); renderChart()}
function chLatest(){
  const C=chCands();
  const ids=[...new Set(C.map(x=>x.lot.id))].map(id=>C.find(x=>x.lot.id===id).lot)
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,3).map(l=>l.id);
  CHSEL=new Set(C.filter(x=>ids.includes(x.lot.id)).map(skuKey));
  renderChart();
}
function renderChart(){
  const metric=document.getElementById('chMetric').value;
  const C=chCands();
  document.getElementById('chPick').innerHTML=C.length?pickHTML(C,chPicked,'chToggleLot','chToggleSku'):'';
  let A=C.filter(chPicked);
  A.sort((a,b)=>(a.lot.date||'').localeCompare(b.lot.date||'')||String(a.lot.name).localeCompare(String(b.lot.name)));
  const nLots=new Set(A.map(x=>x.lot.id)).size;
  document.getElementById('chInfo').innerHTML=C.length
    ? (A.length?`พลอต <b style="color:var(--acc2)">${A.length}</b> รายการ จาก <b style="color:var(--acc2)">${nLots}</b> ล็อต (จากทั้งหมด ${C.length} รายการที่ผ่านตัวกรอง)`
              :'⚠️ ยังไม่ได้ติ๊กเลือกรายการ — ติ๊กล็อต/SKU ด้านบน')
    : '⚠️ ไม่มีข้อมูลตามตัวกรอง';
  const groups={};
  A.forEach(x=>{const k=(x.it.name||'?')+' · '+x.r.P.th; (groups[k]=groups[k]||[]).push(x)});
  const labels=[...new Set(A.map(x=>x.lot.name))];
  const get=x=>{const r=x.r;
    if(metric==='total')return r.totalCost;
    if(metric==='cif')return r.cif;
    if(metric==='tax')return r.taxTotal;
    if(metric==='profit')return r.gap;
    if(metric==='pct')return r.pctGap*100;
    const w=realCalc(x.lot,x.it,r); return w?w.profit:null;};
  const series=Object.entries(groups).map(([k,v],i)=>({name:k,color:PAL[i%PAL.length],
    pts:labels.map(L=>{const m=v.find(x=>x.lot.name===L); return m?get(m):null})}));
  drawLine('cv',labels,series,metric==='pct');
  document.getElementById('chLegend').innerHTML=series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');

  // ── แท่งซ้อน: โครงสร้างต้นทุน ──
  const mode=document.getElementById('ch2Mode').value;
  let keys=[], picks=[];
  if(mode==='all'){
    picks=A; keys=A.map(x=>shortLot(x.lot.name)+' · '+(x.it.name||'?')+' '+x.r.P.th);
  }else{
    const latest={};
    A.forEach(x=>{const k=(x.it.name||'?')+' · '+x.r.P.th; latest[k]=x});
    keys=Object.keys(latest); picks=keys.map(k=>latest[k]);
  }
  const parts=[['goods','ต้นทุนสินค้า'],['freight','เรือ+พิธีการ'],['samui','ขนส่งสมุย'],['other','อื่นๆ'],['excise','สรรพสามิต'],['support','กองทุน']];
  drawStack('cv2',keys,parts.map((p,i)=>({name:p[1],color:PAL[i%PAL.length],vals:picks.map(x=>x.r[p[0]])})));
  document.getElementById('ch2Legend').innerHTML=parts.map((p,i)=>`<span><i style="background:${PAL[i%PAL.length]}"></i>${p[1]}</span>`).join('');
  document.getElementById('ch2Info').innerHTML=picks.length
    ? (mode==='all'?`${picks.length} แท่ง = ทุกรายการที่ติ๊ก`:`${picks.length} แท่ง = ล็อตล่าสุดของแต่ละสินค้า·บรรจุภัณฑ์`)
      +(picks.length>10?' <span style="color:var(--warn)">· เยอะไปอาจอ่านยาก ลองติ๊กให้น้อยลง</span>':'')
    : 'ไม่มีข้อมูล';
}
function shortLot(s){s=String(s||''); return s.length>16?s.slice(0,15)+'…':s}
function prep(id){
  const c=document.getElementById(id), dpr=window.devicePixelRatio||1;
  const w=c.clientWidth||600, h=parseInt(c.getAttribute('height'))||300;
  c.width=w*dpr; c.height=h*dpr; const x=c.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0);
  x.clearRect(0,0,w,h); return {x,w,h};
}
function axis(x,w,h,pad,min,max,labels,isPct,bar){
  x.strokeStyle='#2a333f'; x.fillStyle='#8b98a8'; x.font='11px sans-serif'; x.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.t+(h-pad.t-pad.b)*i/4, v=max-(max-min)*i/4;
    x.beginPath(); x.moveTo(pad.l,y); x.lineTo(w-pad.r,y); x.stroke();
    x.textAlign='right'; x.textBaseline='middle';
    x.fillText(isPct?v.toFixed(1)+'%':(Math.abs(v)>=1000?Math.round(v).toLocaleString():v.toFixed(1)),pad.l-6,y);
  }
  x.textAlign='center'; x.textBaseline='top';
  const slot=(w-pad.l-pad.r)/Math.max(1,labels.length);
  const step=Math.max(1,Math.ceil(labels.length/(bar?Math.max(1,Math.floor((w-pad.l-pad.r)/58)):8)));
  labels.forEach((L,i)=>{ if(i%step)return;
    const px=bar ? pad.l+slot*(i+0.5)
                 : pad.l+(w-pad.l-pad.r)*(labels.length===1?0.5:i/(labels.length-1));
    const maxCh=bar?Math.max(6,Math.floor(slot*step/5.6)):12;
    const s=String(L);
    x.fillText(s.length>maxCh?s.slice(0,maxCh-1)+'…':s,px,h-pad.b+7);
  });
}
function drawLine(id,labels,series,isPct){
  const {x,w,h}=prep(id), pad={l:56,r:14,t:14,b:34};
  const vals=series.flatMap(s=>s.pts).filter(v=>v!=null&&isFinite(v));
  if(!vals.length){x.fillStyle='#8b98a8';x.textAlign='center';x.fillText('ไม่มีข้อมูล',w/2,h/2);return}
  let min=Math.min(...vals,0), max=Math.max(...vals); if(max===min)max=min+1;
  const p=(max-min)*0.12; max+=p; if(min<0)min-=p; else min=Math.max(0,min-p);
  axis(x,w,h,pad,min,max,labels,isPct);
  const X=i=>pad.l+(w-pad.l-pad.r)*(labels.length===1?0.5:i/(labels.length-1));
  const Y=v=>pad.t+(h-pad.t-pad.b)*(1-(v-min)/(max-min));
  if(min<0){const y=Y(0);x.strokeStyle='#f8514966';x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke()}
  series.forEach(s=>{
    x.strokeStyle=s.color; x.lineWidth=2.2; x.beginPath(); let started=false;
    s.pts.forEach((v,i)=>{ if(v==null||!isFinite(v))return;
      if(!started){x.moveTo(X(i),Y(v));started=true}else x.lineTo(X(i),Y(v)) });
    x.stroke();
    x.fillStyle=s.color;
    s.pts.forEach((v,i)=>{ if(v==null||!isFinite(v))return;
      x.beginPath(); x.arc(X(i),Y(v),3.4,0,7); x.fill() });
  });
}
function drawStack(id,labels,parts){
  const {x,w,h}=prep(id), pad={l:56,r:14,t:14,b:44};
  if(!labels.length){x.fillStyle='#8b98a8';x.textAlign='center';x.fillText('ไม่มีข้อมูล',w/2,h/2);return}
  const tot=labels.map((_,i)=>parts.reduce((a,p)=>a+(p.vals[i]||0),0));
  let max=Math.max(...tot)*1.1||1;
  axis(x,w,h,pad,0,max,labels,false,true);
  const slot=(w-pad.l-pad.r)/labels.length;
  const bw=Math.max(4,Math.min(60,slot*0.62));
  labels.forEach((L,i)=>{
    const cx=pad.l+slot*(i+0.5);
    let acc=0;
    parts.forEach(p=>{
      const v=p.vals[i]||0; if(v<=0)return;
      const y0=pad.t+(h-pad.t-pad.b)*(1-acc/max), y1=pad.t+(h-pad.t-pad.b)*(1-(acc+v)/max);
      x.fillStyle=p.color; x.fillRect(cx-bw/2,y1,bw,y0-y1); acc+=v;
    });
    if(slot>36){
      x.fillStyle='#e6edf3'; x.font='bold 11px sans-serif'; x.textAlign='center'; x.textBaseline='bottom';
      x.fillText(f(tot[i],tot[i]>=1000?0:1),cx,pad.t+(h-pad.t-pad.b)*(1-tot[i]/max)-4);
    }
  });
}

/* ═══════════ PRICE / WHAT-IF ═══════════ */
let WEX=[];                       // ค่าใช้จ่ายอื่นๆ ในหน้าคิดราคา
const BASIS={unit:'บาท / หน่วย',case:'บาท / ลัง',lot:'บาท / ทั้งล็อต'};
function pkCur(){const A=allSkus(); const v=+document.getElementById('pkSku').value; return A[isFinite(v)?v:0]||A[0]}
function pkLoad(){                // โหลดสมมติฐานที่เคยบันทึกของ SKU นี้
  const x=pkCur(); if(!x)return;
  const w=x.it.whatif||{};
  document.getElementById('wRealPrice').value = w.price!=null&&w.price!==''?w.price:f(x.r.declared,2);
  document.getElementById('wPriceB').value   = w.priceB||'unit';
  document.getElementById('wVatMode').value  = w.vatMode||'ex';
  document.getElementById('wTaxBase').value  = w.taxBase||'retail';
  document.getElementById('wShip').value     = w.ship!=null?w.ship:'';
  document.getElementById('wShipB').value    = w.shipB||'case';
  document.getElementById('wComPct').value   = w.comPct!=null?w.comPct:'';
  document.getElementById('wComAmt').value   = w.comAmt!=null?w.comAmt:'';
  document.getElementById('wComB').value     = w.comB||'case';
  // Keg ไม่มีหน่วยลัง — ล็อกตัวเลือกให้เป็นต่อถัง
  const cased=x.r.P.cased;
  [['wPriceB',['unit','case']],['wShipB',['unit','case','lot']],['wComB',['case','unit','lot']]].forEach(([id,ks])=>{
    const el=document.getElementById(id);
    [...el.options].forEach(o=>{o.disabled=(!cased&&o.value==='case');
      if(!cased&&o.value==='case')o.textContent=o.textContent.replace('ลัง หรือ ถัง','ถัง').replace('/ ลัง','/ ถัง')});
  });
  WEX = (w.extras||[]).map(e=>({...e}));
  renderWExtras(); renderPrice();
}
function renderWExtras(){
  document.getElementById('wExtras').innerHTML = WEX.length?WEX.map((e,i)=>`
    <div class="wf">
      <input value="${esc(e.label)}" oninput="WEX[${i}].label=this.value" placeholder="เช่น ค่าการตลาด, ค่าแช่เย็น">
      <input type="number" step="0.01" value="${e.amount??''}" oninput="WEX[${i}].amount=this.value;renderPrice()" placeholder="0.00">
      <select onchange="WEX[${i}].basis=this.value;renderPrice()">${Object.entries(BASIS).map(([k,v])=>`<option value="${k}" ${e.basis===k?'selected':''}>${v}</option>`).join('')}</select>
      <button class="xb" onclick="WEX.splice(${i},1);renderWExtras();renderPrice()">✕</button>
    </div>`).join(''):'<p class="hint">ยังไม่มีค่าใช้จ่ายเพิ่ม</p>';
}
function addWExtra(){WEX.push({label:'',amount:'',basis:'unit'}); renderWExtras()}
function saveWhatIf(){
  const x=pkCur(); if(!x){alert('ยังไม่มีข้อมูล');return}
  const lot=DB.lots.find(l=>l.id===x.lot.id); const it=lot&&(lot.items||[]).find(i=>i.id===x.it.id);
  if(!it){alert('ไม่พบ SKU');return}
  it.whatif={...wfParams(),extras:WEX.map(e=>({...e}))};
  save(); alert('บันทึกสมมติฐานของ '+(x.it.name||'')+' ('+x.r.P.th+') แล้ว');
}
// แปลงยอดตาม basis → บาท/หน่วย
function perUnit(amount,basis,r){
  const a=n(amount); if(!a)return 0;
  if(basis==='case')return a/(r.qpc||1);
  if(basis==='lot') return r.units?a/r.units:0;
  return a;
}
function wfParams(){return {
  price:document.getElementById('wRealPrice').value, priceB:document.getElementById('wPriceB').value,
  vatMode:document.getElementById('wVatMode').value,
  taxBase:document.getElementById('wTaxBase').value, ship:document.getElementById('wShip').value,
  shipB:document.getElementById('wShipB').value, comPct:document.getElementById('wComPct').value,
  comAmt:document.getElementById('wComAmt').value, comB:document.getElementById('wComB').value, extras:WEX}}
function whatIf(x){return whatIfCalc(x,wfParams())}