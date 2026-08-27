/* ===== Datums per leerling ===== */
function datesAscForLearner(lid){
  var uniq={};
  lessons.forEach(function(ev){
    if(ev.learnerId===lid && ev.date) uniq[ev.date]=true;
  });
  return Object.keys(uniq).sort();
}

/* ===== Agenda ===== */
function suggestNextTime(){
  var n=new Date(),h=n.getHours(),m=Math.ceil(n.getMinutes()/5)*5;
  if(m===60){m=0;h++}
  if(h<8){h=9;m=0}
  if(h>21||(h===21&&m>30)){h=9;m=0}
  return pad2(h)+':'+pad2(m);
}
var weekStart=(function(){
  var d=new Date();
  var dow=(d.getDay()||7)-1;
  d.setDate(d.getDate()-dow);
  d.setHours(0,0,0,0);
  return d
})();

function minutesToTimeStr(total){
  total = ((total%1440)+1440)%1440;
  var h = Math.floor(total/60), m = total%60;
  return pad2(h)+':'+pad2(m);
}
function computeEndTimeStr(startHHMM, durationMin){
  if(!startHHMM) return '—';
  var parts = startHHMM.split(':');
  var sh = parseInt(parts[0]||'0',10), sm = parseInt(parts[1]||'0',10);
  var start = sh*60+sm;
  var dur = parseInt(durationMin,10) || 0;
  if(dur<=0) return '—';
  return minutesToTimeStr(start + dur);
}

/* ===== Vandaag/Morgen lijst ===== */
function fmtShortDate(iso){
  try{
    var p=iso.split('-');
    var d=new Date(parseInt(p[0],10),parseInt(p[1],10)-1,parseInt(p[2],10));
    return d.toLocaleDateString('nl-NL',{weekday:'short',day:'2-digit',month:'2-digit'});
  }catch(e){ return iso; }
}

function syncDaylistsToggle(){
  var btn = document.getElementById('dpDayToggle');
  var wrap = document.getElementById('dpDaylistsWrap');
  if(!btn || !wrap) return;
  btn.textContent = wrap.classList.contains('dp-collapsed') ? 'Uitklappen' : 'Inklappen';
}

function toggleDaylists(e){
  if(e){
    e.preventDefault();
    e.stopPropagation();
  }

  var wrap = document.getElementById('dpDaylistsWrap');
  if(!wrap) return false;

  wrap.classList.toggle('dp-collapsed');

  try{
    store.write('dp40_daylists_collapsed', wrap.classList.contains('dp-collapsed'));
  }catch(err){}

  syncDaylistsToggle();
  return false;
}

function initDaylistsToggle(){
  var wrap = document.getElementById('dpDaylistsWrap');
  if(!wrap) return;

  var collapsed = false;
  try{
    collapsed = !!store.read('dp40_daylists_collapsed', false);
  }catch(err){
    collapsed = false;
  }

  wrap.classList.toggle('dp-collapsed', collapsed);
  syncDaylistsToggle();
}

function renderTodayTomorrow(){
  var todayISO = isoToday();
  var tomorrowISO = isoFromDateLocal(addDays(new Date(), 1));

  ['dpTodayLabelToolbar','dpTodayLabelCard'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.textContent = fmtShortDate(todayISO);
  });
  ['dpTomorrowLabelToolbar','dpTomorrowLabelCard'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.textContent = fmtShortDate(tomorrowISO);
  });

  function renderList(dateISO, targetId){
    var wrap = document.getElementById(targetId);
    if(!wrap) return;

    var items = lessons
      .filter(function(ev){ return ev.date === dateISO; })
      .slice()
      .sort(function(a,b){
        return String(a.time||'').localeCompare(String(b.time||''));
      });

    if(!items.length){
      wrap.innerHTML = '<div class="dp-empty">(Geen afspraken)</div>';
      return;
    }

    wrap.innerHTML = items.map(function(ev){
      var l = learners.find(function(x){ return x.id===ev.learnerId; }) || {};
      var name = (ev.type==='private') ? 'Privé' : (l.name||'Onbekend');
      var endt = computeEndTimeStr(ev.time, ev.duration||50);

      var typeLabel = ev.type==='exam' ? 'Examen' :
                      ev.type==='trial' ? 'Proefles' :
                      ev.type==='private' ? 'Privé' : 'Rijles';

      var pickup = ev.pickup ? ('Ophalen: '+escapeHtml(ev.pickup)) : '';
      var note = ev.note ? escapeHtml(ev.note) : '';

      return ''
      + '<div class="dp-item" data-ev="'+escapeHtml(ev.id)+'">'
      +   '<div class="t">'+escapeHtml(ev.time||'—')+' – '+escapeHtml(endt)+' <span class="tag" style="margin-left:6px">'+escapeHtml(typeLabel)+'</span></div>'
      +   '<div class="n">'+escapeHtml(name)+'</div>'
      +   (pickup ? '<div class="m">'+pickup+'</div>' : '')
      +   (note ? '<div class="m">'+note+'</div>' : '')
      +   '<div class="toolbar">'
      +     (ev.pickup ? '<button class="btn btn-ghost dp-nav" data-addr="'+escapeHtml(ev.pickup)+'">📍 Nav</button>' : '')
      +     '<button class="btn btn-ghost dp-wa" data-ev="'+escapeHtml(ev.id)+'">💬 App</button>'
      +     (l.phone ? '<button class="btn btn-ghost dp-call" data-phone="'+escapeHtml(l.phone)+'">📞 Bel</button>' : '')
      +     '<button class="btn btn-ghost dp-sheet" data-lid="'+escapeHtml(ev.learnerId||'')+'">🧾 Leskaart</button>'
      +   '</div>'
      + '</div>';
    }).join('');

    // klik op kaart = open bewerken
    Array.prototype.slice.call(wrap.querySelectorAll('.dp-item')).forEach(function(node){
      node.addEventListener('click', function(){
        var id = node.getAttribute('data-ev');
        if(id) openLessonModal(id);
      });
    });

    // Navigatie knop
    Array.prototype.slice.call(wrap.querySelectorAll('.dp-nav')).forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var addr = btn.getAttribute('data-addr') || '';
        if(!addr) return;
        openAddressNavigation(addr);
      });
    });

    // Bel knop
    Array.prototype.slice.call(wrap.querySelectorAll('.dp-call')).forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var phone = (btn.getAttribute('data-phone') || '').trim();
        if(!phone) return;
        openPhoneCall(phone);
      });
    });

    // WhatsApp reminder knop
    Array.prototype.slice.call(wrap.querySelectorAll('.dp-wa')).forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var id = btn.getAttribute('data-ev');
        var ev = lessons.find(function(x){ return x.id===id; });
        if(ev) openWhatsAppForLesson(ev);
      });
    });

    Array.prototype.slice.call(wrap.querySelectorAll('.dp-sheet')).forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var lid = btn.getAttribute('data-lid');
        if(!lid) return;
        selectedLearnerId = lid;
        try{ store.write(K.sel, selectedLearnerId); }catch(e){}
        switchTab('sheet');
      });
    });
  }

  renderList(todayISO, 'dpTodayList');
  renderList(tomorrowISO, 'dpTomorrowList');
}


var whoCanHereState = {date:'', time:'', duration:90};

function dpMinutes(t){
  var p=String(t||'00:00').split(':');
  return (Number(p[0])||0)*60 + (Number(p[1])||0);
}
function dpWeekdayForIso(iso){
  var p=String(iso).split('-');
  var d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  return d.getDay();
}
function dpExceptionBlocksDate(ex, iso){
  var start=String(ex.start_date||'');
  var end=String(ex.end_date||ex.start_date||'');
  return !!start && iso>=start && iso<=end;
}
function ensureWhoCanHereModal(){
  if(document.getElementById('whoCanHereModal')) return;
  var el=document.createElement('div');
  el.id='whoCanHereModal';
  el.style.cssText='position:fixed;inset:0;z-index:99990;background:rgba(15,23,42,.45);display:none;align-items:center;justify-content:center;padding:18px';
  el.innerHTML=
    '<div class="who-can-card">'+
      '<div class="who-can-head"><div><h3 style="margin:0">Wie kan hier?</h3><div class="small" id="whoCanHereWhen"></div></div><button class="btn btn-ghost" id="whoCanHereClose" type="button">Sluiten</button></div>'+
      '<div class="who-can-controls"><label>Lesduur <select id="whoCanHereDuration"><option value="60">60 min</option><option value="90" selected>90 min</option><option value="120">120 min</option></select></label></div>'+
      '<div id="whoCanHereResults" class="who-can-results"><div class="small">Beschikbaarheid laden…</div></div>'+
    '</div>';
  document.body.appendChild(el);
  document.getElementById('whoCanHereClose').addEventListener('click',function(){el.style.display='none'});
  el.addEventListener('click',function(e){if(e.target===el)el.style.display='none'});
  document.getElementById('whoCanHereDuration').addEventListener('change',function(){
    whoCanHereState.duration=Number(this.value)||90;
    loadWhoCanHereResults();
  });
}
function openWhoCanHere(date,time){
  ensureWhoCanHereModal();
  whoCanHereState.date=date;
  whoCanHereState.time=time;
  whoCanHereState.duration=90;
  document.getElementById('whoCanHereDuration').value='90';
  document.getElementById('whoCanHereWhen').textContent=date+' • '+time;
  document.getElementById('whoCanHereModal').style.display='flex';
  loadWhoCanHereResults();
}
async function loadWhoCanHereResults(){
  var out=document.getElementById('whoCanHereResults');
  if(!out) return;
  out.innerHTML='<div class="small">Beschikbaarheid laden…</div>';
  try{
    if(typeof window.loadDrivePortalAvailabilityMap!=='function') throw new Error('DrivePortal beschikbaarheid niet beschikbaar');
    var map=await window.loadDrivePortalAvailabilityMap();
    var weekday=dpWeekdayForIso(whoCanHereState.date);
    var start=dpMinutes(whoCanHereState.time);
    var end=start+Number(whoCanHereState.duration||90);
    var matches=[];

    learners.forEach(function(l){
      var d=map && map[String(l.id)];
      if(!d) return;
      var blocked=(d.exceptions||[]).some(function(ex){return dpExceptionBlocksDate(ex,whoCanHereState.date)});
      if(blocked) return;
      var slot=(d.slots||[]).find(function(s){
        return Number(s.weekday)===weekday && start>=dpMinutes(s.start_time) && end<=dpMinutes(s.end_time);
      });
      if(slot) matches.push({learner:l,slot:slot});
    });

    matches.sort(function(a,b){return (a.learner.name||'').localeCompare((b.learner.name||''),'nl')});
    if(!matches.length){
      out.innerHTML='<div class="who-can-empty">Niemand heeft voor dit hele tijdvak een passende beschikbaarheidsvoorkeur opgegeven.</div>';
      return;
    }
    out.innerHTML=matches.map(function(m){
      var l=m.learner;
      return '<div class="who-can-person">'+
        '<div><b>'+escapeHtml(l.name||'Leerling')+'</b><div class="small">Voorkeur '+escapeHtml(String(m.slot.start_time).slice(0,5))+'–'+escapeHtml(String(m.slot.end_time).slice(0,5))+'</div></div>'+
        '<button class="btn btn-primary who-can-plan" data-lid="'+escapeHtml(String(l.id))+'">Inplannen</button>'+
      '</div>';
    }).join('');

    Array.prototype.slice.call(out.querySelectorAll('.who-can-plan')).forEach(function(btn){
      btn.addEventListener('click',function(){
        var lid=btn.getAttribute('data-lid');
        document.getElementById('whoCanHereModal').style.display='none';
        selectedLearnerId=lid;
        openLessonModal(null);
        nlLearner.value=lid;
        nlDate.value=whoCanHereState.date;
        setNlTimeFromStr(whoCanHereState.time);
        nlDuration.innerHTML=buildDurationOptions(normalizeDuration(whoCanHereState.duration));
        var student=learners.find(function(x){return String(x.id)===String(lid)});
        if(nlPickup) nlPickup.value=(student&&student.address)?student.address:'';
        updateEndTime();
      });
    });
  }catch(e){
    console.warn('Wie kan hier',e);
    out.innerHTML='<div class="who-can-empty">Beschikbaarheid kon niet worden geladen.</div>';
  }
}

function renderWeek(){
  var todayISO = isoToday();
  var days=[0,1,2,3,4,5,6].map(function(i){return addDays(weekStart,i)});
  $('#weekHead').innerHTML='<div></div>'+days.map(function(d){return '<div class="hd">'+fmtHead(d)+'</div>'}).join('');

  var body='<div class="time-col">';
  slots.forEach(function(t){ var show = (String(t).slice(3)==='00'); body+='<div class="time-row">'+(show?t:'')+'</div>'; });
  body+='</div>';

  days.forEach(function(d){
    var iso=isoFromDateLocal(d);
    body+='<div class="day-col" data-date="'+iso+'">';
    slots.forEach(function(){body+='<div class="day-row"></div>'});
    body+='</div>';
  });
  $('#weekBody').innerHTML=body;

  // Klik op een leeg tijdvak om te zien welke leerlingen hier volgens hun
  // DrivePortal-voorkeuren volledig in passen.
  $all('.day-col').forEach(function(col){
    var date=col.getAttribute('data-date');
    Array.prototype.slice.call(col.querySelectorAll('.day-row')).forEach(function(row,idx){
      row.classList.add('who-can-slot');
      row.title='Wie kan hier?';
      row.addEventListener('click',function(e){
        if(e.target.closest('.event')) return;
        var time=slots[idx];
        if(date && time) openWhoCanHere(date,time);
      });
    });
  });

  var rowH = 28;
  try{
    var dr = document.querySelector('.day-row');
    if(dr){ rowH = dr.getBoundingClientRect().height; }
  }catch(e){}

  var startISO=isoFromDateLocal(days[0]), endISO=isoFromDateLocal(days[6]);
  var inWeek=lessons.filter(function(l){return l.date>=startISO && l.date<=endISO});

  var colMap={};
  $all('.day-col').forEach(function(el){colMap[el.getAttribute('data-date')]=el});

  inWeek.forEach(function(ev){
    var col=colMap[ev.date]; if(!col) return;
    var idx=slots.indexOf(ev.time||''); if(idx<0) return;

    var rows=Math.max(1,Math.ceil((ev.duration||50)/5));
    var el=document.createElement('div');
    var t = (ev.type==='exam'?'exam':(ev.type==='trial'?'trial':(ev.type==='private'?'private':'lesson')));
    el.className='event '+t + (ev.date < todayISO ? ' past' : '');
    var rlist = col.querySelectorAll('.day-row');
    var topPx = idx * rowH;
    var heightPx = rows * rowH;
    if(rlist && rlist[idx]){
      topPx = rlist[idx].offsetTop;
      var endIndex = idx + rows;
      if(rlist[endIndex]) heightPx = (rlist[endIndex].offsetTop - topPx);
      else heightPx = rows * rlist[idx].getBoundingClientRect().height;
    }
    el.style.top = topPx + 'px';
    el.style.height = (heightPx) + 'px';

    var lobj=learners.find(function(x){return x.id===ev.learnerId});
    var name=lobj?lobj.name:'Onbekend';
    var label = (t==='exam'?'EXAMEN ': (t==='trial'?'PROEF ': (t==='private'?'PRIVÉ ':'')));
    if(t==='private'){ name='Privé'; }
    var endt = computeEndTimeStr(ev.time, ev.duration||50);
    var timeRange = escapeHtml(ev.time + ' – ' + endt);
    var pickupText = ev.pickup ? escapeHtml(ev.pickup) : '';
    el.innerHTML = '<div class="ev-time">'+timeRange+'</div>'
                 + '<div class="ev-name">'+(label?('<span class="ev-type">'+escapeHtml(label.trim())+'</span>'):'')+escapeHtml(name)+'</div>'
                 + (pickupText?('<div class="ev-pickup">'+pickupText+'</div>'):'')
                 + (ev.note?('<div class="ev-note">'+escapeHtml(ev.note)+'</div>'):'')
                 + '<div class="ev-end">'+escapeHtml(endt)+'</div>';
    el.addEventListener('click', function(){ openLessonModal(ev.id); });
    col.appendChild(el);
  });

  var totalMin = inWeek.reduce(function(a,b){return a+(b.duration||50)},0);
  var hours = Math.round((totalMin/60)*10)/10;
  $('#weekLabel').textContent='Week '+pad2(isoWeekNumber(days[0]))+' • '+fmtHead(days[0])+' – '+fmtHead(days[6])+' • '+inWeek.length+' afspraken • '+hours.toLocaleString('nl-NL')+' uur';

  renderTodayTomorrow();
}

/* ===== Les modal ===== */
var modalLesson=$('#modalLesson');
var nlLearner=$('#nlLearner'), nlLearnerSearch=$('#nlLearnerSearch'), nlDate=$('#nlDate'), nlHour=$('#nlHour'), nlMinute=$('#nlMinute'), nlDuration=$('#nlDuration'), nlType=$('#nlType'), nlNote=$('#nlNote'), nlPickup=$('#nlPickup');
var nlToSheet=$('#nlToSheet');
var nlDelete=$('#nlDelete'), nlTitle=$('#nlTitle');
var editLessonId=null;

function filterLessonLearners(query){
  query = (query||'').trim().toLowerCase();
  var cur = nlLearner && nlLearner.value ? nlLearner.value : '';
  var arr = learners.slice().sort(function(a,b){return (a.name||'').localeCompare((b.name||''),'nl');});

  if(query){
    var pref = arr.filter(function(l){return (l.name||'').toLowerCase().indexOf(query)===0;});
    if(pref.length) arr = pref;
    else arr = arr.filter(function(l){return (l.name||'').toLowerCase().indexOf(query)!==-1;});
  }

  nlLearner.innerHTML = arr.map(function(l){return '<option value="'+l.id+'">'+escapeHtml(l.name)+'</option>';}).join('');

  if(arr.some(function(l){return l.id===cur;})) nlLearner.value = cur;
  else if(arr[0]) nlLearner.value = arr[0].id;
}
function buildHourOptions(selectedHH){
  var html='';
  for(var h=8;h<=21;h++){
    var hh=pad2(h);
    html+='<option value="'+hh+'"'+(String(hh)===String(selectedHH)?' selected':'')+'>'+hh+'</option>';
  }
  return html;
}
function buildMinuteOptions(selectedMM){
  var mins=[0,5,10,15,20,25,30,35,40,45,50,55];
  var html='';
  mins.forEach(function(m){
    var mm=pad2(m);
    html+='<option value="'+mm+'"'+(String(mm)===String(selectedMM)?' selected':'')+'>'+mm+'</option>';
  });
  return html;
}
function nlTimeValue(){
  return (nlHour?nlHour.value:'')+':'+(nlMinute?nlMinute.value:'00');
}
function setNlTimeFromStr(hhmm){
  var t = (hhmm||'').split(':');
  var hh = pad2(parseInt(t[0]||'8',10));
  var mm = pad2(parseInt(t[1]||'0',10));
  if(nlHour) nlHour.value = hh;
  if(nlMinute){
    var m = parseInt(mm,10)||0;
    m = Math.round(m/5)*5;
    if(m===60){ m=0; var h2=parseInt(hh,10)+1; if(h2>21) h2=21; if(nlHour) nlHour.value=pad2(h2); }
    nlMinute.value = pad2(m);
  }
}
function updateEndTime(){
  var el = $('#nlEnd');
  if(!el) return;
  var end = computeEndTimeStr(nlTimeValue(), nlDuration.value);
  el.textContent = 'Eindtijd: ' + end;
}

function rebuildLearnerOptions(){
  filterLessonLearners(nlLearnerSearch ? nlLearnerSearch.value : '');

  var sortedLearners = learners.slice().sort(function(a,b){ return (a.name||'').localeCompare((b.name||''), 'nl'); });
  var keep=$('#sheetLearner').value;
  $('#sheetLearner').innerHTML=sortedLearners.map(function(l){return '<option value="'+l.id+'">'+escapeHtml(l.name)+'</option>'}).join('');
  if(sortedLearners.some(function(l){return l.id===selectedLearnerId})) $('#sheetLearner').value=selectedLearnerId;
  else if(sortedLearners.some(function(l){return l.id===keep})) $('#sheetLearner').value=keep;

  $('#invLearner').innerHTML = '<option value="">-- kies leerling --</option>' + sortedLearners.map(function(l){return '<option value="'+l.id+'">'+escapeHtml(l.name)+'</option>'}).join('');
  $('#invLearner').value = '';

  $('#historicalToggle').checked = !!historicalMode;
}

function openLessonModal(id){
  rebuildLearnerOptions();
  if(nlHour) nlHour.innerHTML = buildHourOptions('08');
  if(nlMinute) nlMinute.innerHTML = buildMinuteOptions('00');
  if(nlLearnerSearch) nlLearnerSearch.value='';

  if(id){
    var ev=lessons.find(function(x){return x.id===id}); if(!ev) return;
    editLessonId=id;
    nlTitle.textContent='Bewerken';
    nlDelete.style.display='inline-block';

    nlLearner.value = ev.learnerId || (learners[0]?learners[0].id:'');
    nlDate.value = ev.date || isoToday();
    setNlTimeFromStr(ev.time || suggestNextTime());
    nlDuration.innerHTML = buildDurationOptions(normalizeDuration(ev.duration||50));
    nlType.value = ev.type || 'lesson';
    nlNote.value = ev.note || '';
    if(nlPickup) nlPickup.value = ev.pickup || '';
  }else{
    editLessonId=null;
    nlTitle.textContent='Nieuwe';
    nlDelete.style.display='none';

    if(selectedLearnerId && learners.some(function(l){return l.id===selectedLearnerId})) nlLearner.value=selectedLearnerId;
    else nlLearner.value=(learners[0]?learners[0].id:'');

    nlDate.value=isoToday();
    setNlTimeFromStr(suggestNextTime());

    var student=learners.find(function(l){return l.id===nlLearner.value});
    var def=student?student.avgMinutes:50;
    nlDuration.innerHTML=buildDurationOptions(normalizeDuration(def));
    if(nlPickup) nlPickup.value = (student && student.address)?student.address:'';
    nlType.value='lesson';
    nlNote.value='';
  }
  modalLesson.style.display='flex';
  updateEndTime();
}
function closeLessonModal(){ modalLesson.style.display='none'; }

nlLearner.addEventListener('change', function(){
  if(editLessonId) return;
  var student=learners.find(function(l){return l.id===nlLearner.value});
  var def=student?student.avgMinutes:50;
  nlDuration.innerHTML=buildDurationOptions(normalizeDuration(def));
  if(nlPickup){
    var cur=(nlPickup.value||'').trim();
    if(!cur) nlPickup.value = (student && student.address)?student.address:'';
  }
  updateEndTime();
});
if(nlLearnerSearch){
  nlLearnerSearch.addEventListener('input', function(){
    filterLessonLearners(this.value);
    if(!editLessonId){
      try{ nlLearner.dispatchEvent(new Event('change')); }catch(e){}
    }
  });
}
if(nlHour) nlHour.addEventListener('change', updateEndTime);
if(nlMinute) nlMinute.addEventListener('change', updateEndTime);
nlDuration.addEventListener('change', updateEndTime);

function saveNewOrEditLesson(){
  var lid=nlLearner.value;
  var student=learners.find(function(l){return l.id===lid});
  if(!student){ alert('Geen leerling geselecteerd'); return; }

  var iso=nlDate.value;
  var time=nlTimeValue();
  var duration=parseInt(nlDuration.value,10);
  var type=nlType.value || 'lesson';
  var note=(nlNote.value||'').trim();
  var pickup=(nlPickup && nlPickup.value)?(nlPickup.value||'').trim():'';

  var ok = (duration===50 || duration===100) || (duration>=60 && duration<=480 && duration%30===0);
  if(!ok){
    alert('Duur moet 50 of 100 zijn, of 60–480 minuten in stappen van 30.');
    return;
  }

  var parts=(time||'').split(':'), sh=parseInt(parts[0]||'0',10), sm=parseInt(parts[1]||'0',10);
  var s=sh*60+sm, e=s+duration;

  var overlap=lessons.some(function(ev){
    if(editLessonId && ev.id===editLessonId) return false;
    if(ev.date!==iso) return false;
    var ps=(ev.time||'').split(':'), eh=parseInt(ps[0]||'0',10), em=parseInt(ps[1]||'0',10);
    var st=eh*60+em, en=st+(ev.duration||50);
    return s<en && e>st;
  });
  if(overlap){ if(!confirm('⚠️ Overlapt met een andere afspraak in je agenda. Toch opslaan?')) return; }

  if(editLessonId){
    var i=lessons.findIndex(function(x){return x.id===editLessonId});
    if(i>=0){
      lessons[i]={id:lessons[i].id,date:iso,time:time,duration:duration,learnerId:student.id,type:type,note:note,pickup:pickup};
    }
    toast('Bijgewerkt');
  }else{
    lessons.push({id:uid(),date:iso,time:time,duration:duration,learnerId:student.id,type:type,note:note,pickup:pickup});
    toast('Toegevoegd');
  }

  store.write(K.lessons,lessons);
  saveAppStateToCloud();
  renderWeek(); renderSheet(); renderLearners(); closeLessonModal();
}
function deleteLesson(){
  if(!editLessonId) return;
  if(!confirm('Verwijderen?')) return;
  lessons=lessons.filter(function(x){return x.id!==editLessonId});
  store.write(K.lessons,lessons);
  saveAppStateToCloud();
  renderWeek(); renderSheet(); renderLearners(); closeLessonModal(); toast('Verwijderd');
}