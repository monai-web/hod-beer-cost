
function whatIfCalc(x,p){
  const S=DB.settings, r=x.r;
  p=p||{};
  const priceRaw= n(p.price);
  const priceB  = p.priceB||'unit';
  const price   = perUnit(priceRaw,priceB==='lot'?'lot':priceB,r);   // ราคาขายต่อหน่วยเสมอ
  const vatMode = p.vatMode||'ex';
  const taxBase = p.taxBase||'retail';
  // ภาษีสรรพสามิต: ฐานตามกฎหมาย = ราคาขายปลีกแนะนำ / หรือใช้ราคาขายจริง
  const rBase   = taxBase==='real'?price:r.retail;
  const excise  = rBase*n(S.adv)+Math.max(r.specA,r.specV);
  const support = excise*n(S.sup)/100;
  const mahad   = excise*n(S.mah)/100;
  // รายได้สุทธิ
  const vatOut  = vatMode==='in'?price-price/(1+n(S.vat)/100) : vatMode==='ex'?price*n(S.vat)/100 : 0;
  const netRev  = vatMode==='in'?price-vatOut : price;      // 'ex' → เก็บ VAT เพิ่มจากลูกค้า ไม่ใช่รายได้
  // ต้นทุน
  const landed  = r.cif+r.samui+r.other;                    // ต้นทุนถึงสมุย
  const tax     = excise+support+(S.incm==='yes'?mahad:0);
  const ship    = perUnit(p.ship,p.shipB,r);
  const comFix  = perUnit(p.comAmt,p.comB||'unit',r);              // คอมแบบยอดคงที่ → หารลงหน่วย
  const com     = netRev*n(p.comPct)/100 + comFix;
  const extras  = (p.extras||[]).map(e=>({label:e.label||'(ไม่มีชื่อ)',v:perUnit(e.amount,e.basis,r)}));
  const extraT  = extras.reduce((a,b)=>a+b.v,0);
  const cost    = landed+tax+ship+com+extraT;
  const profit  = netRev-cost;
  return {price,priceRaw,priceB,vatMode,vatOut,netRev,landed,excise,support,mahad,tax,ship,com,comFix,extras,extraT,cost,profit,
    pct:netRev?profit/netRev:NaN, perL:r.vol?profit/r.vol:NaN, rBase,
    // ราคาขายแนะนำ / จุดคุ้มทุน (แก้สมการเพราะภาษี+คอมผันตามราคา)
    solve(targetPct){
      const supM = 1+n(S.sup)/100+(S.incm==='yes'?n(S.mah)/100:0);
      // ถ้าใช้ราคาขายจริงเป็นฐานภาษี ภาษีตามมูลค่าจะผันตามราคา (kTax·P) ส่วนภาษีตามปริมาณคงที่
      const kTax     = taxBase==='real' ? n(S.adv)*supM : 0;
      const taxFixed = taxBase==='real' ? Math.max(r.specA,r.specV)*supM
                                        : excise+support+(S.incm==='yes'?mahad:0);
      const fixed = landed + taxFixed + ship + comFix + extraT;
      const cp    = n(p.comPct)/100;
      const g     = vatMode==='in'?1/(1+n(S.vat)/100):1;     // รายได้สุทธิ = g × ราคาขาย
      // g·P·(1−target) = fixed + kTax·P + cp·g·P
      const den   = g*(1-targetPct) - kTax - cp*g;
      return den>0?fixed/den:NaN;
    }};
}
function renderPrice(){
  const A=allSkus(); const sel=document.getElementById('pkSku'); const keep=sel.value;
  sel.innerHTML=A.map((x,i)=>`<option value="${i}">${esc(x.lot.name)} — ${esc(x.it.name)} (${x.r.P.th})</option>`).join('');
  if(keep!==''&&A[+keep])sel.value=keep;
  const box=document.getElementById('priceBody'), baseBox=document.getElementById('pkBase');
  if(!A.length){baseBox.innerHTML=''; box.innerHTML='<div class="empty"><b>ยังไม่มีข้อมูล</b>บันทึกล็อตก่อน</div>';return}
  const x=pkCur(), r=x.r, S=DB.settings;
  const W=whatIf(x);
  const wantPct=n(document.getElementById('pkPct').value)/100;
  const sugg=W.solve(wantPct), be=W.solve(0);

  // ── ส่วนบน: ต้นทุนจริง + ราคาขายแนะนำ ──
  baseBox.innerHTML=`
   <div class="kpis">
     <div class="kpi"><span>ต้นทุนจริง / ${r.P.unit}</span><b>${f(r.totalCost,2)}</b><small>ถึงสมุย+ภาษีแล้ว</small></div>
     <div class="kpi"><span>ราคาขายแนะนำ (กำไร ${(wantPct*100).toFixed(1)}%)</span><b style="color:var(--acc)">${isFinite(sugg)?f(sugg,2):'–'}</b><small>บาท / ${r.P.unit}${r.P.cased&&isFinite(sugg)?' · '+f(sugg*r.qpc,2)+' /ลัง':''}</small></div>
     <div class="kpi"><span>จุดคุ้มทุน</span><b>${isFinite(be)?f(be,2):'–'}</b><small>บาท / ${r.P.unit}${r.P.cased&&isFinite(be)?' · '+f(be*r.qpc,2)+' /ลัง':''}</small></div>
     <div class="kpi"><span>ราคาแจ้งกรมฯ (ฐานภาษี)</span><b>${f(r.declared,2)}</b><small>ไม่ใช่ราคาขายจริง</small></div>
     <div class="kpi"><span>จำนวนในล็อตนี้</span><b>${f0(r.units)}</b><small>${r.P.unit} · ${f0(r.litres)} L${r.P.cased?' · '+f0(r.units/r.qpc)+' ลัง':''}</small></div>
   </div>
   <div class="tw"><table><thead><tr><th>โครงสร้างต้นทุนจริงจากล็อต</th><th>บาท / ${r.P.unit}</th><th>% ของต้นทุน</th></tr></thead><tbody>
     ${[['ต้นทุนสินค้า (Ex-work)',r.goods],['ค่าเรือ + พิธีการ',r.freight],['ค่าขนส่งถึงสมุย',r.samui],
        ['ค่าใช้จ่ายอื่นในล็อต',r.other],['ภาษีสรรพสามิต',r.excise],['เงินสนับสนุนกองทุน',r.support]]
       .filter(z=>Math.abs(z[1])>0.004)
       .map(z=>`<tr><td>${z[0]}</td><td>${f(z[1],2)}</td><td class="mut">${pct(z[1]/r.totalCost)}</td></tr>`).join('')}
     <tr class="tot"><td>ต้นทุนจริงรวม</td><td>${f(r.totalCost,2)}</td><td>100.00%</td></tr>
   </tbody></table></div>
   <p class="hint">ล็อต <b>${esc(x.lot.name)}</b> · ${x.lot.date||''} · เรท ${f(r.fx,2)} ฿/USD · ${r.P.cased?r.qpc+' '+r.P.unit+'/ลัง · ':''}${f(r.vol,3)} L/${r.P.unit} · ABV ${f(r.abv,1)}%</p>`;

  const perCase=v=>r.P.cased?' · '+f(v*r.qpc,2)+' /ลัง':'';
  document.getElementById('wPriceInfo').innerHTML='= <b style="color:var(--acc2)">'+f(W.price,2)+'</b> บาท/'+r.P.unit+perCase(W.price)
    +'<br>รวมทั้งล็อต '+f0(W.price*r.units)+' บาท';
  document.getElementById('wShipInfo').innerHTML='= <b style="color:var(--acc2)">'+f(W.ship,2)+'</b> บาท/'+r.P.unit+perCase(W.ship);
  document.getElementById('wComInfo').innerHTML='= <b style="color:var(--acc2)">'+f(W.com,2)+'</b> บาท/'+r.P.unit+perCase(W.com)
    +(W.comFix?'<br>(คงที่ '+f(W.comFix,2)+' + %'+f(W.com-W.comFix,2)+')':'');

  // ── ตารางผลลัพธ์ 3 คอลัมน์ ──
  const M={unit:1,case:(r.qpc||1),lot:r.units};
  const row=(lab,key,cls,flag)=>{
    const v=typeof key==='function'?key:null;
    return `<tr class="${flag||''}"><td>${lab}</td>`+['unit','case','lot'].map(sc=>{
      const val=(v?v():W[key])*M[sc];
      return `<td class="${cls==='p'?(val>=0?'pos':'neg'):cls==='m'?'mut':''}">${cls==='p'?(val>0?'+':'')+f(val,2):f(val,2)}</td>`;
    }).join('')+'</tr>';
  };
  const vatLab = W.vatMode==='in'?'(−) VAT 7% ที่ถอดออกจากราคา':W.vatMode==='ex'?'VAT 7% ที่เก็บเพิ่มจากลูกค้า (ไม่ใช่รายได้)':'VAT (ไม่คิด)';
  let body='';
  body+=row('ราคาขายจริง','price');
  body+=row(vatLab,'vatOut','m');
  body+=row('= รายได้สุทธิ (ก่อนต้นทุน)','netRev','','sub');
  body+=row('ต้นทุนสินค้าถึงสมุย (CIF+ขนส่ง)','landed');
  body+=row('ภาษีสรรพสามิต','excise');
  body+=row('เงินสนับสนุนกองทุน','support');
  if(S.incm==='yes')body+=row('ภาษีมหาดไทย','mahad');
  if(Math.abs(W.ship)>0.004)body+=row('ค่าขนส่งไปส่งลูกค้า','ship');
  if(Math.abs(W.com)>0.004) body+=row('ค่าคอมมิชชั่น','com');
  W.extras.forEach((e,i)=>{if(Math.abs(e.v)>0.004)body+=row(esc(e.label),()=>W.extras[i].v)});
  body+=row('● ต้นทุนรวมทั้งหมด','cost','','tot');
  body+=row('กำไรสุทธิ','profit','p','tot');
  body+=`<tr class="sub"><td>% กำไร (จากรายได้สุทธิ)</td>`+['unit','case','lot'].map(()=>`<td class="${W.profit>=0?'pos':'neg'}">${pct(W.pct)}</td>`).join('')+'</tr>';
  body+=`<tr class="sub"><td>กำไร / ลิตร</td>`+['unit','case','lot'].map(()=>`<td class="${W.perL>=0?'pos':'neg'}">${f(W.perL,2)}</td>`).join('')+'</tr>';
  body+=`<tr class="sub"><td>จำนวน</td><td>1 ${r.P.unit}</td><td>${f0(r.qpc)} ${r.P.unit}</td><td>${f0(r.units)} ${r.P.unit}</td></tr>`;

  const diff=W.price-n(x.it.sellPrice);
  box.innerHTML=`
   <div class="kpis">
     <div class="kpi"><span>กำไร / ${r.P.unit}</span><b class="${W.profit>=0?'pos':'neg'}">${(W.profit>0?'+':'')+f(W.profit,2)}</b><small>${pct(W.pct)}</small></div>
     ${r.P.cased?`<div class="kpi"><span>กำไร / ลัง</span><b class="${W.profit>=0?'pos':'neg'}">${(W.profit>0?'+':'')+f(W.profit*r.qpc,2)}</b><small>${f0(r.qpc)} ${r.P.unit}/ลัง</small></div>`:''}
     <div class="kpi"><span>กำไรทั้งล็อต</span><b class="${W.profit>=0?'pos':'neg'}">${(W.profit>0?'+':'')+f0(W.profit*r.units)}</b><small>${f0(r.units)} ${r.P.unit}</small></div>
     <div class="kpi"><span>รายได้สุทธิทั้งล็อต</span><b>${f0(W.netRev*r.units)}</b><small>บาท</small></div>
     <div class="kpi"><span>ต้นทุนรวมทั้งล็อต</span><b>${f0(W.cost*r.units)}</b><small>บาท</small></div>
   </div>
   ${W.profit<0?`<div class="note err">⚠️ ราคานี้ <b>ขาดทุน ${f(Math.abs(W.profit),2)} บาท/${r.P.unit}</b> (ทั้งล็อต ${f0(Math.abs(W.profit*r.units))} บาท) — ต้องขายอย่างน้อย ${isFinite(be)?f(be,2):'?'} บาทถึงจะเท่าทุน</div>`:''}
   ${isFinite(sugg)&&W.price<sugg?`<div class="note">💡 ถ้าอยากได้กำไร ${(wantPct*100).toFixed(1)}% ควรขาย <b>${f(sugg,2)} บาท/${r.P.unit}</b> (ตอนนี้ตั้งไว้ ${f(W.price,2)})</div>`:''}
   <div class="tw"><table><thead><tr><th>รายการ (บาท)</th><th>ต่อ ${r.P.unit}</th><th>ต่อลัง${r.P.cased?' ('+f0(r.qpc)+')':' *'}</th><th>ทั้งล็อต (${f0(r.units)} ${r.P.unit})</th></tr></thead><tbody>${body}</tbody></table></div>
   <p class="hint">
     ${r.P.cased?'':'* '+r.P.th+' ไม่มีหน่วยลัง — คอลัมน์กลางแสดงค่าเท่ากับต่อถัง<br>'}
     ฐานคิดภาษีสรรพสามิต = <b>${f(W.rBase,2)} บาท</b> (${document.getElementById('wTaxBase').value==='real'?'ราคาขายจริง':'ราคาแจ้งกรมฯ ของ SKU'})
     ${diff?` · ราคาขายจริงที่ลองนี้ ${diff>0?'สูงกว่า':'ต่ำกว่า'}ราคาแจ้งกรมฯ ${f(Math.abs(diff),2)} บาท`:' · เท่ากับราคาแจ้งกรมฯ พอดี'}
   </p>`;
}
function pngPrice(){
  const x=pkCur(); if(!x){alert('ยังไม่มีข้อมูล');return}
  const r=x.r, W=whatIf(x), S=DB.settings;
  const wantPct=n(document.getElementById('pkPct').value)/100;
  const sugg=W.solve(wantPct), be=W.solve(0);
  const M={unit:1,case:(r.qpc||1),lot:r.units};
  const R3=(lab,val,cls,style)=>({style,cells:[lab,
    ...['unit','case','lot'].map(sc=>cls==='p'
      ?{t:(val*M[sc]>0?'+':'')+f(val*M[sc],2),c:val<0?'neg':'pos',b:true}
      :f(val*M[sc],2))]});
  const rows=[R3('ราคาขายจริง',W.price),
    R3(W.vatMode==='in'?'(−) VAT 7% ถอดออก':W.vatMode==='ex'?'VAT 7% เก็บเพิ่ม (ไม่ใช่รายได้)':'VAT (ไม่คิด)',W.vatOut,'','sub'),
    R3('= รายได้สุทธิ',W.netRev,'','sub'),
    R3('ต้นทุนสินค้าถึงสมุย',W.landed),R3('ภาษีสรรพสามิต',W.excise),R3('เงินสนับสนุนกองทุน',W.support)];
  if(S.incm==='yes')rows.push(R3('ภาษีมหาดไทย',W.mahad));
  if(Math.abs(W.ship)>0.004)rows.push(R3('ค่าขนส่งไปส่งลูกค้า',W.ship));
  if(Math.abs(W.com)>0.004)rows.push(R3('ค่าคอมมิชชั่น',W.com));
  W.extras.forEach(e=>{if(Math.abs(e.v)>0.004)rows.push(R3(e.label,e.v))});
  rows.push(R3('ต้นทุนรวมทั้งหมด',W.cost,'','tot'));
  rows.push(R3('กำไรสุทธิ',W.profit,'p','tot'));
  rows.push({style:'sub',cells:['% กำไร',...['a','b','c'].map(()=>({t:pct(W.pct),c:W.profit<0?'neg':'pos'}))]});
  rows.push({style:'sub',cells:['จำนวน','1 '+r.P.unit,f0(r.qpc)+' '+r.P.unit,f0(r.units)+' '+r.P.unit]});
  const c=drawReport({
    title:'คิดราคาขาย — '+(x.it.name||'')+' ('+r.P.th+')',
    sub:'ล็อต '+x.lot.name+' · '+(x.lot.date||'')+' · ราคาขายที่ลอง '+f(W.price,2)+' ฿/'+r.P.unit,
    kpis:[['ต้นทุนจริง/'+r.P.unit,f(r.totalCost,2)+' ฿'],
      ['ราคาแนะนำ ('+(wantPct*100).toFixed(0)+'%)',isFinite(sugg)?f(sugg,2)+' ฿':'–'],
      ['จุดคุ้มทุน',isFinite(be)?f(be,2)+' ฿':'–'],
      ['กำไร/'+r.P.unit,(W.profit>0?'+':'')+f(W.profit,2)+' ฿',W.profit>=0?'pos':'neg',pct(W.pct)],
      ['กำไรทั้งล็อต',(W.profit>0?'+':'')+f0(W.profit*r.units)+' ฿',W.profit>=0?'pos':'neg']],
    cols:['รายการ (บาท)','ต่อ '+r.P.unit,'ต่อลัง','ทั้งล็อต ('+f0(r.units)+')'],
    rows, notes:['ฐานคิดภาษีสรรพสามิต '+f(W.rBase,2)+' บาท · '+(W.vatMode==='in'?'ราคารวม VAT แล้ว':W.vatMode==='ex'?'ราคายังไม่รวม VAT':'ไม่คิด VAT')]
  });
  savePng(c,safeName('คิดราคาขาย '+(x.it.name||'')+' '+x.lot.name)+'.png');
}

/* ═══════════ EXPORT: PDF (print) & PNG (canvas) ═══════════ */
function toPdf(){
  const on=document.querySelector('.page.on'), id=on?on.id.slice(2):'';
  let t='HOD Beer Cost', s=new Date().toLocaleString('th-TH');
  if(id==='detail'&&cur){t=cur.name; s=(cur.date||'')+' · เรท '+f(n(cur.fx)||n(DB.settings.fx),2)+' ฿/USD · พิมพ์ '+new Date().toLocaleDateString('th-TH')}
  if(id==='comp'){t='เปรียบเทียบต้นทุนทุกล็อต'; s='พิมพ์ '+new Date().toLocaleString('th-TH')}
  if(id==='chart'){t='กราฟแนวโน้มต้นทุน'; s='พิมพ์ '+new Date().toLocaleString('th-TH')}
  document.getElementById('printhead').innerHTML=`<b>🍺 ${esc(t)}</b><span>${esc(s)} · Monkey Samui Beer / HOD</span>`;
  setTimeout(()=>window.print(),60);
}
const IMG={bg:'#ffffff',fg:'#15181c',dim:'#66707d',line:'#e2e6eb',head:'#f2f4f7',acc:'#b4770d',accbg:'#fff7e8',
  ok:'#12742a',bad:'#b3241a',totbg:'#fdf5e6'};
function savePng(cv,name){
  const go=b=>{const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),4000)};
  if(cv.toBlob)cv.toBlob(go,'image/png'); else {const a=document.createElement('a');a.href=cv.toDataURL('image/png');a.download=name;a.click()}
}
function safeName(s){return String(s||'export').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,70)}
/* export a chart canvas (adds white background + title) */
function pngCanvas(id,title){
  const src=document.getElementById(id); if(!src)return;
  const pad=18, th=34;
  const c=document.createElement('canvas'); c.width=src.width; c.height=src.height+ (th+pad)*(src.width/(src.clientWidth||src.width));
  const k=src.width/(src.clientWidth||src.width);
  c.width=src.width+pad*2*k; c.height=src.height+(th+pad*2)*k;
  const x=c.getContext('2d');
  x.fillStyle=IMG.bg; x.fillRect(0,0,c.width,c.height);
  x.setTransform(k,0,0,k,0,0);
  x.fillStyle=IMG.acc; x.font='bold 15px sans-serif'; x.textAlign='left'; x.textBaseline='top';
  x.fillText('🍺 '+title,pad,pad-2);
  x.fillStyle=IMG.dim; x.font='10.5px sans-serif';
  x.fillText('Monkey Samui Beer / HOD · '+new Date().toLocaleDateString('th-TH'),pad,pad+16);
  x.setTransform(1,0,0,1,0,0);
  x.drawImage(src,pad*k,(th+pad)*k);
  savePng(c,safeName(title)+'.png');
}
/* generic styled table → PNG */
function drawReport(o){
  const K=2;                                   // retina scale
  const FS=13, FSH=11.5, RH=25, HRH=30, PAD=26, GAP=14;
  const m=document.createElement('canvas').getContext('2d');
  const W=t=>{m.font=FS+'px sans-serif';return m.measureText(String(t)).width};
  const Wb=t=>{m.font='bold '+FS+'px sans-serif';return m.measureText(String(t)).width};
  const cellTxt=v=>typeof v==='object'&&v?String(v.t):String(v==null?'':v);
  // column widths
  const widths=o.cols.map((h,i)=>{
    m.font='bold '+FSH+'px sans-serif';
    let w=m.measureText(String(h).replace(/\n/g,' ')).width;
    o.rows.forEach(r=>{const c=r.cells[i]; const t=cellTxt(c);
      const bold=(typeof c==='object'&&c&&c.b)||r.style==='tot';
      w=Math.max(w,bold?Wb(t):W(t))});
    return Math.ceil(w)+20;
  });
  const tblW=widths.reduce((a,b)=>a+b,0);
  // kpi layout
  const kpis=o.kpis||[], kCols=Math.min(kpis.length,5)||1, kW=Math.max(150,tblW/kCols), kH=52;
  const kRows=Math.ceil(kpis.length/kCols);
  const notes=(o.notes||[]).filter(Boolean);
  const cw=Math.max(tblW,kCols*kW,420);
  let y=PAD;
  const titleH=o.sub?46:28;
  const kpiH=kpis.length?kRows*(kH+8)+GAP:0;
  const notesH=notes.length?notes.length*19+GAP:0;
  const H=PAD+titleH+GAP+kpiH+HRH+o.rows.length*RH+notesH+34+PAD;
  const c=document.createElement('canvas'); c.width=(cw+PAD*2)*K; c.height=H*K;
  const x=c.getContext('2d'); x.setTransform(K,0,0,K,0,0);
  x.fillStyle=IMG.bg; x.fillRect(0,0,cw+PAD*2,H);
  // title
  x.textBaseline='top'; x.textAlign='left';
  x.fillStyle=IMG.acc; x.font='bold 18px sans-serif'; x.fillText('🍺 '+o.title,PAD,y); y+=24;
  if(o.sub){x.fillStyle=IMG.dim; x.font='11.5px sans-serif'; x.fillText(o.sub,PAD,y); y+=18}
  x.strokeStyle=IMG.acc; x.lineWidth=2; x.beginPath(); x.moveTo(PAD,y+4); x.lineTo(PAD+cw,y+4); x.stroke();
  y+=GAP+4;
  // kpis
  kpis.forEach((k,i)=>{
    const cx=PAD+(i%kCols)*kW, cy=y+Math.floor(i/kCols)*(kH+8);
    x.fillStyle=IMG.accbg; x.strokeStyle=IMG.line; x.lineWidth=1;
    rr(x,cx,cy,kW-8,kH,8); x.fill(); x.stroke();
    x.fillStyle=IMG.dim; x.font='bold 10px sans-serif'; x.fillText(k[0],cx+10,cy+8);
    x.fillStyle=k[2]==='pos'?IMG.ok:k[2]==='neg'?IMG.bad:IMG.fg;
    x.font='bold 17px sans-serif'; x.fillText(k[1],cx+10,cy+23);
    if(k[3]){x.fillStyle=IMG.dim;x.font='9.5px sans-serif';x.fillText(k[3],cx+10,cy+42)}
  });
  y+=kpiH;
  // header
  x.fillStyle=IMG.head; x.fillRect(PAD,y,tblW,HRH);
  x.strokeStyle=IMG.line; x.lineWidth=1;
  let cx=PAD;
  o.cols.forEach((h,i)=>{
    x.fillStyle='#3d4652'; x.font='bold '+FSH+'px sans-serif';
    x.textAlign=i===0?'left':'right'; x.textBaseline='middle';
    x.fillText(String(h).replace(/\n/g,' '),i===0?cx+10:cx+widths[i]-10,y+HRH/2);
    cx+=widths[i];
  });
  x.beginPath();x.moveTo(PAD,y+HRH);x.lineTo(PAD+tblW,y+HRH);x.stroke();
  y+=HRH;
  // rows
  o.rows.forEach((r,ri)=>{
    if(r.style==='tot'){x.fillStyle=IMG.totbg;x.fillRect(PAD,y,tblW,RH)}
    else if(ri%2){x.fillStyle='#fafbfc';x.fillRect(PAD,y,tblW,RH)}
    let cx2=PAD;
    r.cells.forEach((cell,i)=>{
      const t=cellTxt(cell), obj=typeof cell==='object'&&cell;
      const cls=obj&&obj.c;
      x.fillStyle=cls==='pos'?IMG.ok:cls==='neg'?IMG.bad:cls==='dim'?IMG.dim:IMG.fg;
      const bold=(obj&&obj.b)||r.style==='tot';
      x.font=(bold?'bold ':'')+(r.style==='sub'?FSH:FS)+'px sans-serif';
      x.textAlign=i===0?'left':'right'; x.textBaseline='middle';
      let tt=t;
      if(x.measureText(tt).width>widths[i]-16){while(tt.length>3&&x.measureText(tt+'…').width>widths[i]-16)tt=tt.slice(0,-1); tt+='…'}
      x.fillText(tt,i===0?cx2+10:cx2+widths[i]-10,y+RH/2);
      cx2+=widths[i];
    });
    x.strokeStyle=r.style==='tot'?IMG.acc:IMG.line; x.lineWidth=r.style==='tot'?1.6:1;
    x.beginPath();x.moveTo(PAD,y+RH);x.lineTo(PAD+tblW,y+RH);x.stroke();
    y+=RH;
  });
  y+=GAP;
  x.textAlign='left';
  notes.forEach(t2=>{x.fillStyle=IMG.dim;x.font='11px sans-serif';x.textBaseline='top';
    let tt=t2; while(x.measureText(tt).width>cw&&tt.length>10)tt=tt.slice(0,-1);
    if(tt!==t2)tt+='…'; x.fillText(tt,PAD,y); y+=19});
  x.fillStyle='#9aa3ae'; x.font='10px sans-serif';
  x.fillText('Monkey Samui Beer / HOD · สร้างโดย HOD Beer Cost Calculator · '+new Date().toLocaleString('th-TH'),PAD,H-PAD-4);
  return c;
}
function rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}

function pngDetail(){
  if(!cur){alert('เปิดล็อตก่อน');return}
  const its=(cur.items||[]).filter(it=>calcItem(cur,it).units>0||n(it.costPerPack));
  if(!its.length){alert('ล็อตนี้ยังไม่มีข้อมูล');return}
  const R=its.map(it=>{const r=calcItem(cur,it);return {it,r,s:scale(r,dScope)}});
  const s=lotSummary(cur);
  const scopeTxt=dScope==='unit'?'ต่อหน่วย':dScope==='case'?'ต่อลัง':'ทั้งล็อต (รวม)';
  const cols=['รายการ (บาท · '+scopeTxt+')',...R.map(x=>(x.it.name||'?')+' · '+x.r.P.th)];
  const rows=[];
  ROWS.forEach(([k,lab,flag])=>{
    if(k==='other'&&R.every(y=>Math.abs(y.s.other)<0.005))return;
    rows.push({style:flag===2?'tot':flag===1?'sub':'',
      cells:[lab.replace(/^● /,'').replace(/^= /,'= '),...R.map(y=>k==='profit'
        ?{t:(y.s.profit>0?'+':'')+f(y.s.profit,2),c:y.s.profit<0?'neg':'pos',b:true}
        :f(y.s[k],2))]});
  });
  rows.push({style:'sub',cells:['% ส่วนต่าง (จากราคาแจ้ง)',...R.map(y=>({t:pct(y.r.pctGap),c:y.r.gap<0?'neg':'pos'}))]});
  rows.push({style:'sub',cells:['% ภาษี / ราคาแจ้ง',...R.map(y=>pct(y.r.pctTax))]});
  rows.push({style:'sub',cells:['ต้นทุน / ลิตร',...R.map(y=>f(y.r.vol?y.r.totalCost/y.r.vol:0,2))]});
  rows.push({style:'sub',cells:['จำนวนในล็อต',...R.map(y=>f0(y.r.units)+' '+y.r.P.unit)]});
  rows.push({style:'sub',cells:['สัดส่วนค่าใช้จ่ายร่วม '+(isAuto(cur)?'(auto)':'(manual)'),...R.map(y=>f(y.r.sharePctEff,2)+'%')]});
  const WW=R.map(y=>realCalc(cur,y.it,y.r)), mult=dScope==='case'?'qpc':dScope==='lot'?'units':null;
  if(WW.some(Boolean)){
    const mm=y=>mult==='qpc'?(y.r.qpc||1):mult==='units'?y.r.units:1;
    rows.push({style:'tot',cells:['— กำไรจริง (จากราคาขายจริงที่บันทึก) —',...R.map(()=>'')]});
    rows.push({cells:['ราคาขายจริง',...R.map((y,i)=>WW[i]?f(WW[i].price*mm(y),2):'–')]});
    rows.push({cells:['ต้นทุนรวมขั้นสุดท้าย',...R.map((y,i)=>WW[i]?f(WW[i].cost*mm(y),2):'–')]});
    rows.push({style:'tot',cells:['กำไรจริง',...R.map((y,i)=>WW[i]?{t:(WW[i].profit>0?'+':'')+f(WW[i].profit*mm(y),2),c:WW[i].profit<0?'neg':'pos',b:true}:'–')]});
    rows.push({style:'sub',cells:['% กำไรจริง',...R.map((y,i)=>WW[i]?{t:pct(WW[i].pct),c:WW[i].profit<0?'neg':'pos'}:'–')]});
  }
  const c=drawReport({
    title:cur.name||'(ไม่มีชื่อ)',
    sub:(cur.date||'ไม่ระบุวันที่')+' · เรท '+f(n(cur.fx)||n(DB.settings.fx),2)+' ฿/USD · '+f0(s.units)+' หน่วย · '+f0(s.lit)+' L · แสดง'+scopeTxt,
    kpis:[['ต้นทุนจริงรวมล็อต',f0(s.cost)+' ฿'],['มูลค่าตามราคาแจ้ง',f0(s.sell)+' ฿'],
      ['ส่วนต่าง (แจ้ง−ทุน)',(s.gap>=0?'+':'')+f0(s.gap)+' ฿',s.gap>=0?'pos':'neg',pct(s.pctGap)],
      ...(s.realN?[['กำไรจริงรวม',(s.realProfit>=0?'+':'')+f0(s.realProfit)+' ฿',s.realProfit>=0?'pos':'neg',pct(s.realPct)]]:[]),
      ['ภาษีรวม',f0(s.tax)+' ฿'],['ต้นทุน/ลิตร',f(s.lit?s.cost/s.lit:0,2)+' ฿']],
    cols,rows,notes:['⚠️ "ราคาแจ้งกรมฯ" = ราคาขายปลีกแนะนำที่ใช้เป็นฐานภาษี ไม่ใช่ราคาขายจริง — "ส่วนต่าง" จึงไม่ใช่กำไร',
      cur.note?'📝 '+cur.note:'']
  });
  savePng(c,safeName('ต้นทุน '+(cur.name||'lot')+' ('+scopeTxt+')')+'.png');
}
function pngComp(){
  const {S,scope}=compSet();
  const fp=document.getElementById('cProd').value, fk=document.getElementById('cPack').value;
  if(!S.length){alert('ยังไม่ได้ติ๊กเลือกรายการที่จะเทียบ');return}
  const base=[['goods','ต้นทุนสินค้า'],['freight','เรือ+พิธีการ'],['cif','CIF'],['samui','ขนส่งสมุย'],['other','อื่นๆ'],['excise','สรรพสามิต'],['support','กองทุน'],['totalCost','ต้นทุนจริงรวม'],['sell','ราคาแจ้งกรมฯ'],['profit','ส่วนต่าง']];
  const C=base.filter(c=>c[0]!=='other'||S.some(y=>Math.abs(y.s.other)>0.005));
  const avg={}; C.forEach(c=>avg[c[0]]=S.reduce((a,b)=>a+b.s[c[0]],0)/S.length);
  const rows=S.map((x,i)=>{
    const p=i>0?S[i-1]:null, d=p?x.s.totalCost-p.s.totalCost:null;
    return {cells:[{t:x.lot.name+' — '+x.it.name+' ('+x.r.P.th+')',b:true},
      ...C.map(c=>c[0]==='profit'?{t:(x.s.profit>0?'+':'')+f(x.s.profit,2),c:x.s.profit<0?'neg':'pos',b:true}:f(x.s[c[0]],2)),
      {t:pct(x.r.pctProfit),c:x.r.profit<0?'neg':'pos'},
      d===null?{t:'–',c:'dim'}:{t:(d>0?'▲ +':'▼ ')+f(d,2),c:d>0?'neg':'pos'}]};
  });
  rows.push({style:'tot',cells:['ค่าเฉลี่ย ('+S.length+' รายการ)',...C.map(c=>f(avg[c[0]],2)),
    pct(S.reduce((a,b)=>a+(isFinite(b.r.pctProfit)?b.r.pctProfit:0),0)/S.length),'']});
  const mn=Math.min(...S.map(y=>y.s.totalCost)), mx=Math.max(...S.map(y=>y.s.totalCost));
  const lo=S.find(y=>y.s.totalCost===mn), hi=S.find(y=>y.s.totalCost===mx);
  const scopeTxt=scope==='unit'?'ต่อหน่วย':scope==='case'?'ต่อลัง':'ต่อล็อต (รวม)';
  const c=drawReport({
    title:'เปรียบเทียบต้นทุนทุกล็อต',
    sub:'มุมมอง: '+scopeTxt+(fp?' · สินค้า: '+fp:'')+(fk?' · '+PACKS[fk].th:'')+' · '+S.length+' รายการ · หน่วย: บาท',
    kpis:[['ต้นทุนจริงเฉลี่ย',f(avg.totalCost,2)+' ฿'],
      ['ถูกสุด',f(mn,2)+' ฿','pos',lo.lot.name],
      ['แพงสุด',f(mx,2)+' ฿','neg',hi.lot.name],
      ['ช่วงห่าง',f(mx-mn,2)+' ฿',null,mn?((mx-mn)/mn*100).toFixed(1)+'%':''],
      ['ภาษีเฉลี่ย',f(avg.excise+avg.support,2)+' ฿']],
    cols:['ล็อต / SKU',...C.map(x=>x[1]),'%ส่วนต่าง','Δ ต้นทุน'],
    rows, notes:['⚠️ "ราคาแจ้งกรมฯ" คือฐานคิดภาษี ไม่ใช่ราคาขายจริง — "ส่วนต่าง" จึงไม่ใช่กำไร',
      'Δ = ผลต่างต้นทุนรวมเทียบแถวก่อนหน้า · เรียงตาม '+compSort.k+(compSort.d>0?' น้อย→มาก':' มาก→น้อย')]
  });
  savePng(c,safeName('เปรียบเทียบต้นทุน '+scopeTxt)+'.png');
}

/* ═══════════ SETTINGS / IO ═══════════ */
function fillSettings(){const S=DB.settings;['fx','adv','alc','lit','sup','mah','vat'].forEach(k=>document.getElementById('s_'+k).value=S[k]);document.getElementById('s_incm').value=S.incm;dsInfo();bkInfo()}
function saveSettings(){const S=DB.settings;['fx','adv','alc','lit','sup','mah','vat'].forEach(k=>S[k]=n(document.getElementById('s_'+k).value));S.incm=document.getElementById('s_incm').value;save();alert('บันทึกการตั้งค่าแล้ว');renderList()}
function dl(name,txt,type){const bom=/csv/.test(type||'')?'﻿':'';const b=new Blob([bom+txt],{type:type||'text/plain;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000)}
function exportJson(){DB.lastBackup=Date.now();save();bkInfo();dl('hod-beer-cost-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(DB,null,2),'application/json')}
/* ── บันทึกลงไฟล์จริงบนเครื่อง (File System Access API) ── */
let FH=null;                        // file handle ของ session นี้