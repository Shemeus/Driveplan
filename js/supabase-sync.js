
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
      '<button class="btn btn-ghost" id="dpSyncLogout" type="button" style="margin-top:10px;display:none">Uitloggen</button>';
    view.appendChild(card);
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
})();
