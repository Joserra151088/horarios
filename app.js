/*
  app.js — Dos secciones: Coordinadores y Médicos + Exportar db.js
  Depende de window.DB_API (db.js). BD en localStorage; export a archivo db.js con los datos actuales.
*/
(function(){
  const { loadDB, saveDB, STORAGE_KEY } = window.DB_API;

  const TZ = 'America/Mexico_City';
  const DAY_LABELS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  function getCDMXNow(){
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short'
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const hh = parseInt(map.hour, 10); const mm = parseInt(map.minute, 10); const ss = parseInt(map.second, 10);
    const weekdayMap = { Sun: 6, Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5 };
    const dayIndex = weekdayMap[map.weekday];
    return { timeString: `${map.hour}:${map.minute}:${map.second}`, minutesSinceMidnight: hh*60+mm, seconds: ss, dayIndex };
  }
  function hhmmToMinutes(hhmm){ const [h,m]=hhmm.split(':').map(Number); return h*60+m; }
  function nowInShift(nowMin, startHHMM, endHHMM){
    const s=hhmmToMinutes(startHHMM), e=hhmmToMinutes(endHHMM);
    if (s===e) return false;
    return (e>s) ? (nowMin>=s && nowMin<e) : (nowMin>=s || nowMin<e);
  }
  function isPersonActiveNow(person){
    const now=getCDMXNow();
    const today=person.horario[now.dayIndex];
    if (!today || !Array.isArray(today.shifts) || today.shifts.length===0) return false;
    return today.shifts.some(t=>nowInShift(now.minutesSinceMidnight, t.start, t.end));
  }

  let DB = loadDB();
  let selectedId = null;

  // DOM
  let elClock, elSearch, elAdd, elExport;
  let elCoordList, elDocsList;
  let elEditorName, elLiveBadge, elLiveStatus, elScheduleForm;
  let elSave, elDelete, elOpenSheet, elCloseSheet, elBottomSheet, elCompactToggle;

  function cacheDom(){
    elClock  = document.getElementById('clock-time');
    elSearch = document.getElementById('searchInput');
    elAdd    = document.getElementById('addBtn');
    elExport = document.getElementById('exportBtn');

    elCoordList = document.getElementById('coordinatorsList');
    elDocsList  = document.getElementById('doctorsList');

    elEditorName = document.getElementById('editorName');
    elLiveBadge  = document.getElementById('liveBadge');
    elLiveStatus = document.getElementById('liveStatus');
    elScheduleForm = document.getElementById('scheduleForm');
    elSave = document.getElementById('saveBtn');
    elDelete = document.getElementById('deleteBtn');

    elBottomSheet = document.getElementById('bottomSheet');
    elOpenSheet   = document.getElementById('openSheetBtn');
    elCloseSheet  = document.getElementById('closeSheetBtn');
    elCompactToggle = document.getElementById('compactToggle');
  }

  // Reloj + refresco de indicadores
  let lastSecond=-1;
  function renderClock(){
    const now=getCDMXNow();
    if (elClock) elClock.textContent = now.timeString;
    if (now.seconds!==lastSecond){
      lastSecond=now.seconds;
      renderPeopleLists();
      if (selectedId) updateEditorHeader();
    }
  }

  function personNode(person){
    const item=document.createElement('div');
    item.className='person-item'+(person.id===selectedId?' active':'');
    item.setAttribute('role','listitem');

    const ind=document.createElement('span');
    const active=isPersonActiveNow(person);
    ind.className='indicator '+(active?'on':'off');
    ind.title=active?'Activo ahora':'Inactivo ahora';

    const name=document.createElement('div'); name.textContent=person.nombre;
    const hint=document.createElement('span'); hint.className='helper'; hint.textContent='editar';

    item.appendChild(ind); item.appendChild(name); item.appendChild(hint);
    item.addEventListener('click',()=>{ selectPerson(person.id); openSheet(); });
    return item;
  }

  function renderPeopleLists(){
    const q=(elSearch.value||'').trim().toLowerCase();
    elCoordList.innerHTML = '';
    elDocsList.innerHTML  = '';

    DB.people
      .filter(p=>!q || p.nombre.toLowerCase().includes(q))
      .sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'))
      .forEach(p=>{
        const node = personNode(p);
        if ((p.role||'').toLowerCase()==='coordinador') elCoordList.appendChild(node);
        else elDocsList.appendChild(node);
      });

    // Modo compacto automático si hay muchas tarjetas o pantalla pequeña
    const cardsCount = DB.people.length;
    const shouldCompact = cardsCount >= 12 || window.innerWidth < 768;
    document.body.classList.toggle('compact', shouldCompact || _compactForced);
    if (elCompactToggle) elCompactToggle.textContent = document.body.classList.contains('compact') ? 'Expandir' : 'Compactar';
  }

  // Bottom sheet (editor)
  function openSheet(){ elBottomSheet.classList.add('open'); elBottomSheet.setAttribute('aria-hidden','false'); }
  function closeSheet(){ elBottomSheet.classList.remove('open'); elBottomSheet.setAttribute('aria-hidden','true'); }

  function selectPerson(id){ selectedId=id; renderPeopleLists(); buildEditor(); }
  function updateEditorHeader(){
    const person=DB.people.find(p=>p.id===selectedId); if(!person) return;
    const active=isPersonActiveNow(person);
    elEditorName.textContent=person.nombre + (person.role ? ` · ${capitalize(person.role)}` : '');
    elLiveStatus.textContent=active?'ACTIVO':'INACTIVO';
    elLiveBadge.style.borderColor=active?'var(--ok)':'var(--bad)';
  }
  function buildEditor(){
    const person=DB.people.find(p=>p.id===selectedId); if(!person) return;
    updateEditorHeader();
    elScheduleForm.innerHTML='';
    person.horario.forEach((day, dayIdx)=>{
      const card=document.createElement('div'); card.className='day-card';
      const header=document.createElement('div'); header.className='day-header';
      const title=document.createElement('div'); title.className='day-title'; title.textContent=DAY_LABELS[dayIdx];
      const actions=document.createElement('div'); actions.className='day-actions';
      const addBtn=document.createElement('button'); addBtn.className='btn btn-primary'; addBtn.type='button'; addBtn.textContent='Agregar tramo';
      addBtn.addEventListener('click',()=>{ day.shifts.push({start:'09:00', end:'17:00'}); saveTemp(); buildEditor(); });
      actions.appendChild(addBtn); header.appendChild(title); header.appendChild(actions);
      const container=document.createElement('div'); container.className='shifts';
      if (!Array.isArray(day.shifts)) day.shifts=[];
      day.shifts.forEach((s,idx)=>{
        const row=document.createElement('div'); row.className='shift-row';
        const lbl=document.createElement('div'); lbl.className='label'; lbl.textContent=`Tramo ${idx+1}`;
        const start=document.createElement('input'); start.type='time'; start.value=s.start; start.addEventListener('change',()=>{ s.start=start.value; saveTemp(); });
        const end=document.createElement('input'); end.type='time'; end.value=s.end; end.addEventListener('change',()=>{ s.end=end.value; saveTemp(); });
        const del=document.createElement('button'); del.className='icon-btn'; del.type='button'; del.title='Eliminar tramo'; del.textContent='×'; del.addEventListener('click',()=>{ day.shifts.splice(idx,1); saveTemp(); buildEditor(); });
        row.appendChild(lbl); row.appendChild(start); row.appendChild(end); row.appendChild(del); container.appendChild(row);
      });
      const helper=document.createElement('div'); helper.className='helper'; helper.textContent='Si fin < inicio, el tramo cruza la medianoche.';
      card.appendChild(header); card.appendChild(container); card.appendChild(helper); elScheduleForm.appendChild(card);
    });
  }

  // Persistencia
  function saveTemp(){} // cambios ya mutan el objeto en memoria
  function saveCurrent(){ saveDB(DB); renderPeopleLists(); updateEditorHeader(); }

  // CRUD con rol
  function addPerson(){
    const nombre=prompt('Nombre de la nueva persona:');
    if(!nombre||!nombre.trim()) return;
    let role = prompt('Rol (coordinador/medico):','medico') || '';
    role = role.trim().toLowerCase();
    if (!['coordinador','medico'].includes(role)) {
      alert('Rol inválido. Usa: coordinador o medico.');
      return;
    }
    const empty=Array.from({length:7},()=>({shifts:[]}));
    const id = (window.crypto&&crypto.randomUUID)?crypto.randomUUID():('id-'+Math.random().toString(36).slice(2));
    const person={ id, nombre:nombre.trim(), role, horario:empty };
    DB.people.push(person); saveDB(DB); renderPeopleLists(); selectPerson(person.id); openSheet();
  }
  function deleteCurrent(){
    if(!selectedId) return; const person=DB.people.find(p=>p.id===selectedId); if(!person) return;
    if(!confirm(`¿Eliminar a \"${person.nombre}\"? Esta acción no se puede deshacer.`)) return;
    DB.people = DB.people.filter(p=>p.id!==selectedId); saveDB(DB);
    selectedId=null; closeSheet(); renderPeopleLists();
  }

  // ===== Modo compacto toggle =====
  let _compactForced = false;
  function toggleCompact(){
    _compactForced = !_compactForced;
    renderPeopleLists();
  }

  // ===== Exportar a db.js con datos actuales (embed en código) =====
  function exportDBasJS(){
    // Construimos un db.js válido como el actual, con defaultDB = DB actual
    const safeJson = JSON.stringify(DB, null, 2);
    const content =
`/*
  db.js (generado desde la app) — incluye los datos actuales en defaultDB
  Guarda este archivo como db.js y reemplaza el existente.
*/
(function(){
  const STORAGE_KEY = '${STORAGE_KEY}';
  function safeUUID(){ if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }

  // defaultDB generado:
  const defaultDB = ${safeJson};

  function loadDB(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultDB));
    try { return JSON.parse(raw); } catch { return JSON.parse(JSON.stringify(defaultDB)); }
  }
  function saveDB(db){ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
  window.DB_API = { STORAGE_KEY, defaultDB, loadDB, saveDB };
})();`;

    const blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'db.js';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  // Utils
  function capitalize(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }

  // Init
  function init(){
    cacheDom();
    renderClock(); setInterval(renderClock, 500);

    elSearch.addEventListener('input', renderPeopleLists);
    elAdd.addEventListener('click', addPerson);
    elExport.addEventListener('click', exportDBasJS);

    elSave.addEventListener('click', saveCurrent);
    elDelete.addEventListener('click', deleteCurrent);

    elOpenSheet.addEventListener('click', openSheet);
    elCloseSheet.addEventListener('click', closeSheet);
    elCompactToggle.addEventListener('click', toggleCompact);

    renderPeopleLists();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
