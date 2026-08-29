/* ===== Facturen (zelfde als jouw versie) ===== */
function defaultInvoiceItems(){
  return [
    {id:'start', group:'Pakketten', name:'Ervaren / overstap pakket', shortDesc:'Ervaren / overstap pakket', lessonCount:20, lessonMinutes:60, examIncluded:false, examAmount:0, amount:1475, vatRate:21},
    {id:'basis', group:'Pakketten', name:'Basis pakket', shortDesc:'Basis pakket', lessonCount:35, lessonMinutes:60, examIncluded:true, examAmount:285, amount:2450, vatRate:21},
    {id:'compleet', group:'Pakketten', name:'Compleet pakket', shortDesc:'Compleet pakket', lessonCount:40, lessonMinutes:60, examIncluded:true, examAmount:285, amount:2670, vatRate:21},
    {id:'10lessen', group:'Los / Aanvulling', name:'10 Lessen', shortDesc:'10 rijlessen', lessonCount:10, lessonMinutes:60, examIncluded:false, amount:680, vatRate:21},
    {id:'praktijk', group:'Examens', name:'Praktijkexamen', shortDesc:'CBR praktijkexamen', examOnly:true, examAmount:285, examCbrAmount:143.5, amount:285, vatRate:21},
    {id:'bnor', group:'Examens', name:'BNOR Examen', shortDesc:'BNOR examen', examOnly:true, examAmount:330, examCbrAmount:202, amount:330, vatRate:21},
    {id:'faalangst', group:'Examens', name:'Faalangstexamen', shortDesc:'Faalangstexamen', examOnly:true, examAmount:375, amount:375, vatRate:0},
    {id:'herexamen', group:'Examens', name:'Herexamen', shortDesc:'Herexamen', examOnly:true, examAmount:260, amount:260, vatRate:0},
    {id:'ttt', group:'Overig', name:'TTT', shortDesc:'Tussentijdse toets (TTT)', examOnly:true, examAmount:225, amount:225, vatRate:0},
    {id:'herverzekering', group:'Overig', name:'Herexamen verzekering', shortDesc:'Herexamen verzekering', amount:185, vatRate:21},
    {id:'custom', group:'Custom', name:'Vrij invullen', shortDesc:'Vrije factuurregel', amount:''}
  ];
}
var INVOICE_ITEMS = store.read(K.invoiceItems, null);
if(!Array.isArray(INVOICE_ITEMS) || !INVOICE_ITEMS.length) INVOICE_ITEMS = defaultInvoiceItems();
normalizeInvoiceItems();
function normalizeInvoiceItems(){
  if(!Array.isArray(INVOICE_ITEMS)) return;
  INVOICE_ITEMS = INVOICE_ITEMS.map(function(it){
    if(!it) return it;
    if(it.lessonCount){
      var examAmount = round2(Number(it.examAmount||0));
      var examCbrAmount = round2(Number(it.examCbrAmount != null ? it.examCbrAmount : (it.examIncluded ? Math.min(examAmount, 143.5) : 0)));
      if(examCbrAmount > examAmount) examCbrAmount = examAmount;
      var examServiceAmount = round2(Number(it.examServiceAmount != null ? it.examServiceAmount : (examAmount - examCbrAmount)));
      if(examServiceAmount < 0) examServiceAmount = 0;
      return Object.assign({}, it, {
        examAmount: it.examIncluded ? examAmount : 0,
        examCbrAmount: it.examIncluded ? examCbrAmount : 0,
        examServiceAmount: it.examIncluded ? examServiceAmount : 0
      });
    }
    if(it.examOnly){
      var totalExam = round2(Number(it.amount != null ? it.amount : (it.examAmount||0)));
      var defaultCbr = 0;
      if(it.id==='praktijk') defaultCbr = 143.5;
      else if(it.id==='bnor') defaultCbr = 202;
      var examCbr = round2(Number(it.examCbrAmount != null ? it.examCbrAmount : defaultCbr));
      if(examCbr > totalExam) examCbr = totalExam;
      var examService = round2(Number(it.examServiceAmount != null ? it.examServiceAmount : (totalExam - examCbr)));
      if(examService < 0) examService = 0;
      return Object.assign({}, it, {
        amount: totalExam,
        examAmount: totalExam,
        examCbrAmount: examCbr,
        examServiceAmount: examService,
        vatRate: Number(it.vatRate==null ? 21 : it.vatRate)
      });
    }
    return it;
  });
}
function saveInvoiceItems(){
  normalizeInvoiceItems();
  store.write(K.invoiceItems, INVOICE_ITEMS);
}

function round2(n){ return Math.round(Number(n||0)*100)/100; }
function invoiceVatLabel(rate){
  rate = Number(rate||0);
  if(rate===0) return '0%';
  return String(rate).replace('.',',') + '%';
}
function invoiceCalcLine(line){
  var gross = round2(Number(line && line.amount || 0));
  var rate = Number(line && line.vatRate || 0);
  if(rate<=0){
    return {gross:gross, net:gross, vat:0, rate:0};
  }
  var net = round2(gross / (1 + (rate/100)));
  var vat = round2(gross - net);
  return {gross:gross, net:net, vat:vat, rate:rate};
}
function invoiceTotals(lines){
  var out = {gross:0, net:0, vat:0, byRate:{}};
  (lines||[]).forEach(function(line){
    var calc = invoiceCalcLine(line);
    out.gross = round2(out.gross + calc.gross);
    out.net = round2(out.net + calc.net);
    out.vat = round2(out.vat + calc.vat);
    var key = String(calc.rate);
    if(!out.byRate[key]) out.byRate[key] = {rate:calc.rate, net:0, vat:0, gross:0};
    out.byRate[key].net = round2(out.byRate[key].net + calc.net);
    out.byRate[key].vat = round2(out.byRate[key].vat + calc.vat);
    out.byRate[key].gross = round2(out.byRate[key].gross + calc.gross);
  });
  return out;
}
function buildInvoiceLinesFromItem(item, manualDesc, manualAmount){
  var amount = round2(manualAmount);
  if(!item || item.id==='custom'){
    return [{desc: manualDesc || 'Factuurregel', qty:1, unitPrice: amount, vatRate:21, amount: amount, note:''}];
  }

  if(item.lessonCount){
    var examCbrAmount = item.examIncluded ? round2(item.examCbrAmount != null ? item.examCbrAmount : Math.min(round2(item.examAmount||0), 143.5)) : 0;
    var examServiceAmount = item.examIncluded ? round2(item.examServiceAmount != null ? item.examServiceAmount : (round2(item.examAmount||0) - examCbrAmount)) : 0;
    if(examServiceAmount < 0) examServiceAmount = 0;
    var examAmount = item.examIncluded ? round2(examCbrAmount + examServiceAmount) : 0;
    var lessonsAmount = round2(amount - examAmount);
    if(lessonsAmount < 0) lessonsAmount = amount;
    var unitPrice = item.lessonCount ? round2(lessonsAmount / item.lessonCount) : lessonsAmount;
    var lines = [{
      desc: item.lessonCount + ' rijlessen (' + (item.lessonMinutes||60) + ' min per les)',
      qty: item.lessonCount,
      unitPrice: unitPrice,
      vatRate: Number(item.vatRate||21),
      amount: lessonsAmount,
      note: 'Pakket: ' + (item.name||item.shortDesc||'') + ' • à ' + euro(unitPrice) + ' incl. btw',
      packageName: item.name || item.shortDesc || ''
    }];
    if(item.examIncluded && examCbrAmount>0){
      lines.push({
        desc: 'CBR examenkosten (vrij van btw)',
        qty: 1,
        unitPrice: examCbrAmount,
        vatRate: 0,
        amount: examCbrAmount,
        note: '',
        packageName: item.name || item.shortDesc || ''
      });
    }
    if(item.examIncluded && examServiceAmount>0){
      lines.push({
        desc: 'Praktijkexamen begeleiding / gebruik lesauto (incl. btw)',
        qty: 1,
        unitPrice: examServiceAmount,
        vatRate: Number(item.vatRate||21),
        amount: examServiceAmount,
        note: '',
        packageName: item.name || item.shortDesc || ''
      });
    }
    return lines;
  }

  if(item.examOnly){
    var examCbr = round2(Number(item.examCbrAmount != null ? item.examCbrAmount : 0));
    if(examCbr > amount) examCbr = amount;
    var examService = round2(Number(item.examServiceAmount != null ? item.examServiceAmount : (amount - examCbr)));
    if(examService < 0) examService = 0;
    var examLines = [];
    if(examCbr>0){
      examLines.push({
        desc: (item.shortDesc || item.name || 'Examen') + ' • CBR-deel (vrij van btw)',
        qty: 1,
        unitPrice: examCbr,
        vatRate: 0,
        amount: examCbr,
        note: ''
      });
    }
    if(examService>0){
      examLines.push({
        desc: (item.shortDesc || item.name || 'Examen') + ' • begeleiding / lesauto (incl. btw)',
        qty: 1,
        unitPrice: examService,
        vatRate: Number(item.vatRate==null ? 21 : item.vatRate),
        amount: examService,
        note: ''
      });
    }
    if(examLines.length) return examLines;
    return [{
      desc: item.shortDesc || item.name,
      qty: 1,
      unitPrice: amount,
      vatRate: Number(item.vatRate||0),
      amount: amount,
      note: ''
    }];
  }

  return [{
    desc: item.shortDesc || item.name || manualDesc || 'Factuurregel',
    qty: 1,
    unitPrice: amount,
    vatRate: Number(item.vatRate||21),
    amount: amount,
    note: ''
  }];
}
function summarizeInvoiceItem(item, lines){
  if(item && item.id!=='custom') return item.shortDesc || item.name;
  return (lines && lines[0] && lines[0].desc) ? lines[0].desc : 'Factuur';
}

var invDraftLines = [];
function invoiceDraftTotal(){
  return round2((invDraftLines||[]).reduce(function(sum, line){ return sum + Number(line.amount||0); }, 0));
}
function invoiceDraftTitle(){
  if(!invDraftLines.length) return 'Factuur';
  var pkg = invDraftLines.find(function(line){ return line.packageName; });
  if(pkg) return pkg.packageName;
  if(invDraftLines.length===1) return invDraftLines[0].desc || 'Factuur';
  return invDraftLines.length + ' regels op 1 factuur';
}
function renderInvoiceDraft(){
  var list = $('#invDraftList');
  var meta = $('#invDraftMeta');
  var totalEl = $('#invDraftTotal');
  if(!list || !meta || !totalEl) return;
  var lid = $('#invLearner').value;
  var l = learners.find(function(x){ return x.id===lid; });
  meta.textContent = invDraftLines.length
    ? ((l?l.name:'Leerling') + ' • ' + invDraftLines.length + ' regel' + (invDraftLines.length===1?'':'s'))
    : 'Nog geen regels toegevoegd.';
  totalEl.textContent = 'Totaal: ' + euro(invoiceDraftTotal());
  if(!invDraftLines.length){
    list.innerHTML = '<div class="dp-empty">Voeg hierboven een pakket, examen, TTT of losse regel toe.</div>';
    return;
  }
  list.innerHTML = invDraftLines.map(function(line, idx){
    return ''
      + '<div class="inv-draft-row">'
      +   '<div style="flex:1">'
      +     '<div class="title">'+escapeHtml(line.desc||'Factuurregel')+'</div>'
      +     '<div class="sub">Aantal: '+escapeHtml(String(line.qty==null?1:line.qty))+' • BTW: '+escapeHtml(invoiceVatLabel(line.vatRate))+(line.note?(' • '+escapeHtml(line.note)):'')+'</div>'
      +   '</div>'
      +   '<div style="display:flex;gap:8px;align-items:center">'
      +     '<div class="amt">'+euro(line.amount)+'</div>'
      +     '<button class="btn btn-ghost" type="button" data-draft-del="'+idx+'">Verwijder</button>'
      +   '</div>'
      + '</div>';
  }).join('');
}
function clearInvoiceDraft(){
  invDraftLines = [];
  renderInvoiceDraft();
}
function addCurrentInvoiceLineToDraft(){
  var itemId = $('#invItem').value;
  var item = INVOICE_ITEMS.find(function(x){return x.id===itemId;}) || null;
  var desc = ($('#invDesc').value||'').trim();
  var amount = parseFloat($('#invAmount').value);
  if(!desc){ alert('Vul een omschrijving in'); return false; }
  if(!(amount>=0)){ alert('Vul een geldig bedrag in'); return false; }
  var lines = buildInvoiceLinesFromItem(item, desc, amount);
  lines.forEach(function(line){ invDraftLines.push(line); });
  renderInvoiceDraft();
  toast('Regel toegevoegd aan factuur');
  return true;
}

function rebuildInvoiceItemOptions(){
  var groups = {};
  INVOICE_ITEMS.forEach(function(it){
    if(!groups[it.group]) groups[it.group]=[];
    groups[it.group].push(it);
  });
  var html='';
  Object.keys(groups).forEach(function(g){
    html+='<optgroup label="'+escapeHtml(g)+'">';
    groups[g].forEach(function(it){
      html+='<option value="'+it.id+'">'+escapeHtml(it.name)+'</option>';
    });
    html+='</optgroup>';
  });
  $('#invItem').innerHTML = html;
}

function invoiceYearFromDate(iso){
  var m = String(iso||'').match(/^(\d{4})-/);
  return m ? parseInt(m[1],10) : (new Date()).getFullYear();
}
function invoiceFormatNumber(year, seq){
  return String(year) + '-' + String(seq).padStart(3,'0');
}
function invoiceRebuildNumbersIfNeeded(){
  var maxByYear = {};
  var changed = false;
  invoices.forEach(function(inv){
    if(!Array.isArray(inv.schedule) || !inv.schedule.length){
      inv.schedule = [{k:1, due:inv.startDate||inv.createdAt||isoToday(), amount:inv.total||0, status:'open', sentAt:null, invoiceNumber:''}];
      changed = true;
    }
    inv.schedule.forEach(function(s){
      if(!s) return;
      if(s.invoiceNumber && /^\d{4}-\d{3,}$/.test(String(s.invoiceNumber))){
        var y = invoiceYearFromDate(String(s.invoiceNumber).replace(/^(\d{4}).*$/,'$1')+'-01-01');
        var seq = parseInt(String(s.invoiceNumber).split('-')[1],10) || 0;
        maxByYear[y] = Math.max(maxByYear[y]||0, seq);
      }else{
        if(s.invoiceNumber == null) s.invoiceNumber = '';
      }
    });
    inv.number = ((inv.schedule||[]).find(function(s){ return s && s.invoiceNumber; })||{}).invoiceNumber || '';
  });
  var currentYear = (new Date()).getFullYear();
  var state = (invCounter && typeof invCounter==='object') ? invCounter : {year: currentYear, seq: 0};
  state.year = currentYear;
  state.seq = Math.max(state.seq||0, maxByYear[currentYear]||0);
  invCounter = state;
  store.write(K.invCounter, invCounter);
  if(changed) store.write(K.invoices, invoices);
}

function ensureInvoiceNumberForTerm(invId, termIndex){
  var inv = invoices.find(function(x){return x.id===invId});
  if(!inv || !inv.schedule || !inv.schedule[termIndex]) return '';
  var sched = inv.schedule[termIndex];
  if(sched.invoiceNumber && /^\d{4}-\d{3,}$/.test(String(sched.invoiceNumber))) return sched.invoiceNumber;
  var num = invoiceNextNumber();
  sched.invoiceNumber = num;
  if(!inv.number) inv.number = num;
  store.write(K.invoices, invoices);
  return num;
}
function invoiceNextNumber(){
  var now = new Date();
  var year = now.getFullYear();
  var maxSeq = 0;
  invoices.forEach(function(inv){
    (inv.schedule||[]).forEach(function(s){
      var num = String((s && s.invoiceNumber) || '');
      var m = num.match(new RegExp('^'+year+'-(\d+)$'));
      if(m){ maxSeq = Math.max(maxSeq, parseInt(m[1],10)||0); }
    });
  });
  var state = (invCounter && typeof invCounter==='object') ? invCounter : {year:year, seq:0};
  if(state.year !== year) state = {year:year, seq:0};
  state.seq = Math.max(state.seq||0, maxSeq) + 1;
  invCounter = state;
  store.write(K.invCounter, invCounter);
  return invoiceFormatNumber(year, state.seq);
}
function splitIntoTerms(total, terms){
  total = Math.round(Number(total)*100)/100;
  terms = parseInt(terms,10)||1;
  if(terms<=1) return [total];
  var base = Math.floor((total/terms)*100)/100;
  var arr = [];
  for(var i=0;i<terms-1;i++) arr.push(base);
  var sum = arr.reduce(function(a,b){return a+b},0);
  var last = Math.round((total - sum)*100)/100;
  arr.push(last);
  return arr;
}
function invoiceStatusTag(inv, sched){
  var today = isoToday();
  if(sched.status==='paid') return '<span class="tag sent">Betaald</span>';
  if(sched.status==='sent') return '<span class="tag sent">Verzonden</span>';
  if(sched.due < today) return '<span class="tag late">Te laat</span>';
  return '<span class="tag due">Te versturen</span>';
}
function openInvoicePrintWindow(invId, termIndex){
  var inv = invoices.find(function(x){return x.id===invId});
  if(!inv) return;
  var l = learners.find(function(x){return x.id===inv.learnerId});
  var learnerName = l?l.name:'';
  var learnerEmail = l?l.email:'';
  var learnerPhone = l?l.phone:'';

  var sched = inv.schedule && inv.schedule[termIndex] ? inv.schedule[termIndex] : null;
  if(sched){ ensureInvoiceNumberForTerm(invId, termIndex); }
  sched = inv.schedule && inv.schedule[termIndex] ? inv.schedule[termIndex] : null;
  var dueDate = sched ? sched.due : inv.startDate;
  var amountDue = sched ? sched.amount : inv.total;
  var termLabel = sched ? ('Termijn '+(sched.k)+'/'+inv.terms) : 'Factuur';
  var displayNumber = (sched && sched.invoiceNumber) ? sched.invoiceNumber : (inv.number||'');

  var co = company || {};
  var coLines = [];
  if(co.name) coLines.push('<b>'+escapeHtml(co.name)+'</b>');
  if(co.address) coLines.push(escapeHtml(co.address));
  if(co.phone) coLines.push('Tel: '+escapeHtml(co.phone));
  if(co.email) coLines.push('E-mail: '+escapeHtml(co.email));
  if(co.kvk) coLines.push('KVK: '+escapeHtml(co.kvk));
  if(co.vat) coLines.push('BTW: '+escapeHtml(co.vat));
  if(co.iban) coLines.push('IBAN: '+escapeHtml(co.iban));

  var totals = invoiceTotals(inv.lines||[]);
  var packageText = inv.packageName || (((inv.lines||[]).find(function(line){ return line.packageName; })||{}).packageName || '');
  var linesHtml = (inv.lines||[]).map(function(line){
    var qty = (line.qty==null || line.qty==='') ? '—' : escapeHtml(String(line.qty));
    var vat = invoiceVatLabel(line.vatRate);
    var calc = invoiceCalcLine(line);
    var unitGross = (line.qty && Number(line.qty)!==0) ? round2(calc.gross / Number(line.qty)) : calc.gross;
    var note = line.note ? '<div class="muted" style="font-size:12px;margin-top:3px">'+escapeHtml(line.note)+'</div>' : '';
    return '<tr>'
      + '<td>'+escapeHtml(line.desc)+note+'</td>'
      + '<td class="right">'+qty+'</td>'
      + '<td class="right">'+euro(unitGross)+'</td>'
      + '<td class="right">'+escapeHtml(vat)+'</td>'
      + '<td class="right">'+euro(calc.net)+'</td>'
      + '<td class="right">'+euro(calc.vat)+'</td>'
      + '<td class="right"><b>'+euro(calc.gross)+'</b></td>'
      + '</tr>';
  }).join('');

  var vatBreakdownRows = Object.keys(totals.byRate).sort(function(a,b){return Number(a)-Number(b);}).map(function(key){
    var row = totals.byRate[key];
    var label = row.rate===0 ? 'BTW 0% / vrijgesteld' : ('BTW ' + invoiceVatLabel(row.rate));
    return '<tr>'
      + '<td>'+escapeHtml(label)+'</td>'
      + '<td class="right">'+euro(row.net)+'</td>'
      + '<td class="right">'+euro(row.vat)+'</td>'
      + '<td class="right">'+euro(row.gross)+'</td>'
      + '</tr>';
  }).join('');

  var html = `
<!DOCTYPE html>
<html lang="nl"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Factuur ${displayNumber}</title>
<style>
  body{font-family:Arial,system-ui,sans-serif;margin:24px;color:#111827}
  .top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
  .brand{font-size:22px;font-weight:900;color:#004080;margin-bottom:6px}
  .muted{color:#6b7280}
  .box{border:1px solid #e5e7eb;border-radius:12px;padding:14px}
  table{width:100%;border-collapse:collapse;margin-top:14px}
  th,td{padding:10px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  th{background:#f5f7fa;text-align:left}
  .right{text-align:right}
  .big{font-size:20px;font-weight:900}
  .note{margin-top:14px;padding:12px;border:1px dashed #cbd5e1;border-radius:12px;background:#fafafa}
  .actions{margin-top:14px;display:flex;gap:10px;flex-wrap:wrap}
  button{border:0;border-radius:10px;padding:10px 12px;cursor:pointer}
  .p{background:#004080;color:#fff}
  .g{background:#f3f4f6}
  .summary{margin-top:14px;display:grid;grid-template-columns:1.15fr .85fr;gap:12px}
  .summary table{margin-top:0}
  @media print {.actions{display:none}}
</style>
</head>
<body>
  <div class="top">
    <div>
      ${currentBrandLogoHtml(40)}<div class="brand">${escapeHtml(currentBrandName())} • Factuur</div>
      <div class="muted">Factuurnummer: <b>${displayNumber}</b> • ${termLabel}</div>
      <div class="muted">Factuurdatum: <b>${inv.createdAt}</b> • Vervaldatum: <b>${dueDate}</b> • Betaaltermijn: <b>${escapeHtml(String(co.paymentDays||14))} dagen</b></div>
    </div>
    <div class="box" style="min-width:280px">
      ${coLines.join('<br>') || '<b>(vul je bedrijfsgegevens in bij Facturen → Instellingen)</b>'}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px">
    <div class="box">
      <b>Factuur aan</b><br>
      ${escapeHtml(learnerName)}<br>
      <span class="muted">${escapeHtml(learnerEmail||'')}</span><br>
      <span class="muted">${escapeHtml(learnerPhone||'')}</span>
    </div>
    <div class="box">
      <b>Te betalen</b><br>
      <div class="big">${euro(amountDue)}</div>
      <div class="muted">Betaling: ${inv.terms} termijnen</div>
      <div class="muted">Factuurtotaal incl. btw: ${euro(inv.total)}</div>
    </div>
  </div>

  <table>
    <thead><tr><th>Omschrijving</th><th class="right">Aantal</th><th class="right">Prijs p/st incl.</th><th class="right">BTW</th><th class="right">Excl. btw</th><th class="right">BTW-bedrag</th><th class="right">Incl. btw</th></tr></thead>
    <tbody>
      ${linesHtml}
    </tbody>
  </table>

  <div class="summary">
    <div class="box">
      <b>BTW-specificatie</b>
      <table>
        <thead><tr><th>Tarief</th><th class="right">Excl. btw</th><th class="right">BTW</th><th class="right">Incl. btw</th></tr></thead>
        <tbody>
          ${vatBreakdownRows}
        </tbody>
      </table>
    </div>
    <div class="box">
      <table>
        <tbody>
          <tr><td>Subtotaal excl. btw</td><td class="right"><b>${euro(totals.net)}</b></td></tr>
          <tr><td>Totaal btw</td><td class="right"><b>${euro(totals.vat)}</b></td></tr>
          <tr><td>Totaal incl. btw</td><td class="right"><b>${euro(totals.gross)}</b></td></tr>
          <tr><td>${termLabel} te betalen</td><td class="right"><b>${euro(amountDue)}</b></td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="note">
    ${packageText ? ('<b>Pakket:</b> '+escapeHtml(packageText)+'<br><br>') : ''}
    <b>Betalingsinstructie</b><br>
    Gelieve dit bedrag binnen ${escapeHtml(String(co.paymentDays||14))} dagen over te maken${co.iban ? (' op IBAN <b>'+escapeHtml(co.iban)+'</b>') : ''}${co.accountName ? (' t.n.v. <b>'+escapeHtml(co.accountName)+'</b>') : ''}.<br>${escapeHtml(co.paymentText||'Onder vermelding van het factuurnummer.')}<br><br>Deze factuur toont bedragen exclusief btw, btw-bedrag en inclusief btw per regel. Gebruik Print → Opslaan als PDF om hem netjes te versturen.
  </div>

  <div class="actions">
    <button class="p" id="invoicePrintBtn" type="button">Print / Opslaan als PDF</button>
    <button class="g" id="invoiceShareBtn" type="button">Delen (Android)</button>
    <button class="g" id="invoiceCloseBtn" type="button">Sluiten</button>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', function(){
      var p = document.getElementById('invoicePrintBtn');
      var s = document.getElementById('invoiceShareBtn');
      var c = document.getElementById('invoiceCloseBtn');
      if(p) p.addEventListener('click', function(){ window.print(); });
      if(s) s.addEventListener('click', function(){
        if(navigator.share){
          navigator.share({title:'Factuur ${displayNumber}', text:'Factuur ${displayNumber} – ${termLabel} – ${euro(amountDue)}', url:location.href}).catch(function(){});
        } else {
          alert('Delen niet beschikbaar in deze browser. Gebruik Print → Opslaan als PDF.');
        }
      });
      if(c) c.addEventListener('click', function(){ window.close(); });
    });
  <\/script>

</body></html>`;
  var w = window.open('', '_blank');
  if(!w){ alert('Pop-up geblokkeerd. Sta pop-ups toe voor deze site.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
function markInvoiceTermSent(invId, termIndex){
  var inv = invoices.find(function(x){return x.id===invId});
  if(!inv || !inv.schedule || !inv.schedule[termIndex]) return;
  ensureInvoiceNumberForTerm(invId, termIndex);
  inv = invoices.find(function(x){return x.id===invId});
  inv.schedule[termIndex].status='sent';
  inv.schedule[termIndex].sentAt=new Date().toISOString().slice(0,10);
  store.write(K.invoices, invoices);
  renderInvoices();
  if(document.getElementById('modalLearnerInvoices') && document.getElementById('modalLearnerInvoices').style.display==='flex' && window.currentLearnerInvoiceId){
    openLearnerInvoicesModal(window.currentLearnerInvoiceId);
  }
  toast('Gemarkeerd als verzonden');
}
function markInvoiceTermPaid(invId, termIndex){
  var inv = invoices.find(function(x){return x.id===invId});
  if(!inv || !inv.schedule || !inv.schedule[termIndex]) return;
  ensureInvoiceNumberForTerm(invId, termIndex);
  inv = invoices.find(function(x){return x.id===invId});
  inv.schedule[termIndex].status='paid';
  inv.schedule[termIndex].paidAt=new Date().toISOString().slice(0,10);
  if(!inv.schedule[termIndex].sentAt) inv.schedule[termIndex].sentAt = inv.schedule[termIndex].paidAt;
  store.write(K.invoices, invoices);
  renderInvoices();
  if(document.getElementById('modalLearnerInvoices') && document.getElementById('modalLearnerInvoices').style.display==='flex' && window.currentLearnerInvoiceId){
    openLearnerInvoicesModal(window.currentLearnerInvoiceId);
  }
  toast('Gemarkeerd als betaald');
}
function markInvoiceTermOpen(invId, termIndex){
  var inv = invoices.find(function(x){return x.id===invId});
  if(!inv || !inv.schedule || !inv.schedule[termIndex]) return;
  inv.schedule[termIndex].status='open';
  inv.schedule[termIndex].paidAt=null;
  store.write(K.invoices, invoices);
  renderInvoices();
  if(document.getElementById('modalLearnerInvoices') && document.getElementById('modalLearnerInvoices').style.display==='flex' && window.currentLearnerInvoiceId){
    openLearnerInvoicesModal(window.currentLearnerInvoiceId);
  }
  toast('Teruggezet naar open');
}
function closeLearnerInvoicesModal(){
  var m = document.getElementById('modalLearnerInvoices');
  if(m) m.style.display='none';
}
function openLearnerInvoicesModal(lid){
  window.currentLearnerInvoiceId = lid;
  var learner = learners.find(function(x){ return x.id===lid; }) || {};
  var body = document.getElementById('liBody');
  var title = document.getElementById('liTitle');
  var modal = document.getElementById('modalLearnerInvoices');
  if(title) title.textContent = 'Facturen • ' + (learner.name || 'Leerling');
  if(!body || !modal) return;

  var rows = invoices.filter(function(inv){ return inv.learnerId===lid; }).slice().sort(function(a,b){
    return String(b.createdAt||'').localeCompare(String(a.createdAt||''));
  });

  if(!rows.length){
    body.innerHTML = '<div class="small">Nog geen facturen voor deze leerling.</div>';
    modal.style.display='flex';
    return;
  }

  body.innerHTML = rows.map(function(inv){
    var terms = (inv.schedule||[]).map(function(sched, idx){
      var sentTxt = sched.sentAt ? ('Verzonden: ' + sched.sentAt) : 'Nog niet verzonden';
      var paidTxt = sched.paidAt ? (' • Betaald: ' + sched.paidAt) : '';
      var nextTxt = 'Vervalt: ' + sched.due;
      var payBtn = sched.status==='paid'
        ? '<button class="btn btn-ghost" data-li-act="unpay" data-inv="'+escapeHtml(inv.id)+'" data-term="'+idx+'">Onbetaald</button>'
        : '<button class="btn btn-primary" data-li-act="paid" data-inv="'+escapeHtml(inv.id)+'" data-term="'+idx+'">Betaald</button>';
      var sentBtn = sched.status==='open'
        ? '<button class="btn btn-ghost" data-li-act="sent" data-inv="'+escapeHtml(inv.id)+'" data-term="'+idx+'">Verzonden</button>'
        : '';
      return ''
      + '<div class="invoice-term">'
      +   '<div class="left">'
      +     '<div><b>Termijn ' + sched.k + '/' + inv.terms + '</b> • ' + euro(sched.amount) + '</div>'
      +     '<div class="small">' + nextTxt + ' • ' + sentTxt + paidTxt + '</div>'
      +   '</div>'
      +   '<div class="right">'
      +     invoiceStatusTag(inv, sched)
      +     '<button class="btn btn-ghost" data-li-act="open" data-inv="'+escapeHtml(inv.id)+'" data-term="'+idx+'">Open</button>'
      +     sentBtn
      +     payBtn
      +   '</div>'
      + '</div>';
    }).join('');
    return ''
    + '<div class="invoice-mini">'
    +   '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">'
    +     '<div>'
    +       '<h4>Factuur #' + escapeHtml(String(inv.number)) + '</h4>'
    +       '<div class="small">' + escapeHtml(inv.desc||'') + '</div>'
    +       '<div class="small">Aangemaakt: ' + escapeHtml(inv.createdAt||'') + ' • Totaal: <b>' + euro(inv.total||0) + '</b></div>'
    +     '</div>'
    +     '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +       '<button class="btn btn-ghost" data-li-act="delete" data-inv="'+escapeHtml(inv.id)+'">Verwijder factuur</button>'
    +     '</div>'
    +   '</div>'
    +   '<div style="margin-top:6px">' + terms + '</div>'
    + '</div>';
  }).join('');
  modal.style.display='flex';
}
function deleteInvoice(invId){
  var inv = invoices.find(function(x){return x.id===invId});
  if(!inv) return;
  if(!confirm('Factuur #' + inv.number + ' verwijderen? Dit verwijdert alle termijnen van deze factuur.')) return;
  invoices = invoices.filter(function(x){ return x.id !== invId; });
  store.write(K.invoices, invoices);
  renderInvoices();
  toast('Factuur verwijderd');
}

function invoiceTermCalc(inv, sched){
  var gross = round2(Number(sched && sched.amount || 0));
  var totals = invoiceTotals((inv && inv.lines) || []);
  if(!(totals.gross>0) || !(gross>0)) return {gross:gross, net:gross, vat:0};
  var ratio = gross / totals.gross;
  var net = round2(totals.net * ratio);
  var vat = round2(gross - net);
  return {gross:gross, net:net, vat:vat};
}
function renderInvoiceRevenue(){
  var mode = invRevenueMode === 'week' ? 'week' : 'month';
  var start = mode==='week' ? mondayOfWeek(invRevenuePeriodStart) : new Date(invRevenuePeriodStart.getFullYear(), invRevenuePeriodStart.getMonth(), 1);
  var end = mode==='week' ? addDays(start, 6) : new Date(start.getFullYear(), start.getMonth()+1, 0);
  var startISO = isoFromDateLocal(start);
  var endISO = isoFromDateLocal(end);
  var gross = 0, vat = 0, openGross = 0, yearGross = 0;

  invoices.forEach(function(inv){
    (inv.schedule||[]).forEach(function(sched){
      if(!sched || !sched.due) return;
      var due = String(sched.due);
      var parts = due.split('-');
      var y = parseInt(parts[0]||'0',10);
      var calc = invoiceTermCalc(inv, sched);
      if(y===start.getFullYear()) yearGross = round2(yearGross + calc.gross);
      if(due >= startISO && due <= endISO){
        gross = round2(gross + calc.gross);
        vat = round2(vat + calc.vat);
      }
      if(sched.status!=='paid') openGross = round2(openGross + calc.gross);
    });
  });

  if($('#invRevenueMonthGross')) $('#invRevenueMonthGross').textContent = euro(gross);
  if($('#invRevenueMonthVat')) $('#invRevenueMonthVat').textContent = euro(vat);
  if($('#invRevenueOpen')) $('#invRevenueOpen').textContent = euro(openGross);
  if($('#invRevenueYearGross')) $('#invRevenueYearGross').textContent = euro(yearGross);

  var periodLabel = 'Deze maand';
  var grossLabel = mode==='week' ? 'Facturen deze week' : 'Facturen deze maand';
  var vatLabel = mode==='week' ? 'BTW deze week' : 'BTW deze maand';
  var yearLabel = 'Facturen dit jaar';
  if(mode==='week'){
    periodLabel = 'Week ' + pad2(isoWeekNumber(start)) + ' • ' + fmtHead(start) + ' – ' + fmtHead(end);
  }else{
    try{ periodLabel = start.toLocaleDateString('nl-NL',{month:'long', year:'numeric'}); }
    catch(e){ periodLabel = 'Deze maand'; }
  }
  if($('#invRevenuePeriodLabel')) $('#invRevenuePeriodLabel').textContent = periodLabel;
  if($('#invRevenueGrossLabel')) $('#invRevenueGrossLabel').textContent = grossLabel;
  if($('#invRevenueVatLabel')) $('#invRevenueVatLabel').textContent = vatLabel;
  if($('#invRevenueYearLabel')) $('#invRevenueYearLabel').textContent = yearLabel;
  if($('#invRevenueMode')) $('#invRevenueMode').value = mode;
}

function shiftInvoiceRevenuePeriod(step){
  if(invRevenueMode==='week') invRevenuePeriodStart = mondayOfWeek(addDays(invRevenuePeriodStart, step*7));
  else invRevenuePeriodStart = new Date(invRevenuePeriodStart.getFullYear(), invRevenuePeriodStart.getMonth()+step, 1);
  store.write(K.invRevenuePeriod, isoFromDateLocal(invRevenuePeriodStart));
  renderInvoiceRevenue();
}

function setInvoiceRevenueMode(mode){
  invRevenueMode = mode === 'week' ? 'week' : 'month';
  invRevenuePeriodStart = invRevenueMode==='week' ? mondayOfWeek(invRevenuePeriodStart) : new Date(invRevenuePeriodStart.getFullYear(), invRevenuePeriodStart.getMonth(), 1);
  store.write(K.invRevenueMode, invRevenueMode);
  store.write(K.invRevenuePeriod, isoFromDateLocal(invRevenuePeriodStart));
  renderInvoiceRevenue();
}

function renderRentalWeek(){
  var lbl = $('#rentalWeekLabel');
  var list = $('#rentalList');
  if(!lbl || !list) return;
  var start = mondayOfWeek(rentalWeekStart);
  var end = addDays(start, 6);
  var startISO = isoFromDateLocal(start);
  var endISO = isoFromDateLocal(end);

  if(lbl) lbl.textContent = 'Week ' + pad2(isoWeekNumber(start)) + ' • ' + fmtHead(start) + ' – ' + fmtHead(end);
  var rateShown = Number(company && company.preekerRate ? company.preekerRate : 42.56);
  if($('#preekerRateLabel')) $('#preekerRateLabel').textContent = euro(rateShown) + ' ex btw per uur';

  var rows = lessons.filter(function(ev){
    if(!ev || !ev.learnerId || !ev.date) return false;
    if(ev.date < startISO || ev.date > endISO) return false;
    if(ev.type==='private' || ev.type==='exam') return false;
    var l = learners.find(function(x){ return x.id===ev.learnerId; });
    return l && (l.source||'own')==='preeker';
  }).slice().sort(function(a,b){
    var da = String(a.date||'') + ' ' + String(a.time||'');
    var db = String(b.date||'') + ' ' + String(b.time||'');
    return da.localeCompare(db);
  });

  var totalMinutes = rows.reduce(function(sum, ev){ return sum + Number(ev.duration||0); }, 0);
  var hours = round2(totalMinutes / 60);
  var rate = Number(company && company.preekerRate ? company.preekerRate : 42.56);
  var ex = round2(hours * rate);
  var vat = round2(ex * 0.21);
  var inc = round2(ex + vat);

  if($('#rentalHours')) $('#rentalHours').textContent = hours.toLocaleString('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:2}) + ' uur';
  if($('#rentalEx')) $('#rentalEx').textContent = euro(ex);
  if($('#rentalVat')) $('#rentalVat').textContent = euro(vat);
  if($('#rentalInc')) $('#rentalInc').textContent = euro(inc);

  if(!rows.length){
    list.innerHTML = '<div class="dp-empty">Geen Preeker-lessen gevonden in deze week.</div>';
    return;
  }

  list.innerHTML = rows.map(function(ev){
    var l = learners.find(function(x){ return x.id===ev.learnerId; }) || {};
    var exRow = round2((Number(ev.duration||0) / 60) * rate);
    return ''
      + '<div class="rental-row">'
      +   '<div class="left">'
      +     '<div><b>' + escapeHtml(ev.date) + ' • ' + escapeHtml(ev.time||'') + '</b> • ' + escapeHtml(l.name||'Onbekend') + '</div>'
      +     '<div class="small">' + escapeHtml((ev.type==='trial'?'Proefles':'Rijles')) + ' • ' + escapeHtml(String(ev.duration||0)) + ' min</div>'
      +   '</div>'
      +   '<div class="right">'
      +     '<div>' + euro(exRow) + ' ex</div>'
      +     '<div class="small">' + ((Number(ev.duration||0)/60).toLocaleString('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:2})) + ' uur</div>'
      +   '</div>'
      + '</div>';
  }).join('');
}
function renderInvoices(){
  var invStartEl = $('#invStart');
  var dueEl=$('#invDueList');
  var sentEl=$('#invSentList');
  if(!invStartEl || !dueEl || !sentEl) return;
  rebuildLearnerOptions();
  rebuildInvoiceItemOptions();
  if(!invStartEl.value) invStartEl.value = isoToday();
  renderInvoiceDraft();
  renderInvoiceRevenue();
  renderRentalWeek();

  var dueRows=[];
  var sentRows=[];

  invoices.forEach(function(inv){
    (inv.schedule||[]).forEach(function(sched, idx){
      var l=learners.find(function(x){return x.id===inv.learnerId});
      var nm=l?l.name:'Onbekend';
      var line = `
        <div class="row" style="align-items:center">
          <div style="flex:1">
            <div style="font-weight:900">${escapeHtml(nm)} • <span class="mono">#${escapeHtml(((sched&&sched.invoiceNumber)||inv.number||'Nog niet genummerd'))}</span></div>
            <div class="small">${escapeHtml(inv.desc)} • Termijn ${sched.k}/${inv.terms} • Vervalt: <b>${sched.due}</b> • ${euro(sched.amount)}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${invoiceStatusTag(inv,sched)}
            <button class="btn btn-ghost" data-inv="${inv.id}" data-term="${idx}" data-act="open">Open</button>
            ${sched.status==='open' ? `<button class="btn btn-primary" data-inv="${inv.id}" data-term="${idx}" data-act="sent">Verzonden</button>` : ''}
            ${sched.status==='paid' ? '' : `<button class="btn btn-ghost" data-inv="${inv.id}" data-term="${idx}" data-act="paid">Betaald</button>`}
            ${sched.status==='paid' ? `<button class="btn btn-ghost" data-inv="${inv.id}" data-term="${idx}" data-act="unpay">Onbetaald</button>` : ''}
            <button class="btn btn-ghost" data-inv="${inv.id}" data-term="${idx}" data-act="delete">Verwijder</button>
          </div>
        </div>
      `;
      if(sched.status==='open') dueRows.push(line);
      else sentRows.push(line);
    });
  });

  if(!dueRows.length) dueEl.innerHTML='<div class="small">Geen openstaande facturen. Maak er één aan links.</div>';
  else dueEl.innerHTML=dueRows.join('');
  if(!sentRows.length) sentEl.innerHTML='<div class="small">Nog niets gemarkeerd als verzonden.</div>';
  else sentEl.innerHTML=sentRows.join('');
}
function setInvoiceFormFromItemId(id){
  var it = INVOICE_ITEMS.find(function(x){return x.id===id});
  if(!it) return;
  if(it.id==='custom'){
    $('#invDesc').value='';
    $('#invAmount').value='';
    return;
  }
  $('#invDesc').value = it.shortDesc || it.name;
  $('#invAmount').value = it.amount;
}

/* ===== Pakketbeheer ===== */
var modalPackages = $('#modalPackages');
var pkgEditingId = null;
function packageItems(){
  return INVOICE_ITEMS.filter(function(it){ return it.group==='Pakketten'; }).sort(function(a,b){ return (a.name||'').localeCompare((b.name||''),'nl'); });
}
function openPackagesModal(){
  renderPackages();
  clearPackageForm();
  modalPackages.style.display='flex';
}
function closePackagesModal(){ modalPackages.style.display='none'; }
function updatePackageExamFields(){
  var examIncluded = $('#pkgExamIncluded').value==='yes';
  var examAmountEl = $('#pkgExamAmount');
  var examCbrEl = $('#pkgExamCbrAmount');
  var examServiceEl = $('#pkgExamServiceAmount');
  if(examAmountEl) examAmountEl.disabled = !examIncluded;
  if(examCbrEl) examCbrEl.disabled = !examIncluded;
  if(examServiceEl) examServiceEl.disabled = true;
  var examAmount = round2(parseFloat(examAmountEl && examAmountEl.value) || 0);
  var examCbrAmount = round2(parseFloat(examCbrEl && examCbrEl.value) || 0);
  if(examCbrAmount > examAmount) examCbrAmount = examAmount;
  if(examCbrEl && String(examCbrEl.value).trim() !== '' && examIncluded) examCbrEl.value = examCbrAmount.toFixed(2);
  var examServiceAmount = examIncluded ? round2(examAmount - examCbrAmount) : 0;
  if(examServiceEl) examServiceEl.value = examServiceAmount.toFixed(2);
}
function clearPackageForm(){
  pkgEditingId = null;
  $('#pkgTitle').textContent = 'Nieuw pakket';
  $('#pkgName').value = '';
  $('#pkgShort').value = '';
  $('#pkgLessons').value = '';
  $('#pkgMinutes').value = '60';
  $('#pkgAmount').value = '';
  $('#pkgVat').value = '21';
  $('#pkgExamIncluded').value = 'no';
  $('#pkgExamAmount').value = '285.00';
  $('#pkgExamCbrAmount').value = '143.50';
  $('#pkgExamServiceAmount').value = '141.50';
  $('#pkgDelete').style.display = 'none';
  updatePackageExamFields();
}
function renderPackages(){
  var list = $('#pkgList');
  var items = packageItems();
  if(!items.length){
    list.innerHTML = '<div class="small">Nog geen pakketten. Klik op “+ Pakket”.</div>';
    return;
  }
  list.innerHTML = items.map(function(it){
    return ''
      + '<div class="row">'
      +   '<div>'
      +     '<h4>'+escapeHtml(it.name||'Pakket')+'</h4>'
      +     '<div class="meta">'+escapeHtml(String(it.lessonCount||0))+' lessen • '+escapeHtml(String(it.lessonMinutes||60))+' min • '+euro(it.amount||0)+' • Examen '+((it.examIncluded)?('inbegrepen ('+euro(it.examAmount||0)+', CBR '+euro(it.examCbrAmount||0)+', jouw deel '+euro(it.examServiceAmount||0)+')'):'niet inbegrepen')+'</div>'
      +   '</div>'
      +   '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +     '<button class="btn btn-ghost" type="button" data-pkg-edit="'+escapeHtml(it.id)+'">Bewerken</button>'
      +     '<button class="btn btn-danger" type="button" data-pkg-del="'+escapeHtml(it.id)+'">Verwijderen</button>'
      +   '</div>'
      + '</div>';
  }).join('');
}
function editPackage(id){
  var it = INVOICE_ITEMS.find(function(x){ return x.id===id; });
  if(!it) return;
  pkgEditingId = id;
  $('#pkgTitle').textContent = 'Pakket bewerken';
  $('#pkgName').value = it.name||'';
  $('#pkgShort').value = it.shortDesc||'';
  $('#pkgLessons').value = it.lessonCount||'';
  $('#pkgMinutes').value = it.lessonMinutes||60;
  $('#pkgAmount').value = it.amount||'';
  $('#pkgVat').value = String(it.vatRate==null?21:it.vatRate);
  $('#pkgExamIncluded').value = it.examIncluded ? 'yes' : 'no';
  $('#pkgExamAmount').value = round2(it.examAmount!=null?it.examAmount:285).toFixed(2);
  $('#pkgExamCbrAmount').value = round2(it.examCbrAmount!=null?it.examCbrAmount:143.5).toFixed(2);
  $('#pkgDelete').style.display = 'inline-block';
  updatePackageExamFields();
}
function savePackage(){
  var name = ($('#pkgName').value||'').trim();
  var shortDesc = ($('#pkgShort').value||'').trim() || name;
  var lessonCount = parseInt($('#pkgLessons').value,10)||0;
  var lessonMinutes = parseInt($('#pkgMinutes').value,10)||60;
  var amount = round2(parseFloat($('#pkgAmount').value));
  var vatRate = Number($('#pkgVat').value||21);
  var examIncluded = $('#pkgExamIncluded').value==='yes';
  var examAmount = round2(parseFloat($('#pkgExamAmount').value)||0);
  var examCbrAmount = round2(parseFloat($('#pkgExamCbrAmount').value)||0);
  if(examCbrAmount > examAmount) examCbrAmount = examAmount;
  var examServiceAmount = examIncluded ? round2(examAmount - examCbrAmount) : 0;
  if(!name){ alert('Vul een pakketnaam in'); return; }
  if(lessonCount<=0){ alert('Vul een geldig aantal lessen in'); return; }
  if(!(amount>=0)){ alert('Vul een geldig totaalbedrag in'); return; }
  if(examIncluded && examAmount > amount){ alert('Examenbedrag kan niet hoger zijn dan het pakketbedrag'); return; }
  var obj = {
    id: pkgEditingId || ('pkg_'+uid().slice(0,8)),
    group:'Pakketten',
    name:name,
    shortDesc:shortDesc,
    lessonCount:lessonCount,
    lessonMinutes:lessonMinutes,
    examIncluded:examIncluded,
    examAmount:examIncluded ? examAmount : 0,
    examCbrAmount:examIncluded ? examCbrAmount : 0,
    examServiceAmount:examIncluded ? examServiceAmount : 0,
    amount:amount,
    vatRate:vatRate
  };
  var idx = INVOICE_ITEMS.findIndex(function(x){ return x.id===obj.id; });
  if(idx>=0) INVOICE_ITEMS[idx] = Object.assign({}, INVOICE_ITEMS[idx], obj);
  else INVOICE_ITEMS.unshift(obj);
  saveInvoiceItems();
  rebuildInvoiceItemOptions();
  renderPackages();
  clearPackageForm();
  toast('Pakket opgeslagen');
}
function deletePackage(id){
  var it = INVOICE_ITEMS.find(function(x){ return x.id===id; });
  if(!it) return;
  if(!confirm('Pakket "'+(it.name||'')+'" verwijderen?')) return;
  INVOICE_ITEMS = INVOICE_ITEMS.filter(function(x){ return x.id!==id; });
  saveInvoiceItems();
  rebuildInvoiceItemOptions();
  renderPackages();
  if(pkgEditingId===id) clearPackageForm();

  toast('Pakket verwijderd');
}

/* ===== Productbeheer ===== */
var modalProducts = $('#modalProducts');
var prodEditingId = null;
function productItems(){
  return INVOICE_ITEMS.filter(function(it){ return it.group!=='Pakketten'; }).sort(function(a,b){
    return ((a.group||'')+' '+(a.name||'')).localeCompare(((b.group||'')+' '+(b.name||'')),'nl');
  });
}
function openProductsModal(){
  renderProducts();
  clearProductForm();
  if(modalProducts) modalProducts.style.display='flex';
}
function closeProductsModal(){ if(modalProducts) modalProducts.style.display='none'; }
function updateProductExamFields(){
  var examOnly = $('#prodExamOnly').value==='yes';
  var split = $('#prodExamSplit');
  var vatEl = $('#prodVat');
  var cbrEl = $('#prodExamCbrAmount');
  var serviceEl = $('#prodExamServiceAmount');
  var amountEl = $('#prodAmount');
  if(split) split.style.display = examOnly ? 'block' : 'none';
  if(vatEl && examOnly) vatEl.value = '21';
  var amount = round2(parseFloat(amountEl && amountEl.value) || 0);
  var cbr = round2(parseFloat(cbrEl && cbrEl.value) || 0);
  if(cbr > amount) cbr = amount;
  if(cbrEl && String(cbrEl.value).trim() !== '' && examOnly) cbrEl.value = cbr.toFixed(2);
  var service = examOnly ? round2(amount - cbr) : 0;
  if(serviceEl) serviceEl.value = service.toFixed(2);
}
function clearProductForm(){
  prodEditingId = null;
  $('#prodTitle').textContent = 'Nieuw product';
  $('#prodName').value = '';
  $('#prodShort').value = '';
  $('#prodGroup').value = 'Los / Aanvulling';
  $('#prodAmount').value = '';
  $('#prodVat').value = '21';
  $('#prodExamOnly').value = 'no';
  $('#prodExamCbrAmount').value = '';
  $('#prodExamServiceAmount').value = '0.00';
  $('#prodDelete').style.display = 'none';
  updateProductExamFields();
}
function renderProducts(){
  var list = $('#prodList');
  if(!list) return;
  var items = productItems();
  if(!items.length){
    list.innerHTML = '<div class="small">Nog geen producten. Klik op “+ Product”.</div>';
    return;
  }
  list.innerHTML = items.map(function(it){
    return ''
      + '<div class="row">'
      +   '<div>'
      +     '<h4>'+escapeHtml(it.name||'Product')+'</h4>'
      +     '<div class="meta">'+escapeHtml(it.group||'Overig')+' • '+euro(it.amount||0)+' • BTW '+escapeHtml(String(it.vatRate==null?21:it.vatRate))+'%'+(it.examOnly?' • Examenproduct':'')+(it.examOnly && Number(it.examCbrAmount||0)>0 ? (' • CBR '+euro(it.examCbrAmount||0)) : '')+'</div>'
      +   '</div>'
      +   '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +     '<button class="btn btn-ghost" type="button" data-prod-edit="'+escapeHtml(it.id)+'">Bewerken</button>'
      +     '<button class="btn btn-danger" type="button" data-prod-del="'+escapeHtml(it.id)+'">Verwijderen</button>'
      +   '</div>'
      + '</div>';
  }).join('');
}
function editProduct(id){
  var it = INVOICE_ITEMS.find(function(x){ return x.id===id; });
  if(!it || it.group==='Pakketten') return;
  prodEditingId = id;
  $('#prodTitle').textContent = 'Product bewerken';
  $('#prodName').value = it.name||'';
  $('#prodShort').value = it.shortDesc||'';
  $('#prodGroup').value = it.group||'Los / Aanvulling';
  $('#prodAmount').value = it.amount||'';
  $('#prodVat').value = String(it.vatRate==null?21:it.vatRate);
  $('#prodExamOnly').value = it.examOnly ? 'yes' : 'no';
  $('#prodExamCbrAmount').value = it.examCbrAmount != null ? it.examCbrAmount : '';
  $('#prodExamServiceAmount').value = (it.examServiceAmount != null ? it.examServiceAmount : round2((it.amount||0) - (it.examCbrAmount||0))).toFixed(2);
  $('#prodDelete').style.display = 'inline-block';
  updateProductExamFields();
}
function saveProduct(){
  var name = ($('#prodName').value||'').trim();
  var shortDesc = ($('#prodShort').value||'').trim() || name;
  var group = $('#prodGroup').value||'Overig';
  var amount = round2(parseFloat($('#prodAmount').value));
  var vatRate = Number($('#prodVat').value||21);
  var examOnly = $('#prodExamOnly').value==='yes';
  var examCbrAmount = round2(parseFloat($('#prodExamCbrAmount').value) || 0);
  if(examCbrAmount > amount) examCbrAmount = amount;
  var examServiceAmount = examOnly ? round2(amount - examCbrAmount) : 0;
  if(!name){ alert('Vul een productnaam in'); return; }
  if(!(amount>=0)){ alert('Vul een geldig bedrag in'); return; }
  if(examOnly && examCbrAmount > amount){ alert('CBR-deel kan niet hoger zijn dan totaalbedrag'); return; }
  var obj = {
    id: prodEditingId || ('prod_'+uid().slice(0,8)),
    group: group,
    name: name,
    shortDesc: shortDesc,
    amount: amount,
    vatRate: examOnly ? 21 : vatRate,
    examOnly: examOnly,
    examAmount: examOnly ? amount : undefined,
    examCbrAmount: examOnly ? examCbrAmount : 0,
    examServiceAmount: examOnly ? examServiceAmount : 0
  };
  var idx = INVOICE_ITEMS.findIndex(function(x){ return x.id===obj.id; });
  if(idx>=0) INVOICE_ITEMS[idx] = Object.assign({}, INVOICE_ITEMS[idx], obj);
  else INVOICE_ITEMS.unshift(obj);
  saveInvoiceItems();
  rebuildInvoiceItemOptions();
  renderProducts();
  clearProductForm();
  toast('Product opgeslagen');
}
function deleteProduct(id){
  var it = INVOICE_ITEMS.find(function(x){ return x.id===id; });
  if(!it || it.group==='Pakketten') return;
  if(!confirm('Product "'+(it.name||'')+'" verwijderen?')) return;
  INVOICE_ITEMS = INVOICE_ITEMS.filter(function(x){ return x.id!==id; });
  saveInvoiceItems();
  rebuildInvoiceItemOptions();
  renderProducts();
  if(prodEditingId===id) clearProductForm();
  toast('Product verwijderd');
}

/* ===== Bedrijfsinstellingen modal ===== */
var modalCompany=$('#modalCompany');
function openCompanyModal(){
  $('#coName').value = company.name||'';
  $('#coEmail').value = company.email||'';
  $('#coPhone').value = company.phone||'';
  $('#coAddress').value = company.address||'';
  $('#coKvk').value = company.kvk||'';
  $('#coVat').value = company.vat||'';
  $('#coIban').value = company.iban||'';
  $('#coAccountName').value = company.accountName||'';
  $('#coPayDays').value = company.paymentDays||14;
  $('#coPayText').value = company.paymentText||'Onder vermelding van het factuurnummer.';
  $('#coPreekerRate').value = (typeof company.preekerRate==='number' ? company.preekerRate : 42.56);
  $('#coColor').value = company.color||'#004080';
  if($('#coTagline')) $('#coTagline').value = company.tagline||'';
  if($('#coQuickLabel1')) $('#coQuickLabel1').value = (company.quickContacts[0]&&company.quickContacts[0].label)||'Rijschool';
  if($('#coQuickPhone1')) $('#coQuickPhone1').value = (company.quickContacts[0]&&company.quickContacts[0].phone)||'';
  if($('#coQuickLabel2')) $('#coQuickLabel2').value = (company.quickContacts[1]&&company.quickContacts[1].label)||'ANWB';
  if($('#coQuickPhone2')) $('#coQuickPhone2').value = (company.quickContacts[1]&&company.quickContacts[1].phone)||'';
  if($('#coQuickLabel3')) $('#coQuickLabel3').value = (company.quickContacts[2]&&company.quickContacts[2].label)||'Partner';
  if($('#coQuickPhone3')) $('#coQuickPhone3').value = (company.quickContacts[2]&&company.quickContacts[2].phone)||'';
  $('#coLogoInfo').textContent = company.logo ? 'Logo staat opgeslagen op dit apparaat.' : 'Je kunt hier je eigen logo uploaden. Dit wordt lokaal opgeslagen op dit apparaat.';
  modalCompany.style.display='flex';
}
function closeCompanyModal(){ modalCompany.style.display='none'; }

/* ===== Modulebeheer ===== */
var MODULE_COLLAPSE_KEY='driveplan.moduleCollapse.v1';
function readModuleCollapseState(){
  try{ return JSON.parse(localStorage.getItem(MODULE_COLLAPSE_KEY)||'{}') || {}; }catch(e){ return {}; }
}
function writeModuleCollapseState(state){
  try{ localStorage.setItem(MODULE_COLLAPSE_KEY, JSON.stringify(state||{})); }catch(e){}
}
function isModuleCollapsed(mid){
  var state = readModuleCollapseState();
  return !!state[mid];
}
function setModuleCollapsed(mid, collapsed){
  var state = readModuleCollapseState();
  if(collapsed) state[mid]=1; else delete state[mid];
  writeModuleCollapseState(state);
}
function renderModuleManager(){
  var grid=$('#modGrid');
  if(!grid) return;
  var mods = (curriculum.modules||[]);

  if(!mods.length){
    grid.innerHTML = '<div class="card"><div class="small">Nog geen modules. Klik rechtsboven op “+ Module”.</div></div>';
    return;
  }

  var html='';
  mods.forEach(function(m, mi){
    var cls = m.cls || moduleClassByIndex(mi);
    var collapsed = isModuleCollapsed(m.id);
    html += `
      <div class="modmgr-mod ${collapsed ? 'is-collapsed' : ''}" data-mod-wrap="${m.id}">
        <div class="modmgr-head">
          <div class="modmgr-head-main">
            <button class="btn btn-ghost modmgr-toggle" data-mod-id="${m.id}" data-act="togglemod" type="button" aria-expanded="${collapsed ? 'false' : 'true'}">${collapsed ? 'Uitklappen' : 'Inklappen'}</button>
            <span class="pill">${escapeHtml(cls)}</span>
            <input class="input" data-mod-id="${m.id}" data-act="modlabel" value="${escapeHtml(m.label||'')}" style="min-width:320px" />
          </div>
          <div class="modmgr-head-actions">
            <button class="btn btn-ghost" data-mod-id="${m.id}" data-act="addpart">+ Onderdeel</button>
            <button class="btn btn-danger" data-mod-id="${m.id}" data-act="delmod">Verwijder module</button>
          </div>
        </div>
        <div class="modmgr-parts">
          ${(m.parts||[]).map(function(p, pi){
            return `
              <div class="part-row">
                <div class="left">
                  <div class="pid">Nr ${(mi+1)}.${(pi+1)}</div>
                  <input class="input" data-mod-id="${m.id}" data-part-id="${p.id}" data-act="partlabel" value="${escapeHtml(p.t||'')}" style="flex:1;min-width:260px" />
                </div>
                <div style="display:flex;gap:6px;align-items:center">  <button class="btn btn-ghost" data-mod-id="${m.id}" data-part-id="${p.id}" data-act="up">↑</button>  <button class="btn btn-ghost" data-mod-id="${m.id}" data-part-id="${p.id}" data-act="down">↓</button>  <button class="btn btn-ghost" data-mod-id="${m.id}" data-part-id="${p.id}" data-act="delpart">Verwijder</button></div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });
  grid.innerHTML = html;
}
function saveCurriculum(){
  store.write(K.curriculum, curriculum);
}
function deletePartEverywhere(partId){
  Object.keys(progress||{}).forEach(function(lid){
    if(progress[lid] && progress[lid][partId]){
      delete progress[lid][partId];
    }
    if(progress[lid] && Object.keys(progress[lid]).length===0){
      delete progress[lid];
    }
  });
  store.write(K.progress, progress);
}
function deleteModulePartsEverywhere(mod){
  (mod.parts||[]).forEach(function(p){ deletePartEverywhere(p.id); });
}

function modExportJson(){
  var payload = { exportedAt: new Date().toISOString(), curriculum: curriculum };
  var blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'driveplan-modules-'+isoToday()+'.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href)}, 1500);
}
function modImportJson(file){
  var r=new FileReader();
  r.onload=function(){
    try{
      var data=JSON.parse(r.result);
      var cur = data && data.curriculum ? data.curriculum : data;
      if(!cur || !Array.isArray(cur.modules)) throw new Error('Geen geldige modules gevonden.');
      if(!confirm('Modules importeren? Dit vervangt je huidige modules.')) return;
      curriculum = cur;
      // geef classes als ze ontbreken
      (curriculum.modules||[]).forEach(function(m, i){
        if(!m.cls) m.cls = moduleClassByIndex(i);
        if(!Array.isArray(m.parts)) m.parts=[];
      });
      saveCurriculum();
      renderModuleManager();
      renderSheet();
      toast('Modules geïmporteerd');
    }catch(e){
      alert('Import mislukt: '+e.message);
    }
  };
  r.readAsText(file);
}

/* ===== Tabs ===== */
var views={
  agenda:$('#view-agenda'),
  learners:$('#view-learners'),
  sheet:$('#view-sheet'),
  invoices:$('#view-invoices'),
  modules:$('#view-modules'),
  settings:$('#view-settings')
};
function switchTab(name, options){
  options = options || {};
  if(!views[name]) name = 'agenda';

  // AANPASBAAR: hieronder wordt onthouden welke pagina/tab als laatste open stond.
  try{ localStorage.setItem(LOCAL_ACTIVE_TAB_KEY, JSON.stringify(name)); }catch(e){}

  for(var k in views){ if(views.hasOwnProperty(k) && views[k]){ views[k].style.display=(k===name)?'block':'none'; } }
  $all('.tab-btn').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-tab')===name); });

  window.__dpCurrentTab = name;
  if(document && document.body) document.body.classList.remove('mobile-nav-open');

  if(window.history && window.history.pushState){
    var state = {dpTab:name};
    if(options.replaceHistory) window.history.replaceState(state, '', '#'+name);
    else if(options.pushHistory !== false && (!history.state || history.state.dpTab !== name)) window.history.pushState(state, '', '#'+name);
  }

  if(name==='agenda') renderWeek();
  if(name==='learners') renderLearners();
  if(name==='sheet') renderSheet();
  if(name==='invoices') renderInvoices();
  if(name==='modules') renderModuleManager();
  if(name==='settings'){
    if(typeof syncSettingsTabFromCompany==='function') syncSettingsTabFromCompany();
    if(typeof renderCloudSyncStatus==='function') renderCloudSyncStatus();
  }
}

function syncSettingsTabFromCompany(){
  // AANPASBAAR: deze velden vullen het Instellingen-scherm met huidige waarden.
  if($('#setQuickLabel1')) $('#setQuickLabel1').value = (company.quickContacts[0]&&company.quickContacts[0].label)||'Rijschool';
  if($('#setQuickPhone1')) $('#setQuickPhone1').value = (company.quickContacts[0]&&company.quickContacts[0].phone)||'';
  if($('#setQuickLabel2')) $('#setQuickLabel2').value = (company.quickContacts[1]&&company.quickContacts[1].label)||'Partner';
  if($('#setQuickPhone2')) $('#setQuickPhone2').value = (company.quickContacts[1]&&company.quickContacts[1].phone)||'';
  if($('#setQuickLabel3')) $('#setQuickLabel3').value = (company.quickContacts[2]&&company.quickContacts[2].label)||'ANWB';
  if($('#setQuickPhone3')) $('#setQuickPhone3').value = (company.quickContacts[2]&&company.quickContacts[2].phone)||'';
  if($('#setWhatsAppTemplate')) $('#setWhatsAppTemplate').value = (company.whatsappTemplate || defaultLessonWhatsAppTemplate());
  var logoPreview = $('#setCompanyLogoPreview');
  var logoInfo = $('#setCompanyLogoInfo');
  if(logoPreview){
    if(company.logo){
      logoPreview.src = company.logo;
      logoPreview.style.display = 'block';
      if(logoInfo) logoInfo.textContent = 'Bedrijfslogo is ingesteld op dit apparaat.';
    }else{
      logoPreview.removeAttribute('src');
      logoPreview.style.display = 'none';
      if(logoInfo) logoInfo.textContent = 'Nog geen eigen logo ingesteld.';
    }
  }
}
function saveSettingsTab(){
  // AANPASBAAR: alles wat je hier opslaat, kun je later zelf aanpassen in Instellingen.
  company.quickContacts = [
    {label:(($('#setQuickLabel1')&&$('#setQuickLabel1').value)||'Rijschool').trim() || 'Rijschool', phone:(($('#setQuickPhone1')&&$('#setQuickPhone1').value)||'').trim()},
    {label:(($('#setQuickLabel2')&&$('#setQuickLabel2').value)||'Partner').trim() || 'Partner', phone:(($('#setQuickPhone2')&&$('#setQuickPhone2').value)||'').trim()},
    {label:(($('#setQuickLabel3')&&$('#setQuickLabel3').value)||'ANWB').trim() || 'ANWB', phone:(($('#setQuickPhone3')&&$('#setQuickPhone3').value)||'').trim()}
  ];
  company.whatsappTemplate = (($('#setWhatsAppTemplate')&&$('#setWhatsAppTemplate').value)||'').trim() || defaultLessonWhatsAppTemplate();
  store.write(K.company, company);
  renderQuickContacts();
  syncSettingsTabFromCompany();
  toast('Instellingen opgeslagen');
}

/* ===== INIT ===== */
(function init(){
  function ready(fn){ if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',fn,{once:true});} else {fn();} }
  ready(function(){
    try{
      $all('.tab-btn').forEach(function(b){ b.addEventListener('click', function(){ switchTab(b.getAttribute('data-tab')); }); });

      // les-modal
      function bindPickupButton(sel,field){
        var b=$(sel); if(!b) return;
        b.onclick=function(){
          try{
            var lid=$('#nlLearner')?$('#nlLearner').value:'';
            var st=learners.find(function(x){return x.id===lid});
            var pp=$('#nlPickup');
            if(pp) pp.value=(st&&st[field])?st[field]:'';
          }catch(e){}
        };
      }
      bindPickupButton('#nlUseAddr','address');
      bindPickupButton('#nlUseAddr2','address2');
      bindPickupButton('#nlUseAddr3','address3');

      $('#openNewLesson').addEventListener('click', function(){ openLessonModal(null); });
      $('#nlCancel').addEventListener('click', function(){ closeLessonModal(); });
      $('#nlToSheet').addEventListener('click', function(){
        var lid = nlLearner.value;
        if(!lid) return;
        selectedLearnerId = lid;
        store.write(K.sel, selectedLearnerId);
        closeLessonModal();
        switchTab('sheet');
      });
      $('#nlSave').addEventListener('click', saveNewOrEditLesson);
      $('#nlDelete').addEventListener('click', deleteLesson);
      $('#modalLesson').addEventListener('click', function(e){ if(e.target===$('#modalLesson')) closeLessonModal(); });

      // leerlingen
      $('#openNewLearner').addEventListener('click', function(){ openLearnerModal(null); });
      $('#lrCancel').addEventListener('click', closeLearnerModal);
      $('#lrSave').addEventListener('click', saveLearner);
      if($('#lrPackage')) $('#lrPackage').addEventListener('change', function(){ updateLearnerPackageStatsDisplay(editLearnerId, this.value); });
      if($('#lrCopyRelation')) $('#lrCopyRelation').addEventListener('click', function(){ copyTextToClipboard((lrRelation.value||'').trim()).then(function(ok){ toast(ok ? 'CBR relatienummer gekopieerd' : 'Kopiëren mislukt'); }); });
      $('#modalLearner').addEventListener('click', function(e){ if(e.target===$('#modalLearner')) closeLearnerModal(); });
      $('#learnerSearch').addEventListener('input', function(){ renderLearners(); });
      $('#liClose').addEventListener('click', closeLearnerInvoicesModal);
      $('#modalLearnerInvoices').addEventListener('click', function(e){ if(e.target===$('#modalLearnerInvoices')) closeLearnerInvoicesModal(); });
      $('#liBody').addEventListener('click', function(e){
        var btn = e.target.closest('button[data-li-act]');
        if(!btn) return;
        var act = btn.getAttribute('data-li-act');
        var invId = btn.getAttribute('data-inv');
        var termIndex = parseInt(btn.getAttribute('data-term'),10);
        if(act==='open') openInvoicePrintWindow(invId, termIndex);
        if(act==='sent') markInvoiceTermSent(invId, termIndex);
        if(act==='paid') markInvoiceTermPaid(invId, termIndex);
        if(act==='unpay') markInvoiceTermOpen(invId, termIndex);
        if(act==='delete'){
          deleteInvoice(invId);
          if(window.currentLearnerInvoiceId) openLearnerInvoicesModal(window.currentLearnerInvoiceId);
        }
      });


      // instelbare volgorde van lesduren
      var durSetting=$('#durationOrderSetting');
      if(durSetting) durSetting.value=getDurationOrder().join(',');
      var settingsSave=$('#settingsSaveBtn');
      if(settingsSave){
        settingsSave.addEventListener('click', function(){
          if(!durSetting) return;
          var vals=(durSetting.value||'').split(/[,;\s]+/).filter(Boolean).map(function(x){return parseInt(x,10);});
          var clean=[],seen={};
          vals.forEach(function(m){
            var ok=(m===50||m===100)||(m>=60&&m<=480&&m%30===0);
            if(ok&&!seen[m]){seen[m]=1;clean.push(m);}
          });
          if(clean.length){
            store.write(DURATION_ORDER_KEY,clean);
            durSetting.value=getDurationOrder().join(',');
          }
        });
      }

      // backup
      $('#btnExport').addEventListener('click', exportBackup);
      $('#btnImport').addEventListener('change', function(){
        if(this.files && this.files[0]) importBackupFile(this.files[0]);
        this.value='';
      });

      // week nav
      $('#prevWeek').addEventListener('click', function(){ weekStart=addDays(weekStart,-7); renderWeek(); });
      $('#nextWeek').addEventListener('click', function(){ weekStart=addDays(weekStart,7); renderWeek(); });

      // facturen
      if($('#openPackages')) $('#openPackages').addEventListener('click', openPackagesModal);
      $('#pkgAdd').addEventListener('click', function(){ clearPackageForm(); $('#pkgName').focus(); });
      $('#pkgSave').addEventListener('click', savePackage);
      $('#pkgClear').addEventListener('click', clearPackageForm);
      $('#pkgClose').addEventListener('click', closePackagesModal);
      $('#pkgDelete').addEventListener('click', function(){ if(pkgEditingId) deletePackage(pkgEditingId); });
      $('#pkgExamIncluded').addEventListener('change', updatePackageExamFields);
      $('#pkgExamAmount').addEventListener('input', updatePackageExamFields);
      $('#pkgExamCbrAmount').addEventListener('input', updatePackageExamFields);
      $('#pkgList').addEventListener('click', function(e){
        var edit = e.target.closest('button[data-pkg-edit]');
        if(edit){ editPackage(edit.getAttribute('data-pkg-edit')); return; }
        var del = e.target.closest('button[data-pkg-del]');
        if(del){ deletePackage(del.getAttribute('data-pkg-del')); return; }
      });
      if($('#openCompany')) $('#openCompany').addEventListener('click', openCompanyModal);
      if($('#rentalPrevWeek')) $('#rentalPrevWeek').addEventListener('click', function(){ rentalWeekStart = mondayOfWeek(addDays(rentalWeekStart,-7)); store.write(K.rentalWeek, isoFromDateLocal(rentalWeekStart)); renderRentalWeek(); });
      if($('#rentalNextWeek')) $('#rentalNextWeek').addEventListener('click', function(){ rentalWeekStart = mondayOfWeek(addDays(rentalWeekStart,7)); store.write(K.rentalWeek, isoFromDateLocal(rentalWeekStart)); renderRentalWeek(); });
      if($('#invRevenuePrev')) $('#invRevenuePrev').addEventListener('click', function(){ shiftInvoiceRevenuePeriod(-1); });
      if($('#invRevenueNext')) $('#invRevenueNext').addEventListener('click', function(){ shiftInvoiceRevenuePeriod(1); });
      if($('#invRevenueMode')) $('#invRevenueMode').addEventListener('change', function(){ setInvoiceRevenueMode(this.value); });
      $('#coCancel').addEventListener('click', closeCompanyModal);

      function resizeLogoFile(file, done){
        try{
          var reader = new FileReader();
          reader.onload = function(){
            try{
              var img = new Image();
              img.onload = function(){
                try{
                  var maxSide = 420;
                  var w = img.width || 1, h = img.height || 1;
                  var scale = Math.min(1, maxSide / Math.max(w,h));
                  var cw = Math.max(1, Math.round(w * scale));
                  var ch = Math.max(1, Math.round(h * scale));
                  var canvas = document.createElement('canvas');
                  canvas.width = cw;
                  canvas.height = ch;
                  var ctx = canvas.getContext('2d');
                  ctx.clearRect(0,0,cw,ch);
                  ctx.drawImage(img, 0, 0, cw, ch);
                  var data = canvas.toDataURL('image/webp', 0.86);
                  done(data);
                }catch(e){ done(reader.result); }
              };
              img.onerror = function(){ done(reader.result); };
              img.src = reader.result;
            }catch(e){ done(reader.result); }
          };
          reader.readAsDataURL(file);
        }catch(e){ done(''); }
      }

      var settingsLogoInput = $('#setCompanyLogo');
      if(settingsLogoInput) settingsLogoInput.addEventListener('change', function(){
        var file = this.files && this.files[0];
        if(!file) return;
        resizeLogoFile(file, function(dataUrl){
          if(!dataUrl){ alert('Logo kon niet worden verwerkt.'); return; }
          company.logo = dataUrl;
          store.write(K.company, company);
          applyBranding();
          setHeroMeta();
          syncSettingsTabFromCompany();
          toast('Bedrijfslogo opgeslagen');
        });
      });

      var settingsLogoRemove = $('#setCompanyLogoRemove');
      if(settingsLogoRemove) settingsLogoRemove.addEventListener('click', function(){
        if(!company.logo){ toast('Er is geen bedrijfslogo ingesteld'); return; }
        if(!confirm('Bedrijfslogo verwijderen?')) return;
        company.logo = '';
        store.write(K.company, company);
        applyBranding();
        setHeroMeta();
        syncSettingsTabFromCompany();
        toast('Bedrijfslogo verwijderd');
      });

      $('#coLogo').addEventListener('change', function(){
        var file = this.files && this.files[0];
        if(!file) return;
        resizeLogoFile(file, function(dataUrl){
          if(!dataUrl){ alert('Logo kon niet worden verwerkt.'); return; }
          company.logo = dataUrl;
          company.whatsappTemplate = (($('#setWhatsAppTemplate')&&$('#setWhatsAppTemplate').value)||'').trim() || defaultLessonWhatsAppTemplate();
  store.write(K.company, company);
          applyBranding();
          setHeroMeta();
          $('#coLogoInfo').textContent = 'Logo geselecteerd en opgeslagen.';
          toast('Logo opgeslagen');
        });
      });
      $('#coSave').addEventListener('click', function(){
        company = {
          name: ($('#coName').value||'').trim(),
          email: ($('#coEmail').value||'').trim(),
          phone: ($('#coPhone').value||'').trim(),
          address: ($('#coAddress').value||'').trim(),
          kvk: ($('#coKvk').value||'').trim(),
          vat: ($('#coVat').value||'').trim(),
          iban: ($('#coIban').value||'').trim(),
          accountName: ($('#coAccountName').value||'').trim(),
          paymentDays: parseInt($('#coPayDays').value,10) || 14,
          paymentText: ($('#coPayText').value||'').trim() || 'Onder vermelding van het factuurnummer.',
          preekerRate: parseFloat($('#coPreekerRate').value) || 42.56,
          color: ($('#coColor').value||'#004080').trim(),
          tagline: ($('#coTagline') ? ($('#coTagline').value||'').trim() : ''),
          logo: company.logo||'',
          quickContacts:[
            {label:(($('#coQuickLabel1')&&$('#coQuickLabel1').value)||'Rijschool').trim() || 'Rijschool', phone:(($('#coQuickPhone1')&&$('#coQuickPhone1').value)||'').trim()},
            {label:(($('#coQuickLabel2')&&$('#coQuickLabel2').value)||'ANWB').trim() || 'ANWB', phone:(($('#coQuickPhone2')&&$('#coQuickPhone2').value)||'').trim()},
            {label:(($('#coQuickLabel3')&&$('#coQuickLabel3').value)||'Partner').trim() || 'Partner', phone:(($('#coQuickPhone3')&&$('#coQuickPhone3').value)||'').trim()}
          ]
        };
        company.whatsappTemplate = (($('#setWhatsAppTemplate')&&$('#setWhatsAppTemplate').value)||'').trim() || defaultLessonWhatsAppTemplate();
  store.write(K.company, company);
        applyBranding();
        setHeroMeta();
        renderQuickContacts();
        toast('Instellingen opgeslagen');
        closeCompanyModal();
      });
      $('#modalCompany').addEventListener('click', function(e){ if(e.target===$('#modalCompany')) closeCompanyModal(); });
      if($('#settingsSaveBtn')) $('#settingsSaveBtn').addEventListener('click', saveSettingsTab);
      syncSettingsTabFromCompany();

      rebuildInvoiceItemOptions();
      $('#invItem').addEventListener('change', function(){ setInvoiceFormFromItemId(this.value); });
      $('#invLearner').addEventListener('change', renderInvoiceDraft);
      $('#invAddLine').addEventListener('click', function(){ addCurrentInvoiceLineToDraft(); });
      $('#invClearDraft').addEventListener('click', function(){
        if(!invDraftLines.length) return;
        if(!confirm('Conceptfactuur leegmaken?')) return;
        clearInvoiceDraft();
      });
      $('#invDraftList').addEventListener('click', function(e){
        var btn = e.target.closest('button[data-draft-del]');
        if(!btn) return;
        var idx = parseInt(btn.getAttribute('data-draft-del'),10);
        if(isNaN(idx)) return;
        invDraftLines.splice(idx,1);
        renderInvoiceDraft();
      });
      $('#invCreate').addEventListener('click', function(){
        var learnerId=$('#invLearner').value;
        if(!learnerId){ alert('Kies een leerling'); return; }

        var itemId = $('#invItem').value;
        var item = INVOICE_ITEMS.find(function(x){return x.id===itemId;}) || null;
        var terms = parseInt($('#invTerms').value,10)||1;
        var start = $('#invStart').value || isoToday();

        if(!invDraftLines.length){
          var added = addCurrentInvoiceLineToDraft();
          if(!added) return;
        }

        var lines = invDraftLines.map(function(line){ return Object.assign({}, line); });
        var totalAmount = round2(lines.reduce(function(sum, line){ return sum + Number(line.amount||0); }, 0));
        var termAmounts = splitIntoTerms(totalAmount, terms);
        var schedule = termAmounts.map(function(a, i){
          return {k:i+1, due:addMonthsISO(start, i), amount:round2(a), status:'open', sentAt:null, invoiceNumber:''};
        });

        var inv = {
          id: uid(),
          number: '',
          learnerId: learnerId,
          itemId: itemId,
          desc: invoiceDraftTitle(),
          packageName: (lines.find(function(line){ return line.packageName; })||{}).packageName || '',
          total: totalAmount,
          terms: terms,
          startDate: start,
          createdAt: isoToday(),
          lines: lines,
          schedule: schedule
        };

        invoices.unshift(inv);
        store.write(K.invoices, invoices);
        clearInvoiceDraft();
        toast('Factuur aangemaakt');
        renderInvoices();
      });

      $('#invDueList').addEventListener('click', function(e){
        var btn=e.target.closest('button[data-act]');
        if(!btn) return;
        var invId=btn.getAttribute('data-inv');
        var termIndex=parseInt(btn.getAttribute('data-term'),10);
        var act=btn.getAttribute('data-act');
        if(act==='open') openInvoicePrintWindow(invId, termIndex);
        if(act==='sent') markInvoiceTermSent(invId, termIndex);
        if(act==='paid') markInvoiceTermPaid(invId, termIndex);
        if(act==='unpay') markInvoiceTermOpen(invId, termIndex);
        if(act==='delete') deleteInvoice(invId);
      });
      $('#invSentList').addEventListener('click', function(e){
        var btn=e.target.closest('button[data-act]');
        if(!btn) return;
        var invId = btn.getAttribute('data-inv');
        var termIndex = parseInt(btn.getAttribute('data-term'),10);
        var act = btn.getAttribute('data-act');
        if(act==='open') openInvoicePrintWindow(invId, termIndex);
        if(act==='paid') markInvoiceTermPaid(invId, termIndex);
        if(act==='unpay') markInvoiceTermOpen(invId, termIndex);
        if(act==='delete') deleteInvoice(invId);
      });

      // modulebeheer events
      $('#modAddModule').addEventListener('click', function(){
        var name = prompt('Naam van de module?', 'Nieuwe module');
        if(!name) return;
        var mod = {id: nextModuleId(), label: name.trim(), cls: moduleClassByIndex((curriculum.modules||[]).length), parts: []};
        curriculum.modules.push(mod);
        saveCurriculum();
        renderModuleManager();
        renderSheet();
        toast('Module toegevoegd');
      });
      $('#modGrid').addEventListener('click', function(e){
        var head = e.target.closest('.modmgr-head');
        var clickOnInput = e.target.closest('input, textarea, select, label');
        var clickOnAction = e.target.closest('button[data-act]');
        if(head && !clickOnInput && !clickOnAction){
          var wrapFromHead = head.closest('.modmgr-mod');
          var midFromHead = wrapFromHead ? wrapFromHead.getAttribute('data-mod-wrap') : '';
          if(midFromHead){
            setModuleCollapsed(midFromHead, !(wrapFromHead && wrapFromHead.classList.contains('is-collapsed')));
            renderModuleManager();
            return;
          }
        }

        var btn = e.target.closest('button[data-act]');
        if(!btn) return;
        var act = btn.getAttribute('data-act');
        var mid = btn.getAttribute('data-mod-id');
        var pid = btn.getAttribute('data-part-id');

        if(act==='togglemod'){
          var wrap = btn.closest('.modmgr-mod');
          var collapsedNow = !(wrap && wrap.classList.contains('is-collapsed'));
          setModuleCollapsed(mid, collapsedNow);
          renderModuleManager();
          return;
        }

        var mod = (curriculum.modules||[]).find(function(x){return x.id===mid;});
        if(!mod) return;

        if(act==='addpart'){
          var t = prompt('Naam van het onderdeel / rijtaak?', '');
          if(!t) return;
          mod.parts = mod.parts || [];
          var posStr = prompt('Op welke plek in deze module? (1 t/m '+(mod.parts.length+1)+')', String(mod.parts.length+1));
          var pos = parseInt(posStr,10);
          if(!(pos>=1 && pos<=mod.parts.length+1)) pos = mod.parts.length+1;
          var newPart = {id: nextPartId(), t: t.trim()};
          mod.parts.splice(pos-1, 0, newPart);
          saveCurriculum();
          renderModuleManager();
          renderSheet();
          toast('Onderdeel toegevoegd');
        }
        if(act==='up' || act==='down'){
          var pidNum2 = parseInt(pid,10);
          var arr = mod.parts || [];
          var i2 = arr.findIndex(function(p){return p.id===pidNum2;});
          if(i2<0) return;
          if(act==='up' && i2>0){
            var tmp=arr[i2-1]; arr[i2-1]=arr[i2]; arr[i2]=tmp;
          }
          if(act==='down' && i2<arr.length-1){
            var tmp2=arr[i2+1]; arr[i2+1]=arr[i2]; arr[i2]=tmp2;
          }
          mod.parts = arr;
          saveCurriculum();
          renderModuleManager();
          renderSheet();
          toast('Volgorde aangepast');
        }

        if(act==='delpart'){
          var pidNum = parseInt(pid,10);
          if(!confirm('Onderdeel #'+pidNum+' verwijderen? Scores voor dit onderdeel worden ook verwijderd.')) return;
          mod.parts = (mod.parts||[]).filter(function(p){return p.id!==pidNum;});
          deletePartEverywhere(pidNum);
          saveCurriculum();
          renderModuleManager();
          renderSheet();
          toast('Onderdeel verwijderd');
        }
        if(act==='delmod'){
          if(!confirm('Module verwijderen? Alle onderdelen + scores in die module worden ook verwijderd.')) return;
          deleteModulePartsEverywhere(mod);
          curriculum.modules = (curriculum.modules||[]).filter(function(x){return x.id!==mid;});
          saveCurriculum();
          renderModuleManager();
          renderSheet();
          toast('Module verwijderd');
        }
      });
      $('#modGrid').addEventListener('input', function(e){
        var inp = e.target.closest('input[data-act]');
        if(!inp) return;
        var act=inp.getAttribute('data-act');
        var mid=inp.getAttribute('data-mod-id');
        var pid=inp.getAttribute('data-part-id');
        var mod=(curriculum.modules||[]).find(function(x){return x.id===mid;});
        if(!mod) return;
        if(act==='modlabel'){
          mod.label = inp.value;
          saveCurriculum();
        }
        if(act==='partlabel'){
          var pidNum=parseInt(pid,10);
          var p=(mod.parts||[]).find(function(x){return x.id===pidNum;});
          if(p){ p.t = inp.value; saveCurriculum(); }
        }
      });
      $('#modExport').addEventListener('click', modExportJson);
      $('#modImport').addEventListener('change', function(){
        if(this.files && this.files[0]) modImportJson(this.files[0]);
        this.value='';
      });

      // defaults
      initApp();
      // Cloud-sync uitgeschakeld; overdracht gaat via Backup downloaden/terugzetten.
      initLocalLoginGate();

      // init invoice form
      setInvoiceFormFromItemId('start');
      $('#invItem').value='start';
      $('#invStart').value = isoToday();
      $('#historicalToggle').checked=!!historicalMode;

                  // Leskaart snelle acties
      var bDl=$('#sheetPdfDownload'), bSh=$('#sheetPdfShare'), bMail=$('#sheetMail'), bNav=$('#sheetNav'), bCall=$('#sheetCall');
      function currentSheetLid(){
        return ($('#sheetLearner') && $('#sheetLearner').value) ? $('#sheetLearner').value : selectedLearnerId;
      }
      if(bDl){
        bDl.addEventListener('click', function(){
          var lid=currentSheetLid(); if(!lid){ alert('Kies eerst een leerling'); return; }
          openLeskaartPDF(lid);
        });
      }
      if(bSh){
        bSh.addEventListener('click', function(){
          var lid=currentSheetLid(); if(!lid){ alert('Kies eerst een leerling'); return; }
          openLeskaartPDF(lid);
        });
      }
      if(bMail){
        bMail.addEventListener('click', function(){
          var lid=currentSheetLid(); if(!lid){ alert('Kies eerst een leerling'); return; }
          openMailLeskaartAssist(lid);
        });
      }
      if(bNav){
        bNav.addEventListener('click', function(){
          var learner = getCurrentSheetLearner();
          if(!learner){ alert('Kies eerst een leerling'); return; }
          if(!openAddressNavigation(learner.address||'')) alert('Deze leerling heeft nog geen adres ingevuld.');
        });
      }
      if(bCall){
        bCall.addEventListener('click', function(){
          var learner = getCurrentSheetLearner();
          if(!learner){ alert('Kies eerst een leerling'); return; }
          if(!openPhoneCall(learner.phone||'')) alert('Deze leerling heeft nog geen telefoonnummer ingevuld.');
        });
      }
      [1,2,3].forEach(function(n){
        var btn = document.getElementById('quickCall'+n);
        if(btn){
          btn.addEventListener('click', function(){
            var phone = btn.getAttribute('data-phone') || '';
            if(!openPhoneCall(phone)) alert('Geen telefoonnummer ingesteld.');
          });
        }
      });
      renderQuickContacts();

      // Les-modal WhatsApp knop
      var waBtn=$('#nlWhatsApp');
      if(waBtn){
        waBtn.addEventListener('click', function(){
          var lid = nlLearner.value;
          if(!lid){ alert('Kies een leerling'); return; }
          var iso=nlDate.value;
          var time=nlTimeValue();
          var duration=parseInt(nlDuration.value,10);
          var type=nlType.value || 'lesson';
          var note=(nlNote.value||'').trim();
          var pickup=(nlPickup && nlPickup.value)?(nlPickup.value||'').trim():'';
          var ev={date:iso,time:time,duration:duration,learnerId:lid,type:type,note:note,pickup:pickup};
          openWhatsAppForLesson(ev);
        });
      }

      var startTab = 'agenda';
      try{ startTab = JSON.parse(localStorage.getItem(LOCAL_ACTIVE_TAB_KEY) || '"agenda"') || 'agenda'; }catch(e){ startTab = 'agenda'; }
      if(location.hash){
        var hashTab = String(location.hash || '').replace(/^#/, '').trim();
        if(views[hashTab]) startTab = hashTab;
      }
      if(!views[startTab]) startTab = 'agenda';
      switchTab(startTab, {replaceHistory:true, pushHistory:false});

      if(window.__dpPopStateBound !== true){
        window.__dpPopStateBound = true;
        window.addEventListener('popstate', function(){
          if(document && document.body && document.body.classList.contains('mobile-nav-open')){
            document.body.classList.remove('mobile-nav-open');
            return;
          }
          var nextTab = 'agenda';
          if(window.history && window.history.state && views[window.history.state.dpTab]) nextTab = window.history.state.dpTab;
          else if(location.hash){
            var hashTab = String(location.hash || '').replace(/^#/, '').trim();
            if(views[hashTab]) nextTab = hashTab;
          }
          switchTab(nextTab, {pushHistory:false});
        });
      }
      
    }catch(e){
      console.error(e);
      dbg('❌ Fout bij opstarten: '+e.message);
      toast('Fout: '+e.message);
    }
  });

  window.addEventListener('error',function(ev){
    var msg='JS-error: '+(ev.error && ev.error.message ? ev.error.message : (ev.message||'onbekend'));
    dbg('❌ '+msg);
  });
})();

/* ===== Overrides: Mooie PDF via printpagina ===== */
(function(){
  var b1 = document.getElementById('sheetPdfDownload');
  if(b1){
    b1.onclick = function(){
      var lidEl = document.getElementById('sheetLearner');
      var lid = lidEl ? lidEl.value : '';
      if(lid) openLeskaartPDF(lid);
    };
  }
  var b2 = document.getElementById('sheetPdfShare');
  if(b2){
    b2.onclick = function(){
      var lidEl = document.getElementById('sheetLearner');
      var lid = lidEl ? lidEl.value : '';
      if(lid) openLeskaartPDF(lid);
    };
  }
})();

document.addEventListener("DOMContentLoaded", function(){
  var btn = document.getElementById("coResetInv");
  if(btn){
    btn.addEventListener("click", function(){
      if(confirm("Factuurnummer opnieuw starten vanaf 1?")){
        var year = (new Date()).getFullYear();
        invCounter = {year: year, seq: 0};
        try{
          localStorage.setItem("dp_invCounter", JSON.stringify(invCounter));
        }catch(e){}
        alert("Factuurnummer is gereset. De eerstvolgende verzonden factuur wordt "+year+"-001.");
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', function(){
  try{
    var oc = document.getElementById('openCompany');
    if(oc) oc.onclick = function(){ try{ openCompanyModal(); }catch(e){} };

    var op2 = document.getElementById('openProducts2');
    if(op2) op2.onclick = function(){ try{ openProductsModal(); }catch(e){ console.error(e); } };

    var pk2 = document.getElementById('openPackages2');
    if(pk2) pk2.onclick = function(){ try{ openPackagesModal(); }catch(e){ console.error(e); } };

    var op = document.getElementById('openProducts');
    if(op) op.onclick = function(){ try{ openProductsModal(); }catch(e){ console.error(e); } };

    var pkgClose = document.getElementById('pkgClose');
    if(pkgClose) pkgClose.onclick = function(){ try{ closePackagesModal(); }catch(e){} };

    var prodClose = document.getElementById('prodClose');
    if(prodClose) prodClose.onclick = function(){ try{ closeProductsModal(); }catch(e){} };
  }catch(e){}
});

document.addEventListener('DOMContentLoaded', function(){
  var prodBtn=document.getElementById('openProducts2')||document.getElementById('openProducts');
  if(prodBtn){
    prodBtn.addEventListener('click', function(e){
      e.preventDefault();
      if(typeof openProductsModal==='function'){ openProductsModal(); }
    });
  }
});

document.addEventListener('DOMContentLoaded', function(){
  try{
    if(typeof renderRentalWeek==='function' && typeof renderRevenue==='function'){
      renderRentalWeek();
      renderRevenue();
    }
  }catch(e){}
});

document.addEventListener('DOMContentLoaded', function(){
  var pkgAdd = document.getElementById('pkgAdd');
  if(pkgAdd) pkgAdd.onclick = clearPackageForm;
  var pkgClear = document.getElementById('pkgClear');
  if(pkgClear) pkgClear.onclick = clearPackageForm;
  var pkgSave = document.getElementById('pkgSave');
  if(pkgSave) pkgSave.onclick = savePackage;
  var pkgDelete = document.getElementById('pkgDelete');
  if(pkgDelete) pkgDelete.onclick = function(){ if(pkgEditingId) deletePackage(pkgEditingId); };
  var pkgExamIncluded = document.getElementById('pkgExamIncluded');
  if(pkgExamIncluded) pkgExamIncluded.onchange = updatePackageExamFields;
  var pkgExamAmount = document.getElementById('pkgExamAmount');
  if(pkgExamAmount) pkgExamAmount.oninput = updatePackageExamFields;
  var pkgExamCbrAmount = document.getElementById('pkgExamCbrAmount');
  if(pkgExamCbrAmount) pkgExamCbrAmount.oninput = updatePackageExamFields;
  updatePackageExamFields();
  var pkgList = document.getElementById('pkgList');
  if(pkgList) pkgList.addEventListener('click', function(e){
    var eb = e.target.closest('[data-pkg-edit]');
    var db = e.target.closest('[data-pkg-del]');
    if(eb) editPackage(eb.getAttribute('data-pkg-edit'));
    if(db) deletePackage(db.getAttribute('data-pkg-del'));
  });

  var prodAdd = document.getElementById('prodAdd');
  if(prodAdd) prodAdd.onclick = clearProductForm;
  var prodClear = document.getElementById('prodClear');
  if(prodClear) prodClear.onclick = clearProductForm;
  var prodSave = document.getElementById('prodSave');
  if(prodSave) prodSave.onclick = saveProduct;
  var prodDelete = document.getElementById('prodDelete');
  if(prodDelete) prodDelete.onclick = function(){ if(prodEditingId) deleteProduct(prodEditingId); };
  var prodList = document.getElementById('prodList');
  if(prodList) prodList.addEventListener('click', function(e){
    var eb = e.target.closest('[data-prod-edit]');
    var db = e.target.closest('[data-prod-del]');
    if(eb) editProduct(eb.getAttribute('data-prod-edit'));
    if(db) deleteProduct(db.getAttribute('data-prod-del'));
  });

  var mp = document.getElementById('modalPackages');
  if(mp){
    mp.addEventListener('click', function(e){
      if(e.target===mp){ try{ closePackagesModal(); }catch(err){} }
    });
  }
  var mprod = document.getElementById('modalProducts');
  if(mprod){
    mprod.addEventListener('click', function(e){
      if(e.target===mprod){ try{ closeProductsModal(); }catch(err){} }
    });
  }
});

document.addEventListener('DOMContentLoaded', function(){
  function syncVatRental(){
    var ids = [['rentalHours','vatRentalHours'],['rentalEx','vatRentalEx'],['rentalVat','vatRentalVat'],['rentalInc','vatRentalInc']];
    ids.forEach(function(pair){
      var src = document.getElementById(pair[0]);
      var dst = document.getElementById(pair[1]);
      if(src && dst) dst.textContent = src.textContent;
    });
  }
  setTimeout(syncVatRental, 300);
  var oldRenderRentalWeek = window.renderRentalWeek;
  if(typeof oldRenderRentalWeek === 'function'){
    window.renderRentalWeek = function(){
      var r = oldRenderRentalWeek.apply(this, arguments);
      try{ syncVatRental(); }catch(e){}
      return r;
    };
  }
});


/* PWA: service worker */

(function(){
  var b3 = document.getElementById('sheetNav');
  if(b3){
    b3.onclick = function(){
      var learner = getCurrentSheetLearner();
      if(learner) openAddressNavigation(learner.address||'');
    };
  }
  var b4 = document.getElementById('sheetCall');
  if(b4){
    b4.onclick = function(){
      var learner = getCurrentSheetLearner();
      if(learner) openPhoneCall(learner.phone||'');
    };
  }
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.log);
  });
}

document.addEventListener("DOMContentLoaded", function(){
  var btn = document.getElementById("coResetInv");
  if(btn){
    btn.addEventListener("click", function(){
      if(confirm("Factuurnummer opnieuw starten vanaf 1?")){
        var year = (new Date()).getFullYear();
        invCounter = {year: year, seq: 0};
        try{
          localStorage.setItem("dp_invCounter", JSON.stringify(invCounter));
        }catch(e){}
        alert("Factuurnummer is gereset. De eerstvolgende verzonden factuur wordt "+year+"-001.");
      }
    });
  }
});