// DrivePlan v18.6 factuurgegevens sync

/* ===== DrivePlan Supabase sync =====
   Alleen publishable clientgegevens. Beveiliging loopt via Supabase Auth + RLS.
*/
(function(){
  'use strict';

  var DP_SUPABASE_URL = 'https://xkmjwebqtslhepjclxtc.supabase.co';
  var DP_SUPABASE_KEY = 'sb_publishable_350WZ2zD9owjWkp4bvKAXg_6N63E-h3';
  var DP_SESSION_KEY = 'driveplan_supabase_session_v1';
  var dpSession = null;
  var dpSyncTimer = null;
  var dpPullTimer = null;
  var dpPortalSyncTimer = null;
  var dpPortalSyncBusy = false;
  var dpApplyingRemote = false;
  var dpLastRemoteUpdatedAt = '';
  var dpOriginalStoreWrite = null;

  function authHeaders(token){
    var h = {
      'apikey': DP_SUPABASE_KEY,
      'Content-Type': 'application/json'
    };
    if(token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  function saveSession(s){
    dpSession = s || null;
    try{
      if(dpSession) localStorage.setItem(DP_SESSION_KEY, JSON.stringify(dpSession));
      else localStorage.removeItem(DP_SESSION_KEY);
    }catch(e){}
    updateSyncUi();
  }

  function loadSession(){
    try{ return JSON.parse(localStorage.getItem(DP_SESSION_KEY) || 'null'); }
    catch(e){ return null; }
  }

  async function refreshSessionIfNeeded(){
    if(!dpSession) return false;
    var now = Math.floor(Date.now()/1000);
    if(dpSession.expires_at && dpSession.expires_at > now + 60) return true;
    if(!dpSession.refresh_token) return false;

    var r = await fetch(DP_SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method:'POST',
      headers:authHeaders(),
      body:JSON.stringify({refresh_token:dpSession.refresh_token})
    });
    if(!r.ok){
      saveSession(null);
      return false;
    }
    var data = await r.json();
    data.expires_at = now + Number(data.expires_in || 3600);
    saveSession(data);
    return true;
  }

  async function dpLogin(email,password){
    var r = await fetch(DP_SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method:'POST',
      headers:authHeaders(),
      body:JSON.stringify({email:email,password:password})
    });
    var data = await r.json().catch(function(){return {};});
    if(!r.ok) throw new Error(data.error_description || data.msg || data.error || 'Inloggen mislukt');
    data.expires_at = Math.floor(Date.now()/1000) + Number(data.expires_in || 3600);
    saveSession(data);
    return data;
  }

  function currentUserId(){
    return dpSession && dpSession.user && dpSession.user.id ? dpSession.user.id : '';
  }


  /* ===== DrivePortal sync =====
     DrivePlan blijft de bron. Alleen leerlingdata die in het portaal thuishoort
     wordt naar de afgeschermde portal_* tabellen gekopieerd.
  */
  function portalApi(path, options){
    options = options || {};
    var headers = Object.assign(authHeaders(dpSession && dpSession.access_token), options.headers || {});
    return fetch(DP_SUPABASE_URL + '/rest/v1/' + path, Object.assign({}, options, {headers:headers}));
  }

  function lastPortalScore(lid, pid){
    var byPart = progress && progress[lid] && progress[lid][pid] ? progress[lid][pid] : null;
    if(!byPart || typeof byPart !== 'object') return null;
    var dates = Object.keys(byPart).sort();
    for(var i=dates.length-1;i>=0;i--){
      var v = byPart[dates[i]];
      if(v!==null && v!==undefined && v!==''){
        var n = Number(v);
        return isNaN(n) ? null : n;
      }
    }
    return null;
  }

  function lessonStartIso(ev){
    if(!ev || !ev.date) return null;
    var tm = String(ev.time || '00:00');
    var d = new Date(ev.date + 'T' + tm + ':00');
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function lessonEndIso(ev){
    var start = lessonStartIso(ev);
    if(!start) return null;
    var d = new Date(start);
    d.setMinutes(d.getMinutes() + Number(ev.duration || 60));
    return d.toISOString();
  }

  function portalLessonTitle(ev){
    if(ev && ev.type === 'exam') return 'Praktijkexamen';
    return 'Rijles';
  }

  async function portalJson(path, options){
    var r = await portalApi(path, options);
    var txt = await r.text();
    var data = null;
    try{ data = txt ? JSON.parse(txt) : null; }catch(e){ data = txt; }
    if(!r.ok){
      throw new Error('DrivePortal API ' + r.status + ': ' + (typeof data==='string' ? data : JSON.stringify(data||{})));
    }
    return data;
  }

  async function syncOneLearnerToPortal(learner){
    if(!learner || !learner.id || !String(learner.email || '').trim()) return;

    var studentRows = await portalJson('portal_students?on_conflict=driveplan_learner_id', {
      method:'POST',
      headers:{'Prefer':'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify({
        driveplan_learner_id:String(learner.id),
        email:String(learner.email).trim(),
        full_name:String(learner.name || 'Leerling'),
        phone:String(learner.phone || '').trim() || null,
        address:String(learner.address || '').trim() || null,
        postal_code:String(learner.zip || '').trim() || null,
        // DrivePlan heeft nu nog geen apart woonplaatsveld.
        // Bij invoer zoals "Medemblik, Codingshof 11" bewaren we Medemblik alvast als city.
        city:(function(){
          var a=String(learner.address || '').trim();
          if(a.indexOf(',')===-1) return null;
          var first=a.split(',')[0].trim();
          return first || null;
        })(),
        active:true
      })
    });
    var student = studentRows && studentRows[0];
    if(!student || !student.id) return;
    var sid = student.id;

    var mods = (curriculum && Array.isArray(curriculum.modules)) ? curriculum.modules : [];
    var modRows = mods.map(function(m,mi){
      return {
        student_id:sid,
        module_key:String(m.id),
        module_name:String(m.label || ('Module '+(mi+1))),
        sort_order:mi,
        active:true
      };
    });
    if(modRows.length){
      await portalJson('portal_modules?on_conflict=student_id,module_key', {
        method:'POST',
        headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify(modRows)
      });
    }

    var existingModules = await portalJson('portal_modules?student_id=eq.'+encodeURIComponent(sid)+'&select=id,module_key');
    var activeModuleKeys = modRows.map(function(x){return x.module_key;});
    for(var em=0; em<(existingModules||[]).length; em++){
      var oldM = existingModules[em];
      if(activeModuleKeys.indexOf(String(oldM.module_key))===-1){
        await portalJson('portal_modules?id=eq.'+encodeURIComponent(oldM.id), {method:'DELETE'});
      }
    }

    existingModules = await portalJson('portal_modules?student_id=eq.'+encodeURIComponent(sid)+'&select=id,module_key');
    var moduleIdByKey = {};
    (existingModules||[]).forEach(function(m){ moduleIdByKey[String(m.module_key)] = m.id; });

    for(var mi=0; mi<mods.length; mi++){
      var mod = mods[mi];
      var moduleId = moduleIdByKey[String(mod.id)];
      if(!moduleId) continue;
      var parts = Array.isArray(mod.parts) ? mod.parts : [];
      var scoreRows = parts.map(function(part,pi){
        return {
          student_id:sid,
          module_id:moduleId,
          item_key:String(part.id),
          item_name:String(part.t || ('Onderdeel '+(pi+1))),
          score:lastPortalScore(learner.id, part.id),
          sort_order:pi,
          active:true,
          updated_at:new Date().toISOString()
        };
      });
      if(scoreRows.length){
        await portalJson('portal_scores?on_conflict=student_id,module_id,item_key', {
          method:'POST',
          headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify(scoreRows)
        });
      }
      var existingScores = await portalJson('portal_scores?student_id=eq.'+encodeURIComponent(sid)+'&module_id=eq.'+encodeURIComponent(moduleId)+'&select=id,item_key');
      var activeKeys = scoreRows.map(function(x){return x.item_key;});
      for(var es=0; es<(existingScores||[]).length; es++){
        var oldS = existingScores[es];
        if(activeKeys.indexOf(String(oldS.item_key))===-1){
          await portalJson('portal_scores?id=eq.'+encodeURIComponent(oldS.id), {method:'DELETE'});
        }
      }
    }

    // Afspraken: DrivePlan is leidend. Alleen vandaag en toekomst naar het portaal.
    await portalJson('portal_appointments?student_id=eq.'+encodeURIComponent(sid), {method:'DELETE'});
    var today = new Date(); today.setHours(0,0,0,0);
    var apptRows = (Array.isArray(lessons)?lessons:[]).filter(function(ev){
      if(String(ev.learnerId)!==String(learner.id)) return false;
      var st = lessonStartIso(ev); if(!st) return false;
      return new Date(st) >= today;
    }).map(function(ev){
      return {
        student_id:sid,
        driveplan_appointment_id:String(ev.id || ''),
        title:portalLessonTitle(ev),
        start_at:lessonStartIso(ev),
        end_at:lessonEndIso(ev),
        location:String(ev.pickup || ''),
        status:'planned'
      };
    });
    if(apptRows.length){
      await portalJson('portal_appointments', {
        method:'POST',
        headers:{'Prefer':'return=minimal'},
        body:JSON.stringify(apptRows)
      });
    }
  }

  function setPortalSyncStatus(text){
    var el = document.getElementById('dpPortalSyncStatus');
    if(el) el.textContent = text;
  }

  async function syncDrivePortalNow(manual){
    if(dpPortalSyncBusy){
      setPortalSyncStatus('Portaal sync is al bezig…');
      if(!manual) return false;

      // Bij een handmatige/zichtbare controle wachten we even op de lopende sync
      // en voeren we daarna nogmaals een volledige sync uit.
      for(var busyWait=0; busyWait<40 && dpPortalSyncBusy; busyWait++){
        await new Promise(function(resolve){ setTimeout(resolve, 150); });
      }
      if(dpPortalSyncBusy){
        alert('DrivePortal synchronisatie is nog bezig. Probeer het over een paar seconden opnieuw.');
        return false;
      }
    }
    if(!dpSession){
      setPortalSyncStatus('Niet ingelogd — portaal niet bijgewerkt');
      if(manual) alert('DrivePortal sync kan niet starten omdat DrivePlan niet is ingelogd.');
      return false;
    }

    // Een handmatige klik mag niet stil wegvallen terwijl een cloud-pull net wordt toegepast.
    if(dpApplyingRemote){
      if(!manual) return false;
      setPortalSyncStatus('Even wachten op DrivePlan synchronisatie…');
      for(var wait=0; wait<20 && dpApplyingRemote; wait++){
        await new Promise(function(resolve){ setTimeout(resolve, 150); });
      }
      if(dpApplyingRemote){
        setPortalSyncStatus('Probeer over een paar seconden opnieuw');
        alert('DrivePlan is nog bezig met synchroniseren. Probeer Portaal nu bijwerken over een paar seconden opnieuw.');
        return false;
      }
    }

    if(!await refreshSessionIfNeeded()){
      setPortalSyncStatus('Cloudsessie verlopen — log opnieuw in');
      if(manual) alert('Je DrivePlan cloudsessie is verlopen. Log opnieuw in en probeer daarna opnieuw.');
      return false;
    }

    dpPortalSyncBusy = true;
    setPortalSyncStatus('Leerlingportaal wordt bijgewerkt…');
    try{
      var list = Array.isArray(learners) ? learners : [];
      var withEmail = list.filter(function(l){ return l && l.id && String(l.email || '').trim(); });
      if(!withEmail.length){
        setPortalSyncStatus('Geen leerlingen met e-mailadres gevonden');
        if(manual) alert('Geen leerlingen met een e-mailadres gevonden. DrivePortal gebruikt het e-mailadres om een leerling te koppelen.');
        return false;
      }

      var okCount = 0;
      var failCount = 0;
      var firstError = '';
      for(var i=0;i<withEmail.length;i++){
        try{
          setPortalSyncStatus('Portaal bijwerken '+(i+1)+'/'+withEmail.length+': '+String(withEmail[i].name || 'Leerling'));
          await syncOneLearnerToPortal(withEmail[i]);
          okCount++;
        }catch(oneErr){
          failCount++;
          if(!firstError) firstError = (oneErr && oneErr.message) ? oneErr.message : String(oneErr);
          console.warn('DrivePortal leerling sync mislukt', withEmail[i] && withEmail[i].name, oneErr);
        }
      }

      if(failCount){
        setPortalSyncStatus('Portaal deels bijgewerkt: '+okCount+' gelukt, '+failCount+' mislukt');
        if(manual) alert('DrivePortal sync deels mislukt.\n\nGelukt: '+okCount+'\nMislukt: '+failCount+'\n\nEerste fout:\n'+firstError);
        return false;
      }

      setPortalSyncStatus('Leerlingportaal bijgewerkt · '+okCount+' leerling'+(okCount===1?'':'en'));
      if(manual) alert('DrivePortal is bijgewerkt.\n\nLeerlingen met e-mailadres: '+okCount+'\n\nEr zijn geen e-mails of uitnodigingen naar leerlingen verstuurd.');
      return true;
    }catch(e){
      console.warn('DrivePortal synchronisatie mislukt', e);
      var message = e && e.message ? e.message : String(e);
      setPortalSyncStatus('Portaal sync mislukt: '+message);
      if(manual) alert('DrivePortal sync mislukt.\n\n'+message);
      return false;
    }finally{
      dpPortalSyncBusy = false;
    }
  }

  function schedulePortalSync(){
    if(dpApplyingRemote || !dpSession) return;
    clearTimeout(dpPortalSyncTimer);
    dpPortalSyncTimer = setTimeout(function(){ syncDrivePortalNow(false); }, 1200);
  }

  function snapshotState(){
    return {
      version:'driveplan-sync-v1',
      learners:Array.isArray(window.learners) ? window.learners : learners,
      lessons:Array.isArray(window.lessons) ? window.lessons : lessons,
      progress:window.progress || progress || {},
      company:window.company || company || {},
      curriculum:window.curriculum || curriculum || {},
      selectedLearnerId:window.selectedLearnerId || selectedLearnerId || '',
      historicalMode:!!(window.historicalMode !== undefined ? window.historicalMode : historicalMode),
      rentalWeekStart:(typeof isoFromDateLocal==='function' && rentalWeekStart) ? isoFromDateLocal(rentalWeekStart) : null
    };
  }

  function applyState(data){
    if(!data || typeof data !== 'object') return;
    dpApplyingRemote = true;
    try{
      learners = Array.isArray(data.learners) ? data.learners : learners;
      lessons = Array.isArray(data.lessons) ? data.lessons : lessons;
      progress = data.progress || progress || {};
      company = (typeof normalizeCompanyState==='function') ? normalizeCompanyState(Object.assign({}, company||{}, data.company||{})) : Object.assign({}, company||{}, data.company||{});
      if(data.curriculum && Array.isArray(data.curriculum.modules)) curriculum = data.curriculum;
      selectedLearnerId = data.selectedLearnerId || (learners[0] ? learners[0].id : '');
      historicalMode = !!data.historicalMode;
      if(data.rentalWeekStart && typeof mondayOfWeek==='function'){
        rentalWeekStart = mondayOfWeek(new Date(data.rentalWeekStart));
      }

      dpOriginalStoreWrite(K.learners, learners);
      dpOriginalStoreWrite(K.lessons, lessons);
      dpOriginalStoreWrite(K.progress, progress);
      dpOriginalStoreWrite(K.company, company);
      dpOriginalStoreWrite(K.curriculum, curriculum);
      dpOriginalStoreWrite(K.sel, selectedLearnerId);
      dpOriginalStoreWrite(K.hist, historicalMode);
      if(rentalWeekStart) dpOriginalStoreWrite(K.rentalWeek, isoFromDateLocal(rentalWeekStart));

      if(typeof applyBranding==='function') applyBranding();
      if(typeof rebuildLearnerOptions==='function') rebuildLearnerOptions();
      if(typeof renderLearners==='function') renderLearners();
      if(typeof renderWeek==='function') renderWeek();
      if(typeof renderSheet==='function') renderSheet();
      if(typeof renderModuleManager==='function') renderModuleManager();
      if(typeof renderTodayTomorrow==='function') renderTodayTomorrow();
    } finally {
      dpApplyingRemote = false;
      schedulePortalSync();
    }
  }

  async function fetchRemoteState(){
    if(!dpSession || !await refreshSessionIfNeeded()) return null;
    var uid = currentUserId();
    if(!uid) return null;

    var r = await fetch(
      DP_SUPABASE_URL + '/rest/v1/driveplan_state?user_id=eq.' + encodeURIComponent(uid) + '&select=data,updated_at',
      {headers:authHeaders(dpSession.access_token)}
    );
    if(!r.ok) throw new Error('Cloud ophalen mislukt ('+r.status+')');
    var rows = await r.json();
    return rows && rows[0] ? rows[0] : null;
  }

  async function saveAppStateToCloud(){
    if(dpApplyingRemote || !dpSession) return false;
    if(!await refreshSessionIfNeeded()) return false;
    var uid = currentUserId();
    if(!uid) return false;

    var r = await fetch(DP_SUPABASE_URL + '/rest/v1/driveplan_state?on_conflict=user_id', {
      method:'POST',
      headers:Object.assign(authHeaders(dpSession.access_token), {
        'Prefer':'resolution=merge-duplicates,return=representation'
      }),
      body:JSON.stringify({user_id:uid,data:snapshotState()})
    });
    if(!r.ok){
      var err = await r.text();
      console.warn('DrivePlan sync opslaan mislukt', r.status, err);
      setSyncStatus('Synchronisatie mislukt');
      return false;
    }
    var rows = await r.json().catch(function(){return [];});
    if(rows && rows[0] && rows[0].updated_at) dpLastRemoteUpdatedAt = rows[0].updated_at;
    setSyncStatus('Gesynchroniseerd');
    return true;
  }

  async function loadAppStateFromCloud(){
    if(!dpSession) return false;
    var row = await fetchRemoteState();
    if(!row){
      // Eerste apparaat: huidige lokale DrivePlan-data wordt de eerste cloudversie.
      await saveAppStateToCloud();
      return true;
    }
    dpLastRemoteUpdatedAt = row.updated_at || '';
    applyState(row.data || {});
    setSyncStatus('Gesynchroniseerd');
    return true;
  }

  async function pullIfChanged(){
    if(dpApplyingRemote || !dpSession || document.hidden) return;
    try{
      var row = await fetchRemoteState();
      if(!row) return;
      if(row.updated_at && row.updated_at !== dpLastRemoteUpdatedAt){
        dpLastRemoteUpdatedAt = row.updated_at;
        applyState(row.data || {});
        setSyncStatus('Bijgewerkt');
      }
    }catch(e){
      console.warn(e);
      setSyncStatus('Offline / later opnieuw');
    }
  }

  function scheduleCloudSave(){
    if(dpApplyingRemote || !dpSession) return;
    clearTimeout(dpSyncTimer);
    dpSyncTimer = setTimeout(function(){
      saveAppStateToCloud().catch(function(e){
        console.warn(e);
        setSyncStatus('Offline / later opnieuw');
      });
    }, 700);
  }

  function installStoreSync(){
    if(dpOriginalStoreWrite) return;
    dpOriginalStoreWrite = store.write.bind(store);
    store.write = function(k,v){
      dpOriginalStoreWrite(k,v);
      var keys = [
        K.learners,K.lessons,K.progress,K.company,K.curriculum,K.sel,K.hist,K.rentalWeek
      ];
      if(keys.indexOf(k)!==-1) scheduleCloudSave();
      var portalKeys = [K.learners,K.lessons,K.progress,K.curriculum];
      if(portalKeys.indexOf(k)!==-1) schedulePortalSync();
    };
  }

  function setSyncStatus(text){
    var el = document.getElementById('dpSyncStatus');
    if(el) el.textContent = text;
  }

  function updateSyncUi(){
    var status = document.getElementById('dpSyncStatus');
    var email = document.getElementById('dpSyncEmail');
    var logout = document.getElementById('dpSyncLogout');
    if(status) status.textContent = dpSession ? 'Gesynchroniseerd account' : 'Niet ingelogd';
    if(email) email.textContent = dpSession && dpSession.user ? (dpSession.user.email || '') : '';
    if(logout) logout.style.display = dpSession ? 'inline-flex' : 'none';
  }

  function ensureSyncSettingsUi(){
    var view = document.getElementById('view-settings');
    if(!view || document.getElementById('dpSyncCard')) return;
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'dpSyncCard';
    card.style.marginTop = '14px';
    card.innerHTML =
      '<h3 style="margin-top:0">Synchronisatie</h3>'+
      '<div class="small">DrivePlan synchroniseert automatisch tussen je apparaten.</div>'+
      '<div style="margin-top:10px"><b id="dpSyncStatus">Niet ingelogd</b></div>'+
      '<div class="small" id="dpSyncEmail" style="margin-top:4px"></div>'+
      '<div class="small" id="dpPortalSyncStatus" style="margin-top:8px">Leerlingportaal synchroniseert automatisch</div>'+
      '<button class="btn btn-ghost" id="dpPortalSyncNow" type="button" style="margin-top:10px">Portaal nu bijwerken</button>'+
      '<button class="btn btn-ghost" id="dpSyncLogout" type="button" style="margin-top:10px;display:none">Uitloggen</button>';
    view.appendChild(card);
    var ps = document.getElementById('dpPortalSyncNow');
    if(ps) ps.addEventListener('click', function(){
      ps.disabled = true;
      syncDrivePortalNow(true).finally(function(){ ps.disabled = false; });
    });
    var b = document.getElementById('dpSyncLogout');
    if(b) b.addEventListener('click', function(){
      saveSession(null);
      location.reload();
    });
    updateSyncUi();
  }

  function ensureLoginOverlay(){
    if(document.getElementById('dpCloudLogin')) return;
    var overlay = document.createElement('div');
    overlay.id = 'dpCloudLogin';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#f3f6fa;display:none;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML =
      '<div style="width:min(430px,100%);background:white;border:1px solid #dbe3ec;border-radius:18px;padding:22px;box-shadow:0 12px 38px rgba(0,0,0,.12)">'+
      '<h2 style="margin:0 0 6px">DrivePlan</h2>'+
      '<div style="color:#64748b;margin-bottom:18px">Log in om je gegevens op laptop, mobiel en tablet te synchroniseren.</div>'+
      '<label style="display:block;font-weight:700;margin-bottom:5px">E-mail</label>'+
      '<input id="dpCloudEmail" type="email" autocomplete="username" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:12px">'+
      '<label style="display:block;font-weight:700;margin-bottom:5px">Wachtwoord</label>'+
      '<input id="dpCloudPassword" type="password" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:14px">'+
      '<button id="dpCloudLoginBtn" class="btn btn-primary" type="button" style="width:100%">Inloggen</button>'+
      '<div id="dpCloudLoginMsg" style="min-height:20px;margin-top:10px;color:#b42318;font-size:13px"></div>'+
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('dpCloudLoginBtn').addEventListener('click', async function(){
      var email = (document.getElementById('dpCloudEmail').value || '').trim();
      var pass = document.getElementById('dpCloudPassword').value || '';
      var msg = document.getElementById('dpCloudLoginMsg');
      if(!email || !pass){ msg.textContent='Vul e-mail en wachtwoord in.'; return; }
      msg.textContent='Bezig met inloggen…';
      try{
        await dpLogin(email,pass);
        await loadAppStateFromCloud();
        overlay.style.display='none';
        updateSyncUi();
      }catch(e){
        msg.textContent=e.message || 'Inloggen mislukt';
      }
    });
  }

  async function initCloudSync(){
    installStoreSync();
    ensureLoginOverlay();
    ensureSyncSettingsUi();
    dpSession = loadSession();

    if(dpSession){
      try{
        if(await refreshSessionIfNeeded()){
          await loadAppStateFromCloud();
          document.getElementById('dpCloudLogin').style.display='none';
        }else{
          document.getElementById('dpCloudLogin').style.display='flex';
        }
      }catch(e){
        console.warn(e);
        document.getElementById('dpCloudLogin').style.display='flex';
      }
    }else{
      document.getElementById('dpCloudLogin').style.display='flex';
    }

    clearInterval(dpPullTimer);
    dpPullTimer = setInterval(pullIfChanged, 8000);
    window.addEventListener('focus', pullIfChanged);
    document.addEventListener('visibilitychange', function(){
      if(!document.hidden) pullIfChanged();
    });
  }

  // Bestaande app-calls koppelen aan de nieuwe implementatie.
  window.saveAppStateToCloud = saveAppStateToCloud;
  window.loadAppStateFromCloud = loadAppStateFromCloud;
  window.initCloudSync = initCloudSync;
  window.markCloudLocalMutation = function(){ scheduleCloudSave(); };

  document.addEventListener('DOMContentLoaded', function(){
    // Laat de bestaande DrivePlan-initialisatie eerst klaarzetten.
    setTimeout(function(){
      initCloudSync().catch(function(e){ console.error('DrivePlan sync init',e); });
    }, 0);
  });


  async function loadDrivePortalAvailabilityMap(){
    if(!dpSession || !dpSession.access_token) return {};

    var students = await portalJson(
      'portal_students?select=id,driveplan_learner_id&active=eq.true',
      {method:'GET'}
    );
    students = Array.isArray(students) ? students : [];
    if(!students.length) return {};

    var availability = await portalJson(
      'portal_availability?select=id,student_id,weekday,start_time,end_time&order=weekday.asc,start_time.asc',
      {method:'GET'}
    );
    availability = Array.isArray(availability) ? availability : [];

    var exceptions = await portalJson(
      'portal_availability_exceptions?select=id,student_id,start_date,end_date,note&order=start_date.asc',
      {method:'GET'}
    );
    exceptions = Array.isArray(exceptions) ? exceptions : [];

    var now = new Date();
    var today = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    var result = {};

    students.forEach(function(st){
      var key = String(st.driveplan_learner_id || '');
      if(!key) return;
      result[key] = {
        slots: availability.filter(function(a){ return a.student_id === st.id; }),
        exceptions: exceptions.filter(function(e){
          return e.student_id === st.id && (!e.end_date || e.end_date >= today);
        })
      };
    });

    return result;
  }

  window.loadDrivePortalAvailabilityMap = loadDrivePortalAvailabilityMap;

  window.syncDrivePortalNow = syncDrivePortalNow;
})();
