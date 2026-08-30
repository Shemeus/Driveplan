/* ===== Leerlingen ===== */
var modalLearner=$('#modalLearner');
var lrName=$('#lrName'), lrPhone=$('#lrPhone'), lrEmail=$('#lrEmail'), lrAvg=$('#lrAvg'), lrNote=$('#lrNote'), lrAddress=$('#lrAddress'), lrAddress2=$('#lrAddress2'), lrAddress3=$('#lrAddress3'), lrZip=$('#lrZip'), lrRelation=$('#lrRelation'), lrSource=$('#lrSource'), lrPackage=$('#lrPackage'), lrPackageStats=$('#lrPackageStats');
var editLearnerId=null;

function round1(n){ return Math.round((Number(n)||0)*10)/10; }
function findPackageById(id){
  if(!id) return null;
  var key = String(id||'').trim();
  return INVOICE_ITEMS.find(function(x){ return x.id===key && x.group==='Pakketten'; })
      || INVOICE_ITEMS.find(function(x){ return (x.name||'').trim()===key && x.group==='Pakketten'; })
      || null;
}
function learnerConsumedPackageLessons(lid, pkg){
  if(!lid || !pkg) return 0;
  var baseMinutes = Number(pkg.lessonMinutes||60) || 60;
  var today = isoToday();
  var totalMinutes = lessons.filter(function(ev){
    return ev.learnerId===lid && ev.type==='lesson' && ev.date && ev.date<=today;
  }).reduce(function(sum, ev){
    return sum + (Number(ev.duration||0)||0);
  }, 0);
  return round1(totalMinutes / baseMinutes);
}
function learnerPackageProgress(l){
  if(!l || !l.packageId) return null;
  var pkg = findPackageById(l.packageId);
  if(!pkg) return {missing:true};
  var total = Number(pkg.lessonCount||0)||0;
  var used = learnerConsumedPackageLessons(l.id, pkg);
  var remaining = round1(Math.max(0, total - used));
  return {pkg:pkg,total:total,used:used,remaining:remaining};
}
function populateLearnerPackageSelect(selectedId){
  if(!lrPackage) return;
  var items = packageItems();
  var html = '<option value="">Geen pakket</option>' + items.map(function(it){
    return '<option value="'+escapeHtml(it.id)+'">'+escapeHtml(it.name||'Pakket')+'</option>';
  }).join('');
  lrPackage.innerHTML = html;
  lrPackage.value = selectedId || '';
}
function updateLearnerPackageStatsDisplay(lid, packageId){
  if(!lrPackageStats) return;
  if(!packageId){
    lrPackageStats.textContent = 'Nog geen pakket gekozen';
    return;
  }
  var pkg = findPackageById(packageId);
  if(!pkg){
    lrPackageStats.textContent = 'Gekozen pakket bestaat niet meer';
    return;
  }
  var used = learnerConsumedPackageLessons(lid, pkg);
  var total = Number(pkg.lessonCount||0)||0;
  var remaining = round1(Math.max(0, total - used));
  lrPackageStats.innerHTML = '<b>'+escapeHtml(pkg.name||'Pakket')+'</b> • Verbruikt: <b>'+String(used).replace('.',',')+'</b> van <b>'+String(total).replace('.',',')+'</b> • Resterend: <b>'+String(remaining).replace('.',',')+'</b>';
}
async function copyTextToClipboard(txt){
  txt = String(txt||'').trim();
  if(!txt) return false;
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(txt);
      return true;
    }
  }catch(e){}
  try{
    var ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  }catch(e){}
  return false;
}

function openLearnerModal(l){
  editLearnerId=(l&&l.id)?l.id:null;
  $('#lrTitle').textContent=editLearnerId?'Leerling bewerken':'Nieuwe leerling';

  lrName.value=(l&&l.name)?l.name:'';
  lrPhone.value=(l&&l.phone)?l.phone:'';
  lrEmail.value=(l&&l.email)?l.email:'';
  lrAddress.value=(l&&l.address)?l.address:'';
  if(lrAddress2) lrAddress2.value=(l&&l.address2)?l.address2:'';
  if(lrAddress3) lrAddress3.value=(l&&l.address3)?l.address3:'';
  lrZip.value=(l&&l.zip)?l.zip:'';
  lrRelation.value=(l&&l.relationNumber)?l.relationNumber:'';
  lrSource.value=(l&&l.source)?l.source:'own';
  lrNote.value=(l&&l.note)?l.note:'';

  var avg=(l&&typeof l.avgMinutes==='number')?l.avgMinutes:100;
  lrAvg.innerHTML=buildDurationOptions(normalizeDuration(avg));
  populateLearnerPackageSelect((l&&l.packageId)?l.packageId:'');
  updateLearnerPackageStatsDisplay((l&&l.id)?l.id:null, (l&&l.packageId)?l.packageId:'');

  if(modalLearner){
    modalLearner.style.display='flex';
    modalLearner.scrollTop = 0;
    var card = modalLearner.querySelector('.learner-modal');
    if(card) card.scrollTop = 0;
  }
  document.body.classList.add('modal-open');
}
function closeLearnerModal(){
  if(modalLearner) modalLearner.style.display='none';
  document.body.classList.remove('modal-open');
}

function addSingleEvent(el, key, eventName, handler){
  if(!el) return;
  var flag = 'bound' + key;
  if(el.dataset[flag] === '1') return;
  el.dataset[flag] = '1';
  el.addEventListener(eventName, handler);
}

function setFinanceSection(name){
  var map = {
    new: document.getElementById('finSectionNew'),
    list: document.getElementById('finSectionList'),
    products: document.getElementById('finSectionProducts')
  };
  var tabs = [
    ['finTabNewBtn','new'],
    ['finTabListBtn','list'],
    ['finTabProductsBtn','products']
  ];

  Object.keys(map).forEach(function(key){
    if(map[key]) map[key].style.display = (key === name ? 'block' : 'none');
  });

  tabs.forEach(function(pair){
    var btn = document.getElementById(pair[0]);
    if(btn) btn.classList.toggle('active', pair[1] === name);
  });

  if(name === 'new'){
    var sel = document.getElementById('invLearner');
    if(sel && !sel.value && sel.options.length){ sel.selectedIndex = 0; }
    try{ renderInvoiceDraft(); }catch(e){}
  }
}

function bindFinanceTabs(){
  [
    ['finTabNewBtn','new'],
    ['finTabListBtn','list'],
    ['finTabProductsBtn','products']
  ].forEach(function(pair){
    var btn = document.getElementById(pair[0]);
    if(!btn) return;
    btn.removeAttribute('onclick');
    addSingleEvent(btn, 'FinanceTab', 'click', function(e){
      if(e) e.preventDefault();
      setFinanceSection(pair[1]);
    });
  });

  var vatBtn = document.getElementById('finTabVatBtn');
  if(vatBtn && vatBtn.parentNode) vatBtn.parentNode.removeChild(vatBtn);
  var vatSection = document.getElementById('finSectionVat');
  if(vatSection && vatSection.parentNode) vatSection.parentNode.removeChild(vatSection);

  setFinanceSection('new');
}


function toggleMobileWeekAgenda(e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  var body=document.body;
  var btn=document.getElementById('dpWeekToggle');
  if(!body) return false;
  body.classList.toggle('show-mobile-week');
  if(btn){
    btn.textContent=body.classList.contains('show-mobile-week')
      ? '📅 Weekagenda verbergen'
      : '📅 Weekagenda tonen';
  }
  try{ renderWeek(); }catch(err){ console.warn(err); }
  return false;
}


function dpMobileMenuToggle(e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  document.body.classList.toggle('mobile-nav-open');
  return false;
}
function dpMobileMenuClose(e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  document.body.classList.remove('mobile-nav-open');
  return false;
}
function dpMobileGo(tab, e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  try{
    if(typeof switchTab === 'function') switchTab(tab);
  }catch(err){
    console.error('Mobiele navigatie fout', err);
  }
  document.body.classList.remove('mobile-nav-open');
  return false;
}

function bindMobileUI(){
  var body = document.body;
  var wrap = document.getElementById('dpDaylistsWrap');
  var mobileMenuBtn = document.getElementById('mobileMenuBtn');
  var sidebarMenuBtn = document.getElementById('sidebarMobileMenuBtn');
  var backdrop = document.getElementById('mobileNavBackdrop');
  var dayBtn = document.getElementById('dpDayToggle');
  var weekBtn = document.getElementById('dpWeekToggle');
  var dayKey = 'dp40_daylists_collapsed';

  function closeMenu(){
    if(body.classList.contains('mobile-nav-open')) body.classList.remove('mobile-nav-open');
  }
  function openMenu(){
    if(body.classList.contains('mobile-nav-open')) return;
    body.classList.add('mobile-nav-open');
    try{
      if(window.history && window.history.pushState){
        window.history.pushState({dpMenu:true, dpTab:(window.__dpCurrentTab||'agenda')}, '', '#menu');
      }
    }catch(err){}
  }
  function syncDayBtn(){
    if(!dayBtn || !wrap) return;
    dayBtn.textContent = wrap.classList.contains('dp-collapsed') ? 'Uitklappen' : 'Inklappen';
  }
  function syncWeekBtn(){
    if(!weekBtn) return;
    weekBtn.textContent = body.classList.contains('show-mobile-week')
      ? '📅 Weekagenda verbergen'
      : '📅 Weekagenda tonen';
  }

  try{
    if(wrap){
      wrap.classList.toggle('dp-collapsed', !!store.read(dayKey, false));
    }
  }catch(e){}

  if(mobileMenuBtn){
    mobileMenuBtn.removeAttribute('onclick');
    addSingleEvent(mobileMenuBtn, 'MobileMenu', 'click', function(e){
      if(e){ e.preventDefault(); e.stopPropagation(); }
      if(body.classList.contains('mobile-nav-open')) closeMenu(); else openMenu();
    });
  }

  if(sidebarMenuBtn){
    sidebarMenuBtn.removeAttribute('onclick');
    addSingleEvent(sidebarMenuBtn, 'SidebarMenu', 'click', function(e){
      if(e){ e.preventDefault(); e.stopPropagation(); }
      closeMenu();
    });
  }

  if(backdrop){
    backdrop.removeAttribute('onclick');
    addSingleEvent(backdrop, 'Backdrop', 'click', function(e){
      if(e) e.preventDefault();
      closeMenu();
    });
  }

  syncDayBtn();

  if(weekBtn){
    weekBtn.setAttribute('onclick','return toggleMobileWeekAgenda(event)');
    syncWeekBtn();
  }

  Array.prototype.slice.call(document.querySelectorAll('.tab-btn')).forEach(function(btn){
    addSingleEvent(btn, 'MobileClose', 'click', function(){ closeMenu(); });
  });

  if(window.__dpMobileResizeBound !== true){
    window.__dpMobileResizeBound = true;
    window.addEventListener('resize', function(){
      if(window.innerWidth > 700) closeMenu();
      syncWeekBtn();
    });
  }
}

function bindAgenda(){
  bindMobileUI();
}

function bindLearners(){
  return true;
}

function bindInvoices(){
  bindFinanceTabs();
  return true;
}

function initApp(){
  if(typeof invoiceRebuildNumbersIfNeeded==='function') invoiceRebuildNumbersIfNeeded();
  rebuildLearnerOptions();
  renderLearners();
  renderModuleManager();
  renderWeek();
  renderSheet();
  bindAgenda();
  bindLearners();
  bindInvoices();
}

async function saveLearner(){
  var name=lrName.value.trim();
  if(!name){ alert('Naam is verplicht'); return; }

  var phone=lrPhone.value.trim();
  var email=lrEmail.value.trim();
  var address=(lrAddress.value||'').trim();
  var address2=(lrAddress2&&lrAddress2.value||'').trim();
  var address3=(lrAddress3&&lrAddress3.value||'').trim();
  var zip=(lrZip.value||'').trim();
  var avg=parseInt(lrAvg.value,10);
  var relationNumber=(lrRelation.value||'').trim();
  var source=(lrSource.value||'own').trim();
  var packageId=(lrPackage && lrPackage.value ? lrPackage.value : '').trim();
  var note=lrNote.value.trim();

  var okAvg = (avg===50 || avg===100) || (avg>=60 && avg<=480 && avg%30===0);
  if(!okAvg){
    alert('Standaard lesduur moet 50/100 zijn of 60–480 in stappen van 30.');
    return;
  }

  var validEmail=!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  var validPhone=!phone || /^[0-9+\-\s()]{6,}$/.test(phone);
  if(!validPhone){alert('Ongeldig telefoonnummer');return;}
  if(!validEmail){alert('Ongeldig e-mailadres');return;}

  var exists=learners.some(function(l){
    return l.name.toLowerCase()===name.toLowerCase() && l.id!==editLearnerId;
  });
  if(exists){ alert('Er bestaat al een leerling met deze naam.'); return; }

  if(editLearnerId){
  var i=learners.findIndex(function(x){return x.id===editLearnerId});
  if(i>=0){
    learners[i]={id:editLearnerId,name:name,phone:phone,email:email,address:address,address2:address2,address3:address3,zip:zip,avgMinutes:normalizeDuration(avg),relationNumber:relationNumber,source:source,packageId:packageId,note:note};
  }
  toast('Bijgewerkt');
}else{
  learners.push({id:uid(),name:name,phone:phone,email:email,address:address,address2:address2,address3:address3,zip:zip,avgMinutes:normalizeDuration(avg),relationNumber:relationNumber,source:source,packageId:packageId,note:note});
  toast('Toegevoegd');
}

store.write(K.learners,learners);
await saveAppStateToCloud();

// Heeft deze leerling een e-mailadres, controleer de DrivePortal-sync meteen zichtbaar.
// Zo weet je na Opslaan direct of de leerling ook voor DriveFactuur/DrivePortal beschikbaar is.
if(email && typeof window.syncDrivePortalNow === 'function'){
  try{
    // store.write plant al een achtergrond-sync in. Geef die eerst kort de tijd,
    // daarna voert de zichtbare sync zo nodig nogmaals de volledige update uit.
    await new Promise(function(resolve){ setTimeout(resolve, 1400); });
    await window.syncDrivePortalNow(true);
  }catch(portalSyncErr){
    console.warn('Leerling direct naar DrivePortal synchroniseren mislukt', portalSyncErr);
    alert('Leerling is wel bijgewerkt in DrivePlan, maar DrivePortal synchroniseren gaf een fout:\n\n'+
      (portalSyncErr && portalSyncErr.message ? portalSyncErr.message : String(portalSyncErr)));
  }
}

rebuildLearnerOptions();
renderLearners();
renderWeek();
renderSheet();
closeLearnerModal();
}

async function deleteLearner(id){
  if(!confirm('Leerling verwijderen? (lessen + voortgang worden ook verwijderd)')) return;

  var removedLearner = learners.find(function(l){ return l.id === id; }) || null;
  var list = document.getElementById('learnerList');
  var row = list ? list.querySelector('.row[data-id="'+id+'"]') : null;
  if(row) row.remove();

  lessons = lessons.filter(function(ev){ return ev.learnerId !== id });
  invoices = invoices.filter(function(inv){ return inv.learnerId !== id });
  store.write(K.lessons, lessons);
  store.write(K.invoices, invoices);

  delete progress[id];
  store.write(K.progress, progress);

  learners = learners.filter(function(l){ return l.id !== id });
  store.write(K.learners, learners);

  if(selectedLearnerId === id){
    selectedLearnerId = learners.length ? learners[0].id : '';
  }
  store.write(K.sel, selectedLearnerId);

  if(typeof markCloudLocalMutation === 'function'){
    markCloudLocalMutation(5000);
  }

  try{
    await saveAppStateToCloud();
  }catch(e){
    console.warn('Cloud sync na verwijderen mislukt', e);
    toast('Leerling verwijderd (cloud sync later opnieuw proberen)');
  }

  rebuildLearnerOptions();
  renderLearners();
  renderWeek();
  renderSheet();
  toast('Leerling verwijderd');
}
/* renderLearners */
function renderLearners(){
  var list=$('#learnerList');
  var q = ($('#learnerSearch') && $('#learnerSearch').value ? $('#learnerSearch').value.trim().toLowerCase() : '');

  var arr = learners.slice().sort(function(a,b){
    return (a.name||'').localeCompare((b.name||''), 'nl');
  });

  if(q){
    arr = arr.filter(function(l){
      var name=(l.name||'').toLowerCase();
      var phone=(l.phone||'').toLowerCase();
      var email=(l.email||'').toLowerCase();
      var source=(sourceLabel(l.source||'own')).toLowerCase();
      return name.indexOf(q)!==-1 || phone.indexOf(q)!==-1 || email.indexOf(q)!==-1 || source.indexOf(q)!==-1;
    });
  }

  if(!arr.length){
    list.innerHTML = '<div class="small">Geen leerlingen gevonden.</div>';
    return;
  }

  var html='';
  arr.forEach(function(l){
    var avg=(typeof l.avgMinutes==='number')?l.avgMinutes:100;
    var source = l.source || 'own';
    var prog = learnerPackageProgress(l);
    var packageLine = '';
    if(prog && prog.pkg){
      var pct = prog.total>0 ? Math.max(0, Math.min(100, Math.round((prog.used/prog.total)*100))) : 0;
      var usedTxt = String(prog.used).replace('.',',');
      var totalTxt = String(prog.total).replace('.',',');
      var remainingTxt = String(prog.remaining).replace('.',',');
      var colorCls = pct < 50 ? 'green' : (pct < 85 ? 'orange' : 'red');
      var warn = (pct >= 85) ? '<div class="pkg-warn">⚠ Bijna klaar voor examen</div>' : '';
      packageLine = ''+
        '<div class="lp-progress">'+
          '<div class="pkg-name">'+escapeHtml(prog.pkg.name||'Pakket')+'</div>'+
          '<div class="pkg-nums">'+escapeHtml(usedTxt)+' / '+escapeHtml(totalTxt)+' lessen</div>'+
          '<div class="lp-bar"><div class="lp-bar-fill '+colorCls+'" style="width:'+pct+'%"></div></div>'+
          (source==='own' ? '<div class="pkg-remain">'+escapeHtml(remainingTxt)+' lessen resterend</div>' : '')+
          warn+
        '</div>';
    }else if(prog && prog.missing){
      packageLine = '<div class="lp-progress">Gekozen pakket bestaat niet meer.</div>';
    }
    html +=
      '<div class="row click-row" data-id="'+l.id+'">'+
        '<div>'+
          '<h4>'+escapeHtml(l.name)+' <span class="tag '+sourceTagClass(source)+'">'+escapeHtml(sourceLabel(source))+'</span></h4>'+
          '<div class="meta">📞 '+escapeHtml(l.phone||'-')+' • ✉️ '+escapeHtml(l.email||'-')+' • Standaard: '+avg+' min</div>'+
          (l.relationNumber?'<div class="small" style="margin-top:4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">CBR relatienummer: <b>'+escapeHtml(l.relationNumber)+'</b> <button class="btn btn-ghost" data-action="copyrelation" type="button">Kopieer</button></div>':'')+
          packageLine+
          (l.note?'<div class="small" style="margin-top:6px">'+escapeHtml(l.note)+'</div>':'')+
          ((l.email||'').trim() ? '<div class="portal-avail-box" data-portal-availability="'+escapeHtml(String(l.id))+'"><div class="portal-avail-title">🕒 Beschikbaarheidsvoorkeuren</div><div class="small portal-avail-content">Laden…</div></div>' : '')+
        '</div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
          ((l.email||'').trim() ? '<button class="btn btn-ghost" data-action="portalinvite">🚘 DrivePortal uitnodigen</button><button class="btn btn-ghost" data-action="portalcopy">Link kopiëren</button>' : '')+
          '<button class="btn btn-ghost" data-action="sheet">Leskaart</button>'+
          '<button class="btn btn-ghost" data-action="edit">Bewerken</button>'+
          '<button class="btn btn-danger" data-action="delete">Verwijderen</button>'+
        '</div>'+
      '</div>';
  });
  list.innerHTML=html;
  renderPortalAvailabilityIntoRows();
}


var portalAvailabilityLoadSeq = 0;

function portalWeekdayName(n){
  return ['Zo','Ma','Di','Wo','Do','Vr','Za'][Number(n)] || '?';
}

function portalTimeShort(v){
  return String(v || '').slice(0,5);
}

function portalDateNl(v){
  if(!v) return '';
  var p = String(v).split('-');
  return p.length===3 ? (p[2]+'-'+p[1]+'-'+p[0]) : String(v);
}

function renderPortalAvailabilityIntoRows(){
  if(typeof window.loadDrivePortalAvailabilityMap !== 'function') return;

  var boxes = document.querySelectorAll('[data-portal-availability]');
  if(!boxes.length) return;

  var seq = ++portalAvailabilityLoadSeq;

  window.loadDrivePortalAvailabilityMap().then(function(map){
    if(seq !== portalAvailabilityLoadSeq) return;

    boxes.forEach(function(box){
      var lid = String(box.getAttribute('data-portal-availability') || '');
      var data = map && map[lid] ? map[lid] : {slots:[], exceptions:[]};
      var slots = data.slots || [];
      var exceptions = data.exceptions || [];
      var content = box.querySelector('.portal-avail-content');
      if(!content) return;

      if(!slots.length && !exceptions.length){
        content.innerHTML = '<span class="portal-avail-empty">Nog geen voorkeuren doorgegeven.</span>';
        return;
      }

      var byDay = {};
      slots.forEach(function(a){
        var d = Number(a.weekday);
        if(!byDay[d]) byDay[d] = [];
        byDay[d].push(portalTimeShort(a.start_time)+'–'+portalTimeShort(a.end_time));
      });

      var order = {1:1,2:2,3:3,4:4,5:5,6:6,0:7};
      var slotHtml = Object.keys(byDay)
        .sort(function(a,b){ return order[a]-order[b]; })
        .map(function(d){
          return '<span class="portal-avail-chip"><b>'+portalWeekdayName(d)+'</b> '+escapeHtml(byDay[d].join(', '))+'</span>';
        }).join('');

      var excHtml = '';
      if(exceptions.length){
        excHtml = '<div class="portal-avail-exceptions"><b>Afwijkingen:</b> '+
          exceptions.map(function(e){
            var range = portalDateNl(e.start_date);
            if(e.end_date && e.end_date !== e.start_date) range += ' t/m '+portalDateNl(e.end_date);
            return '<span>'+escapeHtml(range+(e.note ? ' · '+e.note : ''))+'</span>';
          }).join(' • ')+'</div>';
      }

      content.innerHTML = '<div class="portal-avail-chips">'+slotHtml+'</div>'+excHtml;
    });
  }).catch(function(err){
    console.warn('DrivePortal beschikbaarheid laden', err);
    boxes.forEach(function(box){
      var content = box.querySelector('.portal-avail-content');
      if(content) content.textContent = 'Voorkeuren konden niet worden geladen.';
    });
  });
}


function openInvoiceForLearner(lid){
  var learner = learners.find(function(x){ return x.id===lid; });
  toast('Financiën is verwijderd voor ' + ((learner&&learner.name) || 'deze leerling'));
}

function openSheetFor(lid){
  if(!lid) return;
  selectedLearnerId = lid;
  try{ store.write(K.sel, selectedLearnerId); }catch(e){}
  if(typeof rebuildLearnerOptions === 'function') rebuildLearnerOptions();
  if(typeof switchTab === 'function') switchTab('sheet');
  else if(typeof renderSheet === 'function') renderSheet();
}

$('#learnerList').addEventListener('click', function(e){
  var btn = e.target.closest('button[data-action]');
  var row = e.target.closest('.row[data-id]');
  if(!row) return;

  var id = row.getAttribute('data-id');

  if(btn){
    var action = btn.getAttribute('data-action');
    if(action==='newinvoice'){
      openInvoiceForLearner(id);
    }else if(action==='portalinvite'){
      var l=learners.find(function(x){return x.id===id});
      if(!l || !(l.email||'').trim()){
        toast('Vul eerst een e-mailadres in bij deze leerling');
        return;
      }
      var firstName=((l.name||'').trim().split(/\s+/)[0] || '');
      var portalUrl='https://portal.rijschooldenhartog.nl/';
      var txt='Hoi'+(firstName?' '+firstName:'')+', je kunt vanaf nu gebruikmaken van DrivePortal van Rijschool Den Hartog. Hier vind je je leskaart, voortgang en afspraken. Ook kun je aangeven op welke dagen en tijden je bij voorkeur beschikbaar bent.\n\nGa naar '+portalUrl+' en vul het e-mailadres in waarmee je bij de rijschool bekend bent: '+(l.email||'').trim()+'. Je ontvangt daarna per e-mail een persoonlijke inloglink.';
      var num=(typeof sanitizePhoneForWhatsApp==='function') ? sanitizePhoneForWhatsApp(l.phone||'') : '';
      var waUrl=num ? ('https://wa.me/'+num+'?text='+encodeURIComponent(txt)) : ('https://wa.me/?text='+encodeURIComponent(txt));
      window.open(waUrl,'_blank','noopener');
    }else if(action==='portalcopy'){
      copyTextToClipboard('https://portal.rijschooldenhartog.nl/').then(function(ok){
        toast(ok ? 'DrivePortal-link gekopieerd' : 'Kopiëren mislukt');
      });
    }else if(action==='sheet'){
      openSheetFor(id);
    }else if(action==='edit'){
      var l=learners.find(function(x){return x.id===id});
      if(l) openLearnerModal(l);
    }else if(action==='delete'){
      deleteLearner(id);
    }else if(action==='invoices'){
      openLearnerInvoicesModal(id);
    }else if(action==='copyrelation'){
      var l=learners.find(function(x){return x.id===id});
      if(l && l.relationNumber){
        copyTextToClipboard(l.relationNumber).then(function(ok){
          toast(ok ? 'CBR relatienummer gekopieerd' : 'Kopiëren mislukt');
        });
      }
    }
    return;
  }
  openSheetFor(id);
});

/* ===== Display helpers for parts (module.volgnummer) ===== */
function partDisplayByPid(pid){
  pid = parseInt(pid,10);
  var mods = (curriculum.modules||[]);
  for(var mi=0; mi<mods.length; mi++){
    var parts = mods[mi].parts || [];
    for(var pi=0; pi<parts.length; pi++){
      if(parseInt(parts[pi].id,10)===pid){
        return {mi:mi, pi:pi, label:String(mi+1)+'.'+String(pi+1), title:(parts[pi].t||'')};
      }
    }
  }
  return {mi:null, pi:null, label:String(pid), title:''};
}

/* ===== Progress helpers ===== */
function scoreGet(lid,pid,date){
  return (progress[lid] && progress[lid][pid] && (date in progress[lid][pid])) ? progress[lid][pid][date] : null;
}
function scoreSet(lid,pid,date,val){
  if(!progress[lid]) progress[lid]={};
  if(!progress[lid][pid]) progress[lid][pid]={};

  if(val===null){
    delete progress[lid][pid][date];
    if(Object.keys(progress[lid][pid]).length===0) delete progress[lid][pid];
    if(Object.keys(progress[lid]).length===0) delete progress[lid];
  }else{
    progress[lid][pid][date]=val;
  }
  store.write(K.progress,progress);
}

/* ===== Score popup ===== */
var modalScore=$('#modalScore');
var scoreMeta=$('#scoreMeta');
var scoreGrid=$('#scoreGrid');
var scoreClearBtn=$('#scoreClear');
var scoreCancelBtn=$('#scoreCancel');
var scoreFillModuleBtn=$('#scoreFillModule');
var scoreFillLessonBtn=$('#scoreFillLesson');
var scoreCloseToggle=$('#scoreCloseToggle');

var scoreCtx=null;
var chosenScore=null;

function closeScoreModal(){
  modalScore.style.display='none';
  scoreCtx=null;
  chosenScore=null;
}
modalScore.addEventListener('click', function(e){
  if(e.target===modalScore) closeScoreModal();
});

function applyScoreToPidList(lid, date, pidList, val){
  pidList.forEach(function(pid){
    scoreSet(lid, pid, date, val);
    var el = document.querySelector('#sheet .score[data-part="'+pid+'"][data-date="'+date+'"]');
    if(el){
      el.textContent = (val===null?'':String(val));
      el.className = 'score '+(val?cellClass(val):'')+' clickable';
    }
  });
  toast('Opgeslagen');
}

function openScoreModal(ctx){
  scoreCtx=ctx;
  chosenScore = scoreGet(ctx.lid, ctx.pid, ctx.date);
  scoreMeta.textContent='Onderdeel '+(ctx.display||ctx.pid)+' • Les '+ctx.date;

  var html='';
  for(var i=1;i<=8;i++){
    html+='<button class="score-btn" data-val="'+i+'">'+i+'</button>';
  }
  scoreGrid.innerHTML=html;

  $all('#scoreGrid .score-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var v=parseInt(btn.getAttribute('data-val'),10);
      chosenScore=v;

      scoreSet(ctx.lid, ctx.pid, ctx.date, v);
      ctx.el.textContent=v;
      ctx.el.className='score '+cellClass(v)+' clickable';
      toast('Opgeslagen');

      if(scoreCloseToggle && scoreCloseToggle.checked){
        closeScoreModal();
      }
    });
  });

  scoreClearBtn.onclick=function(){
    scoreSet(ctx.lid, ctx.pid, ctx.date, null);
    ctx.el.textContent='';
    ctx.el.className='score clickable';
    toast('Opgeslagen');
    closeScoreModal();
  };

  scoreFillModuleBtn.onclick=function(){
    if(!chosenScore){ alert('Kies eerst een score (1–8).'); return; }
    var mod = (curriculum.modules||[]).find(function(m){
      return (m.parts||[]).some(function(p){return p.id===ctx.pid;});
    });
    if(!mod){ alert('Module niet gevonden.'); return; }
    var pids = (mod.parts||[]).map(function(p,pi){return p.id;});
    applyScoreToPidList(ctx.lid, ctx.date, pids, chosenScore);
  };

  scoreFillLessonBtn.onclick=function(){
    if(!chosenScore){ alert('Kies eerst een score (1–8).'); return; }
    var pids = allPartsFlat().map(function(p,pi){return p.id;});
    applyScoreToPidList(ctx.lid, ctx.date, pids, chosenScore);
  };

  scoreCancelBtn.onclick=closeScoreModal;
  modalScore.style.display='flex';
}

var SHEET_COLLAPSE_KEY='driveplan.sheetModuleCollapse.v1';
function readSheetCollapseState(){
  try{ return JSON.parse(localStorage.getItem(SHEET_COLLAPSE_KEY)||'{}') || {}; }catch(e){ return {}; }
}
function writeSheetCollapseState(state){
  try{ localStorage.setItem(SHEET_COLLAPSE_KEY, JSON.stringify(state||{})); }catch(e){}
}
function isSheetModuleCollapsed(mid){
  var state = readSheetCollapseState();
  return !!state[mid];
}
function setSheetModuleCollapsed(mid, collapsed){
  var state = readSheetCollapseState();
  state[mid] = !!collapsed;
  writeSheetCollapseState(state);
}
function applySheetModuleCollapseState(){
  var mobile = window.innerWidth <= 700;
  $all('#sheet .modband').forEach(function(band){
    var mid = band.getAttribute('data-mod-id') || '';
    var collapsed = mobile && isSheetModuleCollapsed(mid);
    band.classList.toggle('is-collapsed', collapsed);
    var btn = band.querySelector('.sheet-toggle');
    if(btn){ btn.textContent = collapsed ? 'Uitklappen' : 'Inklappen'; }
    $all('#sheet .module-row[data-mod-id="'+mid+'"], #sheet .module-cell[data-mod-id="'+mid+'"]').forEach(function(el){
      el.classList.toggle('sheet-row-hidden', collapsed);
    });
  });
}

/* ===== Render leskaart ===== */
function renderSheet(){
  var keep=$('#sheetLearner').value;
  var learnerOptions = learners.slice().sort(function(a,b){
    return (a.name||'').localeCompare((b.name||''), 'nl');
  });
  $('#sheetLearner').innerHTML=learnerOptions.map(function(l){return '<option value="'+l.id+'">'+escapeHtml(l.name)+'</option>'}).join('');

  if(selectedLearnerId && learners.some(function(l){return l.id===selectedLearnerId})) $('#sheetLearner').value=selectedLearnerId;
  else if(learners.some(function(l){return l.id===keep})) $('#sheetLearner').value=keep;
  else $('#sheetLearner').value=(learners[0]?learners[0].id:'');

  var lid=$('#sheetLearner').value;
  selectedLearnerId=lid;
  store.write(K.sel,lid);

  var learnerObj=learners.find(function(l){return l.id===lid});
  var avg=learnerObj? (typeof learnerObj.avgMinutes==='number'?learnerObj.avgMinutes:100) : 100;

  var datesAsc=datesAscForLearner(lid);
  var total=datesAsc.length;
  // Gebruik voor het urentotaal de WERKELIJKE duur van de agenda-afspraken.
  // Voorheen werd 'standaard lesduur × aantal lesdatums' gebruikt. Daardoor
  // veranderde het urentotaal niet wanneer een bestaande les van bv. 60 naar
  // 120 minuten werd aangepast.
  var actualMinutes = lessons.filter(function(ev){
    return ev.learnerId===lid && ev.date;
  }).reduce(function(sum, ev){
    return sum + (Number(ev.duration||0)||0);
  }, 0);
  var hours=Math.round((actualMinutes/60)*10)/10;
  $('#sheetStats').textContent='Lessen: '+total+' • Uren: '+hours;

  // Module voortgang (percentage ingevuld) — met balkjes
  var mpEl = document.getElementById('moduleProgressLine');
  if(mpEl){
    function lastScoreForPart(pid){
      for(var i=datesAsc.length-1;i>=0;i--){
        var d = datesAsc[i];
        var v = scoreGet(lid, pid, d);
        if(v!==null && v!==undefined) return v;
      }
      return null;
    }

    var rowsHTML = '';
    (curriculum.modules||[]).forEach(function(mod, mi){
      var parts=(mod.parts||[]);
      var done=0;
      for(var j=0;j<parts.length;j++){
        if(lastScoreForPart(parts[j].id)!==null) done++;
      }
      var pct = parts.length ? Math.round((done/parts.length)*100) : 0;
      var title = (mod.label||('Module '+(mi+1)));
      rowsHTML += ''
        + '<div class="mp-row" title="'+escapeHtml(title)+'">'
        +   '<div class="mp-lbl">M'+(mi+1)+'</div>'
        +   '<div class="mp-bar"><div class="mp-fill" style="width:'+pct+'%"></div></div>'
        +   '<div class="mp-pct">'+pct+'%</div>'
        + '</div>';
    });

    mpEl.innerHTML = rowsHTML ? ('<div class="mp-wrap">'+rowsHTML+'</div>') : '';
  }

  var datesWindow=datesAsc.slice(-51);
  var datesDisplay=datesWindow.slice().reverse();
  function examForDate(d){
    return lessons.find(function(ev){return ev.learnerId===lid && ev.date===d && ev.type==='exam';}) || null;
  }

  function lessonNumberForDate(d){
    var wi=datesWindow.indexOf(d);
    if(wi<0) return '';
    return (total - (datesWindow.length - 1 - wi));
  }

  var el=$('#sheet');
  var html='';

  html+='<div class="header-top"><div class="header-row"><div class="left-header">Onderdeel</div>';
  for(var i=0;i<51;i++){
    var d=datesDisplay[i]||'';
    var nr=d?lessonNumberForDate(d):'';
    var exam=d?examForDate(d):null;
    var label=d?(exam?('<div class="exam-head">EXAMEN<small>'+d+'</small></div>'):('<div>Les '+nr+'<small>'+d+'</small></div>')):('<div>—<small>&nbsp;</small></div>');
    html+='<div class="col-header'+(exam?' exam-col-header':'')+'">'+label+'</div>';
  }
  html+='</div></div>';

  html+='<div class="sheet-grid">';
  (curriculum.modules||[]).forEach(function(m, mi){
    var cls = m.cls || moduleClassByIndex(mi);
    var mid = String(m.id || ('module_'+mi));
    var collapsed = isSheetModuleCollapsed(mid);
    html+='<div class="modband '+cls+(collapsed?' is-collapsed':'')+'" data-mod-id="'+escapeHtml(mid)+'" style="grid-column:1 / -1; position:sticky; top:58px;">';
    html+='<div class="modcell"><span>'+escapeHtml(m.label||('Module '+(mi+1)))+' <span class="sheet-mod-meta">(Onderdelen: '+((m.parts||[]).length)+')</span></span><button type="button" class="sheet-toggle" data-mod-id="'+escapeHtml(mid)+'">'+(collapsed?'Uitklappen':'Inklappen')+'</button></div>';
    for(i=0;i<51;i++){ html+='<div class="sheet-cell '+cls+'"></div>'; }
    html+='</div>';

    (m.parts||[]).forEach(function(p, pi){
      var disp = (mi+1)+'.'+(pi+1);
      html+='<div class="sheet-cell part-label module-row" data-mod-id="'+escapeHtml(mid)+'"><span class="part-id" title="ID: '+escapeHtml(String(p.id))+'">'+escapeHtml(disp+'.')+'</span> '+escapeHtml(p.t||'')+'</div>';
      for(i=0;i<51;i++){
        var date=datesDisplay[i]||'';
        var exam=date?examForDate(date):null;
        var s=(date&&!exam)?scoreGet(lid,p.id,date):null;
        var clickable=!!date && !exam && (historicalMode || i===0);
        var scoreText=exam?'EX':(s!==null?s:'');
        html+='<div class="sheet-cell module-cell'+(exam?' exam-sheet-cell':'')+'" data-mod-id="'+escapeHtml(mid)+'"><div class="score '+(exam?'exam-score ':((s?cellClass(s):'')))+(clickable?' clickable':' locked')+'" data-date="'+date+'" data-part="'+p.id+'" data-display="'+escapeHtml(disp)+'" '+(clickable?'':'data-locked="1"')+' title="'+(exam?'Praktijkexamen – geen scores invoeren':'')+'">'+scoreText+'</div></div>';
      }
    });
  });
  html+='</div>';
  el.innerHTML=html;

  $all('#sheet .score').forEach(function(sc){
    sc.addEventListener('click', function(){
      if(sc.getAttribute('data-locked')==='1') return;
      var date=sc.getAttribute('data-date'); if(!date) return;
      var pid=parseInt(sc.getAttribute('data-part'),10);
      var display=sc.getAttribute('data-display')||'';
      openScoreModal({lid: lid, pid: pid, date: date, el: sc, display: display});
    });
  });

  $all('#sheet .sheet-toggle').forEach(function(btn){
    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      var mid = btn.getAttribute('data-mod-id') || '';
      setSheetModuleCollapsed(mid, !isSheetModuleCollapsed(mid));
      applySheetModuleCollapseState();
    });
  });

  applySheetModuleCollapseState();
  $('#sheetWrap').scrollLeft=0;
}
window.addEventListener('resize', applySheetModuleCollapseState);
$('#sheetLearner').addEventListener('change', function(){
  selectedLearnerId=this.value;
  store.write(K.sel, selectedLearnerId);
  renderSheet();
});
$('#historicalToggle').addEventListener('change', function(){
  historicalMode=this.checked;
  store.write(K.hist,historicalMode);
  renderSheet();
});