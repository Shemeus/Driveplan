
/* ===== Helpers ===== */


function $(s){return document.querySelector(s)}
function $all(s){return Array.prototype.slice.call(document.querySelectorAll(s))}
var store={
  read:function(k,f){try{var v=localStorage.getItem(k);return v?JSON.parse(v):f}catch(e){return f}},
  write:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){alert('Opslaan mislukt (storage vol of geblokkeerd).')}}
}

const LOCAL_LOGIN_KEY = 'dp40_local_login_v1';
const LOCAL_LOGIN_SESSION_KEY = 'dp40_local_login_session_v1';
const LOCAL_ACTIVE_TAB_KEY = 'dp40_active_tab_v1'; // AANPASBAAR: onthoudt de laatst geopende pagina/tab na verversen
const DEFAULT_APP_LOGO = './icons/driveplan-logo.png';

function getLocalLoginState(){ return store.read(LOCAL_LOGIN_KEY, null); }
function saveLocalLoginState(v){ store.write(LOCAL_LOGIN_KEY, v); }
function setLocalLoginSession(v){ try{ localStorage.setItem(LOCAL_LOGIN_SESSION_KEY, JSON.stringify(!!v)); }catch(e){} }
function getLocalLoginSession(){ try{ return !!JSON.parse(localStorage.getItem(LOCAL_LOGIN_SESSION_KEY)||'false'); }catch(e){ return false; } }
function showLoginGate(){
  var gate = document.getElementById('loginGate');
  var shell = document.getElementById('appShell');
  if(gate) gate.style.display = 'flex';
  if(shell) shell.style.display = 'none';
  document.body.classList.add('auth-locked');
  updateLocalLoginUi();
}
function showAppShell(){
  var gate = document.getElementById('loginGate');
  var shell = document.getElementById('appShell');
  if(gate) gate.style.display = 'none';
  if(shell) shell.style.display = 'block';
  document.body.classList.remove('auth-locked');
}
function updateLocalLoginUi(){
  var state = getLocalLoginState();
  var userEl = document.getElementById('localLoginUsername');
  var passEl = document.getElementById('localLoginPassword');
  var rememberEl = document.getElementById('localLoginRemember');
  var titleEl = document.getElementById('loginTitle');
  var subEl = document.getElementById('loginSubtitle');
  var hintEl = document.getElementById('localLoginHint');
  var btnEl = document.getElementById('localLoginBtn');
  if(titleEl) titleEl.textContent = (company && company.name) ? company.name : 'DrivePlan';
  if(state){
    if(subEl) subEl.textContent = 'Log in om de app te openen';
    if(hintEl) hintEl.textContent = 'Je lokale app-login staat al klaar op dit apparaat.';
    if(btnEl) btnEl.textContent = 'Inloggen';
    if(userEl) userEl.value = state.remember ? (state.username||'') : '';
    if(passEl) passEl.value = state.remember ? (state.password||'') : '';
    if(rememberEl) rememberEl.checked = !!state.remember;
  }else{
    if(subEl) subEl.textContent = 'Maak eerst je lokale app-login aan';
    if(hintEl) hintEl.textContent = 'Eerste keer? Vul je gebruikersnaam en wachtwoord in. Die worden dan op dit apparaat aangemaakt.';
    if(btnEl) btnEl.textContent = 'Account maken';
    if(rememberEl) rememberEl.checked = true;
  }
}
async function handleLocalLogin(){
  var state = getLocalLoginState();
  var username = ((document.getElementById('localLoginUsername')||{}).value||'').trim();
  var password = ((document.getElementById('localLoginPassword')||{}).value||'').trim();
  var remember = !!((document.getElementById('localLoginRemember')||{}).checked);
  if(!username || !password){ alert('Vul je gebruikersnaam en wachtwoord in.'); return false; }
  if(!state){
    saveLocalLoginState({username:username,password:password,remember:remember});
    setLocalLoginSession(true);
    showAppShell();
    toast('Lokale login aangemaakt');
    return true;
  }
  if(username !== String(state.username||'') || password !== String(state.password||'')){
    alert('Gebruikersnaam of wachtwoord klopt niet.');
    return false;
  }
  state.remember = remember;
  if(remember){ state.username = username; state.password = password; }
  saveLocalLoginState(state);
  setLocalLoginSession(true);
  showAppShell();
  return true;
}
function logoutFromApp(){
  // AANPASBAAR: lokale app-uitlog. Cloud-login blijft bewust behouden,
  // zodat je niet opnieuw in de app hoeft in te loggen voor upload/download.
  setLocalLoginSession(false);
  showLoginGate();
}
function initLocalLoginGate(){
  // Inloggen verwijderd: de app opent direct.
  showAppShell();
}


// Cloud sync verwijderd. De app werkt uitsluitend lokaal.
// Backup downloaden en Backup terugzetten zijn de overdrachtsmethode.
async function saveAppStateToCloud(){ return false; }
async function loadAppStateFromCloud(){ return false; }
function renderCloudSyncStatus(){ return; }
function initCloudSync(){ return; }

function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
function pad2(n){return (n<10?'0':'')+n}
function isoToday(){var n=new Date();return n.getFullYear()+'-'+pad2(n.getMonth()+1)+'-'+pad2(n.getDate())}
function addDays(d,n){var r=new Date(d);r.setDate(r.getDate()+n);return r}
function isoFromDateLocal(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
function fmtHead(d){try{return d.toLocaleDateString('nl-NL',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})}catch(e){return pad2(d.getDate())+'-'+pad2(d.getMonth()+1)+'-'+d.getFullYear()}}
function isoWeekNumber(d){
  var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  var weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  return weekNo;
}
function toast(msg){var t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},1300)}
function dbg(msg){var b=$('#debug'); if(b){ b.textContent=msg; }}
function escapeHtml(s){
  s = String(s==null?'':s);
  return s.replace(/[&<>"']/g,function(c){
    return c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':c==='"'?'&quot;':'&#39;';
  });
}
function euro(n){
  n = Number(n||0);
  return n.toLocaleString('nl-NL',{style:'currency',currency:'EUR'});
}
function sourceLabel(v){
  return v==='preeker' ? 'Preeker' : v==='old' ? 'Oude werkgever' : 'Eigen rijschool';
}
function sourceTagClass(v){
  return v==='preeker' ? 'source-preeker' : v==='old' ? 'source-old' : 'source-own';
}
function mondayOfWeek(d){
  var x = new Date(d);
  var dow = (x.getDay()||7)-1;
  x.setDate(x.getDate()-dow);
  x.setHours(0,0,0,0);
  return x;
}

function currentBrandName(){
  return (company && company.name) ? company.name : 'DrivePlan';
}
function currentBrandLogoHtml(maxH){
  var logoSrc = (company && company.logo) ? company.logo : DEFAULT_APP_LOGO;
  if(logoSrc) return '<img src="'+logoSrc+'" style="max-height:'+(maxH||42)+'px;max-width:180px;border-radius:8px" />';
  return '';
}
function hexToRgbParts(hex){
  hex = String(hex||'').trim().replace('#','');
  if(hex.length===3) hex = hex.split('').map(function(c){ return c+c; }).join('');
  if(!/^[0-9a-fA-F]{6}$/.test(hex)) return '0,64,128';
  var n = parseInt(hex, 16);
  return ((n>>16)&255)+','+((n>>8)&255)+','+(n&255);
}
function setHeroMeta(){
  var d = new Date();
  var dt = d.toLocaleDateString('nl-NL',{weekday:'long',day:'2-digit',month:'long'});
  var heroDate = $('#heroDatePill');
  if(heroDate) heroDate.textContent = dt.charAt(0).toUpperCase()+dt.slice(1);
  var modePill = $('#heroModePill');
  if(modePill) modePill.textContent = window.innerWidth > window.innerHeight ? 'Tablet • liggend' : 'Tablet • staand';
}
function applyBranding(){
  var img = $('#brandLogo');
  var nameEl = $('#brandName');
  var heroLogo = $('#heroLogo');
  var heroBadge = $('#heroBadge');
  var heroTitle = $('#heroTitle');
  var heroSub = $('#heroSubtitle');
  var taglineEl = $('#brandTagline');
  var brandName = currentBrandName();
  var brandTagline = (company && company.tagline) ? company.tagline : (brandName==='DrivePlan' ? 'Jouw planning, leerlingen en leskaart op één plek' : 'Persoonlijke rijschool planner voor in de auto');
  if(nameEl) nameEl.textContent = brandName;
  if(taglineEl) taglineEl.textContent = brandTagline;
  if(heroTitle) heroTitle.textContent = brandName;
  if(heroSub) heroSub.textContent = brandTagline;
  if(heroBadge) heroBadge.textContent = brandName.replace(/[^A-Za-z0-9]/g,'').slice(0,2).toUpperCase() || 'DP';
  var logoSrc = (company && company.logo) ? company.logo : DEFAULT_APP_LOGO;
  if(img){
    if(logoSrc){ img.src = logoSrc; img.style.display='block'; }
    else { img.removeAttribute('src'); img.style.display='none'; }
  }
  if(heroLogo){
    if(logoSrc){ heroLogo.src = logoSrc; heroLogo.style.display='block'; if(heroBadge) heroBadge.style.display='none'; }
    else { heroLogo.removeAttribute('src'); heroLogo.style.display='none'; if(heroBadge) heroBadge.style.display='flex'; }
  }
  var color = (company && company.color) ? company.color : '#004080';
  document.documentElement.style.setProperty('--blue', color);
  document.documentElement.style.setProperty('--blue-rgb', hexToRgbParts(color));
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  if(themeMeta) themeMeta.setAttribute('content', color);
  setHeroMeta();
}
function sanitizePhoneForWhatsApp(nr){
  nr = String(nr||'').replace(/[^\d+]/g,'');
  if(!nr) return '';
  if(nr.indexOf('+')===0) return nr.slice(1);
  if(nr.indexOf('00')===0) return nr.slice(2);
  if(nr.indexOf('0')===0) return '31'+nr.slice(1);
  return nr;
}
function normalizePhoneForTel(nr){
  return String(nr||'').replace(/[^0-9+]/g,'');
}
function openPhoneCall(nr){
  nr = normalizePhoneForTel(nr);
  if(!nr) return false;
  location.href = 'tel:' + nr;
  return true;
}
function openAddressNavigation(addr){
  addr = String(addr||'').trim();
  if(!addr) return false;
  var url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);
  window.open(url, '_blank');
  return true;
}
function getLearnerById(lid){
  return learners.find(function(x){ return x.id===lid; }) || null;
}
function getCurrentSheetLearner(){
  var lidEl = document.getElementById('sheetLearner');
  var lid = lidEl && lidEl.value ? lidEl.value : selectedLearnerId;
  return getLearnerById(lid);
}
function quickContactDefaults(){
  return [
    {label:'Rijschool', phone:''},
    {label:'ANWB', phone:''},
    {label:'Partner', phone:''}
  ];
}
function quickContactItem(list, index){
  var defaults = quickContactDefaults();
  var fallback = defaults[index] || {label:'Snelnummer', phone:''};
  var item = Array.isArray(list) ? (list[index] || {}) : {};
  return {
    label: String(item.label || fallback.label || '').trim() || fallback.label,
    phone: String(item.phone || '').trim()
  };
}
function renderQuickContact(index, item){
  var n = index + 1;
  var labelEl = document.getElementById('quickLabel' + n);
  var valueEl = document.getElementById('quickValue' + n);
  var btn = document.getElementById('quickCall' + n);
  var chip = document.getElementById('quickChip' + n);
  var show = !!item.phone;

  if(labelEl) labelEl.textContent = item.label;
  if(valueEl) valueEl.textContent = item.phone || 'Niet ingesteld';
  if(btn){
    btn.disabled = !show;
    btn.setAttribute('data-phone', item.phone);
    btn.setAttribute('aria-label', 'Bel ' + item.label);
  }
  if(chip) chip.style.display = show ? 'flex' : 'none';
  return show;
}
function renderQuickContacts(){
  var list = Array.isArray(company.quickContacts) ? company.quickContacts : quickContactDefaults();
  var visibleCount = 0;
  quickContactDefaults().forEach(function(_, index){
    if(renderQuickContact(index, quickContactItem(list, index))) visibleCount++;
  });
  var strip = document.getElementById('contactStrip');
  if(strip) strip.style.display = visibleCount ? 'grid' : 'none';
}

function scheduleAutoBackup(){
  var key = 'dp_autobackup_prompt_'+isoToday();
  if(localStorage.getItem(key)==='1') return;
  function run(){
    if(localStorage.getItem(key)==='1') return;
    localStorage.setItem(key,'1');
    setTimeout(function(){
      try{
        exportBackup();
        toast('Automatische backup gedownload');
      }catch(e){
        console && console.log && console.log('Auto-backup mislukt', e);
      }
    }, 400);
    window.removeEventListener('pointerdown', run, true);
    window.removeEventListener('keydown', run, true);
  }
  window.addEventListener('pointerdown', run, true);
  window.addEventListener('keydown', run, true);
}

/* ===== PDF generator (zonder libraries) =====
   Simpele, betrouwbare PDF (A4) met tekstregels.
   - Geen externe libraries nodig (werkt offline).
   - Delen via Web Share API (Android) als beschikbaar.
*/
function pdfEscape(s){
  s = String(s==null?'':s);
  return s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/\r?\n/g,' ');
}
function wrapText(str, maxLen){
  str = String(str||'').trim();
  if(!str) return [''];
  var words = str.split(/\s+/);
  var lines = [];
  var cur = '';
  words.forEach(function(w){
    if(!cur){ cur = w; return; }
    if((cur+' '+w).length <= maxLen){ cur += ' '+w; }
    else { lines.push(cur); cur = w; }
  });
  if(cur) lines.push(cur);
  return lines;
}
function buildLeskaartLines(lid){
  var learner = learners.find(function(x){return x.id===lid;}) || {};
  var name = learner.name || 'Leerling';
  var today = isoToday();

  var lines = [];
  lines.push('DrivePlan - Leskaart');
  lines.push('Leerling: '+name);
  if(learner.email) lines.push('E-mail: '+learner.email);
  if(learner.phone) lines.push('Telefoon: '+learner.phone);
  if(learner.address) lines.push('Adres: '+learner.address);
  lines.push('Datum export: '+today);
  lines.push('');

  function lastScoreForPart(pid){
    var datesAsc = datesAscForLearner(lid);
    for(var i=datesAsc.length-1;i>=0;i--){
      var d = datesAsc[i];
      var v = scoreGet(lid, pid, d);
      if(v!==null && v!==undefined) return v;
    }
    return null;
  }
  function avg(arr){
    var nums = arr.filter(function(x){return typeof x==='number' && !isNaN(x);});
    if(!nums.length) return null;
    var s = nums.reduce(function(a,b){return a+b},0);
    return Math.round((s/nums.length)*10)/10;
  }

  lines.push('Samenvatting per module:');
  (curriculum.modules||[]).forEach(function(mod, mi){
    var parts = (mod.parts||[]);
    var lastScores = parts.map(function(p){ return lastScoreForPart(p.id); });
    var done = lastScores.filter(function(v){return typeof v==='number';}).length;
    var a = avg(lastScores);
    lines.push('  - '+(mod.label||('Module '+(mi+1)))+': '+done+'/'+parts.length+' ingevuld • Gemiddelde: '+(a==null?'—':a));
  });
  lines.push('');

  var datesAsc = datesAscForLearner(lid);
  lines.push('Lessen ('+datesAsc.length+'):');
  if(!datesAsc.length){
    lines.push('  (Nog geen lessen ingevuld)');
    return lines;
  }
  var perLine = 6;
  for(var i=0;i<datesAsc.length;i+=perLine){
    lines.push('  '+datesAsc.slice(i,i+perLine).join('  '));
  }
  lines.push('');
  lines.push('Scores (laatste score per rijtaak):');
  lines.push('');

  function lastScoreAndDate(pid){
    var dates = datesAsc;
    for(var i=dates.length-1;i>=0;i--){
      var d = dates[i];
      var v = scoreGet(lid, pid, d);
      if(v!==null && v!==undefined) return {v:v, d:d};
    }
    return null;
  }
  (curriculum.modules||[]).forEach(function(mod, mi){
    lines.push('['+(mod.label||('Module '+(mi+1)))+']');
    (mod.parts||[]).forEach(function(p, pi){
      var ls = lastScoreAndDate(p.id);
      var label = (mi+1)+'.'+(pi+1);
      var title = p.t||'';
      var base = label+'  '+title;
      var w = wrapText(base, 95);
      var scoreStr = ls ? ('  => '+ls.v+' (laatst: '+ls.d+')') : '  => —';
      lines.push('  '+w[0]+scoreStr);
      for(var wi=1; wi<w.length; wi++){
        lines.push('  '+w[wi]);
      }
    });
    lines.push('');
  });

  return lines;
}
function generateLeskaartPDFBlob(lid){
  var lines = buildLeskaartLines(lid);

  var pageW = 595, pageH = 842;
  var marginL = 40, marginT = 50, marginB = 50;
  var fontSize = 10;
  var lineH = 14;
  var maxLinesPerPage = Math.floor((pageH - marginT - marginB) / lineH);

  var pages = [];
  for(var i=0;i<lines.length;i+=maxLinesPerPage) pages.push(lines.slice(i, i+maxLinesPerPage));
  if(!pages.length) pages=[[]];

  var objs = [];
  function pushObj(s){ objs.push(s); return objs.length; }

  pushObj(''); // 1 Catalog
  pushObj(''); // 2 Pages
  var fontNum = pushObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // 3

  var kids = [];
  pages.forEach(function(plines){
    var y = pageH - marginT;
    var content = 'BT\n/F1 '+fontSize+' Tf\n';
    content += (marginL)+' '+y+' Td\n';
    plines.forEach(function(line, idx){
      if(idx>0) content += '0 -'+lineH+' Td\n';
      content += '('+pdfEscape(line)+') Tj\n';
    });
    content += 'ET\n';
    var stream = '<< /Length '+content.length+' >>\nstream\n'+content+'endstream';
    var contentNum = pushObj(stream);
    var pageObj = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageW+' '+pageH+'] /Resources << /Font << /F1 '+fontNum+' 0 R >> >> /Contents '+contentNum+' 0 R >>';
    var pageNum = pushObj(pageObj);
    kids.push(pageNum+' 0 R');
  });

  objs[1] = '<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+kids.length+' >>';
  objs[0] = '<< /Type /Catalog /Pages 2 0 R >>';

  var header = '%PDF-1.4\n';
  var body = '';
  var offsets = [0];
  var pos = header.length;

  for(var i=0;i<objs.length;i++){
    var objNum = i+1;
    var objStr = objNum+' 0 obj\n'+objs[i]+'\nendobj\n';
    offsets.push(pos);
    body += objStr;
    pos += objStr.length;
  }

  var xrefPos = header.length + body.length;
  var xref = 'xref\n0 '+(objs.length+1)+'\n';
  xref += '0000000000 65535 f \n';
  for(var j=1;j<offsets.length;j++){
    var off = offsets[j];
    xref += String(off).padStart(10,'0')+' 00000 n \n';
  }
  var trailer = 'trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xrefPos+'\n%%EOF';

  var pdfText = header + body + xref + trailer;
  return new Blob([pdfText], {type:'application/pdf'});
}
function downloadBlob(blob, filename){
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href)}, 1500);
}
async function sharePDFBlob(blob, filename, titleText){
  try{
    var file = new File([blob], filename, {type:'application/pdf'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({title:titleText||filename, text:titleText||filename, files:[file]});
      return true;
    }
  }catch(e){}
  return false;
}
function openMailForLearner(lid){
  var learner = learners.find(function(x){return x.id===lid;}) || {};
  var name = learner.name || 'leerling';
  var email = learner.email || '';
  var today = isoToday();
  var subj = 'Leskaart '+name+' ('+today+')';
  var body = ['Hoi '+name+',', '', 'Hierbij je bijgewerkte leskaart.', '', 'Groet,'].join('\n');
  location.href = 'mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body);
}
function openMailLeskaartAssist(lid){
  var learner = learners.find(function(x){return x.id===lid;}) || {};
  if(!learner.email){
    alert('Bij deze leerling staat nog geen e-mailadres ingevuld.');
    return;
  }
  openLeskaartPDF(lid);
  setTimeout(function(){
    openMailForLearner(lid);
  }, 200);
  toast('Leskaart geopend + mailadres ingevuld');
}
function defaultLessonWhatsAppTemplate(){
  // AANPASBAAR: standaard WhatsApp-tekst.
  // Beschikbare placeholders: {name} {date} {time} {endTime} {pickup} {note}
  return [
    'Hoi {name}!',
    'Reminder rijles: {date} om {time} (tot {endTime}).',
    '{pickup}',
    '{note}',
    'Tot dan!'
  ].join('\n');
}

function lessonWhatsAppText(ev){
  // AANPASBAAR: pas de standaardtekst aan via Instellingen > WhatsApp-bericht
  // of hieronder in defaultLessonWhatsAppTemplate().
  var l = learners.find(function(x){return x.id===ev.learnerId;}) || {};
  var nm = l.name || 'leerling';
  var endt = computeEndTimeStr(ev.time, ev.duration||60);
  var pickup = ev.pickup ? ('Ophalen: '+ev.pickup) : '';
  var note = ev.note ? ('Notitie: '+ev.note) : '';
  var template = ((company && company.whatsappTemplate) || '').trim() || defaultLessonWhatsAppTemplate();
  var replacements = {
    '{name}': nm,
    '{date}': ev.date || '',
    '{time}': ev.time || '',
    '{endTime}': endt || '',
    '{pickup}': pickup,
    '{note}': note
  };
  Object.keys(replacements).forEach(function(key){
    template = template.split(key).join(replacements[key] || '');
  });
  return template
    .split('\n')
    .map(function(line){ return line.replace(/[ 	]+$/g,'').trim(); })
    .filter(function(line, idx, arr){ return line!=='' || (idx>0 && idx<arr.length-1); })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}
function openWhatsAppForLesson(ev){
  var txt = lessonWhatsAppText(ev);
  var l = learners.find(function(x){return x.id===ev.learnerId;}) || {};
  var phone = (l.phone||'').trim();

  function waNumber(p){
    p = String(p||'').trim();
    if(!p) return '';
    // keep only digits
    var digits = p.replace(/[^0-9]/g,'');
    if(!digits) return '';

    // international prefix 00...
    if(digits.indexOf('00')===0 && digits.length>2) digits = digits.slice(2);

    // NL normalization:
    // - 06xxxxxxxx -> 316xxxxxxxx
    if(digits.indexOf('0')===0 && digits.length>=9) return '31'+digits.slice(1);

    // already NL country code
    if(digits.indexOf('31')===0) return digits;

    // fallback: assume already international
    return digits;
  }

  var num = waNumber(phone);
  if(!num){
    alert('Geen geldig telefoonnummer bij deze leerling. Vul bij Leerlingen > Telefoon bijv. 06-12345678 in.');
    var url2 = 'https://wa.me/?text=' + encodeURIComponent(txt);
    window.open(url2, '_blank');
    return;
  }
  var url = 'https://wa.me/' + num + '?text=' + encodeURIComponent(txt);
  window.open(url, '_blank');
}

/* ===== Leskaart PDF/Print (delen) ===== */
function buildLeskaartReportHTML(lid){
  var learner = learners.find(function(x){return x.id===lid;});
  var name = learner ? learner.name : 'Leerling';
  var email = learner ? (learner.email||'') : '';
  var phone = learner ? (learner.phone||'') : '';
  var address = learner ? (learner.address||'') : '';

  var datesAsc = datesAscForLearner(lid);
  var dates = datesAsc.slice(); // alle lessen
  var chunkSize = 12; // kolommen per tabel (printvriendelijk)

  function scoreGetSafe(pid, date){
    var v = scoreGet(lid, pid, date);
    return (v===null || v===undefined) ? '' : String(v);
  }

  function lastScoreForPart(pid){
    for(var i=datesAsc.length-1;i>=0;i--){
      var d = datesAsc[i];
      var v = scoreGet(lid, pid, d);
      if(v!==null && v!==undefined) return v;
    }
    return null;
  }
  function avg(arr){
    var nums = arr.filter(function(x){return typeof x==='number' && !isNaN(x);});
    if(!nums.length) return null;
    var s = nums.reduce(function(a,b){return a+b},0);
    return Math.round((s/nums.length)*10)/10;
  }

  var modRows = '';
  (curriculum.modules||[]).forEach(function(m, mi){
    var parts = (m.parts||[]);
    var lastScores = parts.map(function(p){ return lastScoreForPart(p.id); });
    var a = avg(lastScores);
    var done = lastScores.filter(function(v){return typeof v==='number';}).length;
    modRows += '<tr><td><b>'+escapeHtml(m.label||('Module '+(mi+1)))+'</b></td>'
            +  '<td>'+done+'/'+parts.length+'</td>'
            +  '<td>'+(a===null?'—':String(a))+'</td></tr>';
  });

  function chunk(arr, size){
  var out=[];
  for(var i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size));
  return out;
}
var dateChunks = chunk(dates, chunkSize);

function buildOneTable(datesChunk){
  var cols = datesChunk.length;
  var headCols = datesChunk.map(function(d){
    return '<th>'+escapeHtml(d)+'</th>';
  }).join('');

  var body = '';
  (curriculum.modules||[]).forEach(function(m, mi){
    body += '<tr class="mod"><td colspan="'+(2+cols)+'">'+escapeHtml(m.label||('Module '+(mi+1)))+'</td></tr>';
    (m.parts||[]).forEach(function(p, pi){
      body += '<tr><td class="nr">'+escapeHtml(String(mi+1)+'.'+String(pi+1))+'</td>'
           +  '<td class="task">'+escapeHtml(p.t||'')+'</td>';
      for(var ci=0; ci<cols; ci++){
        var vv = scoreGet(lid, p.id, datesChunk[ci]);
        var cls = (typeof vv==='number' && !isNaN(vv)) ? (' s'+vv) : '';
        body += '<td class="sc'+cls+'">'+escapeHtml((vv===null || vv===undefined)?'':String(vv))+'</td>';
      }
      body += '</tr>';
    });
  });

  return '<table><thead><tr><th>Nr</th><th>Rijtaak</th>'+headCols+'</tr></thead><tbody>'+body+'</tbody></table>';
}

var tablesHTML = '';
if(!dateChunks.length){
  tablesHTML = '<div class="muted" style="margin-top:12px">Nog geen lessen ingevuld voor deze leerling.</div>';
}else{
  // Nieuwste eerst (zoals je leskaart)
  dateChunks = dateChunks.slice().reverse();
  dateChunks.forEach(function(dc, idx){
    tablesHTML += '<div class="chunk-title">Overzicht lessen ('+(dateChunks.length-idx)+'/'+dateChunks.length+')</div>';
    tablesHTML += buildOneTable(dc.slice().reverse()); // oudste → nieuwste binnen chunk
  });
}

  var today = isoToday();
  var htmlDoc = `<!doctype html>
<html lang="nl"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(currentBrandName())} - Leskaart ${escapeHtml(name)} (${today})</title>
<style>
  body{font-family:Arial,system-ui,sans-serif;margin:18px;color:#111827}
  .top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
  .brand{font-size:20px;font-weight:900;color:#004080}
  .box{border:1px solid #e5e7eb;border-radius:12px;padding:12px;min-width:260px}
  .muted{color:#6b7280;font-size:13px}
  .big{font-size:16px;font-weight:900}
  table{border-collapse:collapse;width:100%;margin-top:14px}
  th,td{border:1px solid #e5e7eb;padding:8px;font-size:12px;vertical-align:top}
  th{background:#f5f7fa}
  .nr{width:54px;font-weight:900;white-space:nowrap}
  .task{min-width:240px}
  .sc{text-align:center;width:44px;font-weight:900}

  /* score kleuren (1–8) */
  .s1{background:#ffd0d0;color:#7a0b0b}
  .s2{background:#ffe3f0;color:#8a1450}
  .s3{background:#efe3ff;color:#4c1d95}
  .s4{background:#fff0e0;color:#9a4a00}
  .s5{background:#fff9d6;color:#6a5b00}
  .s6{background:#e6f7e9;color:#0f5a1b}
  .s7{background:#bfe7c8;color:#0b4514}
  .s8{background:#86cf97;color:#072f0d}

  .mod td{background:#eaf4ff;font-weight:900;color:#0b376a}
  .chunk-title{margin-top:18px;font-weight:900;color:#004080}
  table{page-break-inside:avoid}
  .sum{margin-top:12px}
  .sum td,.sum th{font-size:13px}
  .actions{margin-top:14px;display:flex;gap:10px;flex-wrap:wrap}
  button,a.btn{border:0;border-radius:10px;padding:10px 12px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px}
  .p{background:#004080;color:#fff}
  .g{background:#f3f4f6;color:#111827}
  @media print {.actions{display:none} body{margin:0} .box{border:0} *{-webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;}}

/* Module progress bars */
.mp-wrap{display:grid;gap:8px;margin-top:6px}
.mp-row{display:flex;align-items:center;gap:10px;flex-wrap:nowrap}
.mp-lbl{min-width:56px;font-weight:900;color:#111827}
.mp-bar{flex:1;height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden}
.mp-fill{height:100%;background:rgba(0,64,128,.75);border-radius:999px}
.mp-pct{min-width:46px;text-align:right;font-weight:900;color:#374151;font-size:.9rem}
.mp-sub{font-size:.85rem;color:#6b7280;font-weight:700}

</style>
</head>
<body>
  <div class="top">
    <div>
      ${currentBrandLogoHtml(38)}<div class="brand">${escapeHtml(currentBrandName())} • Leskaart</div>
      <div class="big">${escapeHtml(name)}</div>
      <div class="muted">Datum: ${today}</div>
      ${email?`<div class="muted">E-mail: ${escapeHtml(email)}</div>`:''}
      ${phone?`<div class="muted">Telefoon: ${escapeHtml(phone)}</div>`:''}
      ${address?`<div class="muted">Adres: ${escapeHtml(address)}</div>`:''}
    </div>
    <div class="box" style="flex:1;max-width:460px">
      <div style="font-weight:900;margin-bottom:6px">Samenvatting per module</div>
      <table class="sum">
        <thead><tr><th>Module</th><th>Ingevuld</th><th>Gemiddelde (laatste score)</th></tr></thead>
        <tbody>${modRows}</tbody>
      </table>
      <div class="muted" style="margin-top:6px">Tip: gebruik Print → Opslaan als PDF. Volledig automatisch mailen met PDF-bijlage kan vanuit deze lokale app nog niet, maar je mailadres wordt wel alvast ingevuld.</div>
    </div>
  </div>

  ${tablesHTML}

  <div class="actions">
    <button class="p" id="leskaartPrintBtn" type="button">🖨️ Print / Opslaan als PDF</button>
    <a class="btn g" href="mailto:${encodeURIComponent(email||'')}?subject=${encodeURIComponent('Leskaart '+name+' ('+today+')')}&body=${encodeURIComponent('Hoi '+name+',\n\nHierbij je leskaart (PDF).\n\nGroet,\n')}">✉️ Mail klaarzetten</a>
    <button class="g" id="leskaartCloseBtn" type="button">Sluiten</button>
  </div>

</body></html>`;
  return htmlDoc;
}
function openLeskaartPDF(lid){
  var htmlDoc = buildLeskaartReportHTML(lid);
  var w = window.open('', '_blank');
  if(!w){ alert('Pop-up geblokkeerd. Sta pop-ups toe voor deze site.'); return; }
  w.document.open();
  w.document.write(htmlDoc);
  w.document.close();
}
function addMonthsISO(iso, n){
  var p=iso.split('-'); var d=new Date(parseInt(p[0],10),parseInt(p[1],10)-1,parseInt(p[2],10));
  var m=d.getMonth()+n; var y=d.getFullYear()+Math.floor(m/12);
  m = ((m%12)+12)%12;
  var day=d.getDate();
  var last=new Date(y,m+1,0).getDate();
  d = new Date(y,m, Math.min(day,last));
  return isoFromDateLocal(d);
}

/* ===== Agenda tijdsloten (MOET BOVENAAN) ===== */
var slots=(function(){
  var a=[],h=8,m=0;
  while(h<21||(h===21&&m<=30)){
    a.push(pad2(h)+':'+pad2(m));
    m+=5; if(m===60){m=0;h++;}
  }
  return a;
})();

/* kleuren mapping 1–8 */
function cellClass(s){
  return s===1?'donkerrood'
    : s===2?'roze'
    : s===3?'paars'
    : s===4?'oranje'
    : s===5?'geel'
    : s===6?'groen6'
    : s===7?'groen7'
    : s===8?'groen8'
    : '';
}

/* ===== Duur opties ===== */
function buildDurationOptions(selected){
  var html='';
  var legacy=[50,100];
  legacy.forEach(function(m){
    var label=(m===50)?'50 min (1 blok)':'100 min (2 blokken / 1u40)';
    html+='<option value="'+m+'"'+(String(m)===String(selected)?' selected':'')+'>'+label+'</option>';
  });
  for(var m=60;m<=480;m+=30){
    var label2=m+' min ('+Math.floor(m/60)+':'+pad2(m%60)+')';
    html+='<option value="'+m+'"'+(String(m)===String(selected)?' selected':'')+'>'+label2+'</option>';
  }
  return html;
}
function normalizeDuration(m){
  m=parseInt(m,10);
  if(!m) return 60;
  if(m===50 || m===100) return m;
  if(m<60) m=60;
  if(m>480) m=480;
  m=Math.round(m/30)*30;
  return m;
}

/* ===== Storage keys ===== */
var K={
  learners:'dp40_learners',
  lessons:'dp40_lessons',
  progress:'dp40_progress',
  sel:'dp40_sel',
  hist:'dp40_hist',
  invoices:'dp40_invoices',
  invCounter:'dp40_inv_counter',
  company:'dp40_company',
  curriculum:'dp40_curriculum',
  invoiceItems:'dp40_invoice_items',
  rentalWeek:'dp40_rental_week',
  invRevenueMode:'dp40_inv_revenue_mode',
  invRevenuePeriod:'dp40_inv_revenue_period'
};

/* ===== Default curriculum (modules + parts) ===== */
function defaultCurriculum(){
  return {
    version:'1',
    modules:[
      {id:'m1', label:'Module 1 — Techniek van de auto', cls:'mod1', parts:[
        {id:1,t:'Controle buiten de auto / in- en uitstappen'},
        {id:2,t:'Zithouding / stuurhouding / spiegels afstellen'},
        {id:3,t:'Controle in de auto / starten & afzetten motor'},
        {id:4,t:'Stuur-oefeningen / kijktechniek'},
        {id:5,t:'Ontkoppelen / koppelen / wegrijden'},
        {id:6,t:'Stoppen'},
        {id:7,t:'Opschakelen'},
        {id:8,t:'Terugschakelen & afremtechniek'},
        {id:9,t:'Gasdosering / snelheidsregeling'}
      ]},
      {id:'m2', label:'Module 2 — Bedrevenheid & kijktechniek', cls:'mod2', parts:[
        {id:10,t:'Veilig en technisch wegrijden / stoppen'},
        {id:11,t:'Plaats op de weg / rijstrook'},
        {id:12,t:'Tegemoetkomen en ingehaald worden'},
        {id:13,t:'Kruispunten — gelijkwaardig'},
        {id:14,t:'Kruispunten — voorrang'},
        {id:15,t:'Kruispunten — complex'},
        {id:16,t:'Richting veranderen — rechts'},
        {id:17,t:'Richting veranderen — links'},
        {id:18,t:'Rotondes 1/4'},
        {id:19,t:'Rotondes 2/4'},
        {id:20,t:'Rotondes 3/4'},
        {id:21,t:'Rotondes 4/4'}
      ]},
      {id:'m3', label:'Module 3 — Informatieverwerking & verkeersinzicht', cls:'mod3', parts:[
        {id:22,t:'Rijstrook wisselen / zijdelings verplaatsen'},
        {id:23,t:'Inhalen en voorbijgaan'},
        {id:24,t:'Invoegen'},
        {id:25,t:'Uitrijden'},
        {id:26,t:'Bewust kijken'},
        {id:27,t:'Volgafstand / ruimtekussen'},
        {id:28,t:'Navigatie'}
      ]},
      {id:'m4', label:'Module 4 — Bijzondere verrichtingen', cls:'mod4', parts:[
        {id:29,t:'Hellingproef'},
        {id:30,t:'Achteruit rijden — rechte lijn'},
        {id:31,t:'Achteruit rijden — bocht'},
        {id:32,t:'Keren — steken'},
        {id:33,t:'Keren — halve draai'},
        {id:34,t:'Parkeren file — voorwaarts links'},
        {id:35,t:'Parkeren file — voorwaarts rechts'},
        {id:36,t:'Parkeren file — achterwaarts rechts'},
        {id:37,t:'Parkeren haaks — voorwaarts links'},
        {id:38,t:'Parkeren haaks — voorwaarts rechts'},
        {id:39,t:'Parkeren schuin — voorwaarts links'},
        {id:40,t:'Parkeren schuin — voorwaarts rechts'},
        {id:41,t:'Parkeren — achterwaarts haaks/schuin rechts'}
      ]}
    ]
  };
}

/* ===== Curriculum state ===== */
var curriculum = store.read(K.curriculum, null);
if(!curriculum || !curriculum.modules || !Array.isArray(curriculum.modules)){
  curriculum = defaultCurriculum();
  store.write(K.curriculum, curriculum);
}
function allPartsFlat(){
  var out=[];
  (curriculum.modules||[]).forEach(function(m){
    (m.parts||[]).forEach(function(p){ out.push(p); });
  });
  // sort by numeric id
  out.sort(function(a,b){return (a.id||0)-(b.id||0)});
  return out;
}
function nextPartId(){
  var flat=allPartsFlat();
  var max=0;
  flat.forEach(function(p){ if((p.id||0)>max) max=p.id; });
  return max+1;
}
function nextModuleId(){
  var n = (curriculum.modules||[]).length + 1;
  return 'm'+n+'_'+uid().slice(0,4);
}
function moduleClassByIndex(i){
  var classes=['mod1','mod2','mod3','mod4','mod5'];
  return classes[i%classes.length];
}


/* Veilige app-instellingen: voorkomt ontbrekende velden na sync op een nieuw apparaat. */
function defaultCompanyState(){
  return {
    name:'DrivePlan',
    tagline:'Jouw planning, leerlingen en leskaart op één plek',
    logo:'',
    color:'#004080',
    phone:'',
    email:'',
    address:'',
    kvk:'',
    vat:'',
    iban:'',
    accountName:'',
    paymentDays:14,
    paymentText:'',
    preekerRate:42.56,
    whatsappTemplate:'',
    quickContacts:[
      {label:'Rijschool', phone:''},
      {label:'ANWB', phone:''},
      {label:'Partner', phone:''}
    ]
  };
}
function normalizeCompanyState(value){
  var base=defaultCompanyState();
  var src=(value && typeof value==='object') ? value : {};
  var out=Object.assign({}, base, src);
  if(!Array.isArray(out.quickContacts)){
    out.quickContacts=base.quickContacts.slice();
  }else{
    out.quickContacts=base.quickContacts.map(function(def, i){
      return Object.assign({}, def, out.quickContacts[i] || {});
    });
  }
  return out;
}

/* ===== Data ===== */
var learners = store.read(K.learners,[
  {id:uid(),name:'Pieter Jansen',phone:'06-12345678',email:'pieter@example.com',avgMinutes:100,note:''},
  {id:uid(),name:'Maartje Visser',phone:'06-87654321',email:'maartje@example.com',avgMinutes:100,note:''}
]);
var lessons = store.read(K.lessons,[]);
var progress = store.read(K.progress,{});
var invoices = store.read(K.invoices,[]);
var invCounter = store.read(K.invCounter, 1000);
var company = normalizeCompanyState(store.read(K.company, defaultCompanyState()));
company = normalizeCompanyState(company);

learners = (learners||[]).map(function(l){
  if(!l.source) l.source = 'own';
  return l;
});
store.write(K.learners, learners);

var selectedLearnerId = store.read(K.sel, (learners.length?learners[0].id:'') );
var historicalMode = !!store.read(K.hist,false);
var rentalWeekStored = store.read(K.rentalWeek, '');
var rentalWeekStart = mondayOfWeek(rentalWeekStored ? new Date(rentalWeekStored) : new Date());
if(isNaN(rentalWeekStart.getTime())) rentalWeekStart = mondayOfWeek(new Date());
var invRevenueMode = store.read(K.invRevenueMode, 'month');
if(invRevenueMode!=='week' && invRevenueMode!=='month') invRevenueMode='month';
var invRevenuePeriodStored = store.read(K.invRevenuePeriod, '');
var invRevenuePeriodStart = invRevenuePeriodStored ? new Date(invRevenuePeriodStored) : new Date();
if(isNaN(invRevenuePeriodStart.getTime())) invRevenuePeriodStart = new Date();
invRevenuePeriodStart = invRevenueMode==='week' ? mondayOfWeek(invRevenuePeriodStart) : new Date(invRevenuePeriodStart.getFullYear(), invRevenuePeriodStart.getMonth(), 1);

/* ===== Backup (export/import) ===== */
function exportBackup(){
  var payload = {
    version:'4.21-local-no-invoices',
    exportedAt: new Date().toISOString(),
    learners: learners,
    lessons: lessons,
    progress: progress,
    company: company,
    curriculum: curriculum,
    selectedLearnerId: selectedLearnerId,
    historicalMode: historicalMode,
    rentalWeekStart: isoFromDateLocal(rentalWeekStart),
  };
  var blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'driveplan-backup-'+isoToday()+'.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href)}, 1500);
}
function importBackupFile(file){
  var reader = new FileReader();

  reader.onload = async function(){
    try{
      var data = JSON.parse(reader.result);
      if(!data || typeof data !== 'object') throw new Error('Ongeldig bestand');
      if(!confirm('Backup terugzetten? Dit overschrijft je huidige data.')) return;

      learners = Array.isArray(data.learners) ? data.learners : [];
      lessons = Array.isArray(data.lessons) ? data.lessons : [];
      progress = data.progress || {};
      company = data.company || company;
      curriculum = data.curriculum && Array.isArray(data.curriculum.modules) ? data.curriculum : curriculum;
      selectedLearnerId = data.selectedLearnerId || (learners[0] ? learners[0].id : '');
      historicalMode = !!data.historicalMode;
      rentalWeekStart = mondayOfWeek(data.rentalWeekStart ? new Date(data.rentalWeekStart) : new Date());

      store.write(K.learners, learners);
      store.write(K.lessons, lessons);
      store.write(K.progress, progress);
      store.write(K.company, company);
      store.write(K.curriculum, curriculum);
      store.write(K.sel, selectedLearnerId);
      store.write(K.hist, historicalMode);
      store.write(K.rentalWeek, isoFromDateLocal(rentalWeekStart));


      rebuildLearnerOptions();
      renderWeek();
      renderLearners();
      renderSheet();
      renderModuleManager();
      toast('Backup teruggezet');
    }catch(e){
      alert('Backup import mislukt: ' + e.message);
    }
  };

  reader.readAsText(file);
}