/*
  app.js — Dos relojes (CDMX y Cancún), Coordinadores/Médicos, bottom sheet,
  autosave en cambios y sonido de notificación, con visualización AM/PM en edición.

  Requiere en index.html:
  - #clock-time-cdmx y #clock-time-cancun
  - #coordinatorsList y #doctorsList
  - Botones: #addBtn, #saveBtn, #deleteBtn, #openSheetBtn, #closeSheetBtn, #compactToggle
  - Contenedores: #bottomSheet, #scheduleForm
  - Input búsqueda: #searchInput

  Depende de window.DB_API (definido en db.js)
*/

(function(){
  const { loadDB, saveDB } = window.DB_API;

  // ==================== Tiempo / Zonas ====================
  const TZ_CDMX   = 'America/Mexico_City';
  const TZ_CANCUN = 'America/Cancun';
  const DAY_LABELS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  function getTimeByZone(zone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short'
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const hh = parseInt(map.hour, 10);
    const mm = parseInt(map.minute, 10);
    const ss = parseInt(map.second, 10);
    const weekdayMap = { Sun: 6, Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5 };
    const dayIndex = weekdayMap[map.weekday];
    return { timeString: `${map.hour}:${map.minute}:${map.second}`, minutesSinceMidnight: hh*60+mm, seconds:ss, dayIndex };
  }

  // Para cálculos de actividad usamos CDMX
  function getNowCDMX(){ return getTimeByZone(TZ_CDMX); }

  function hhmmToMinutes(hhmm){ const [h,m]=hhmm.split(':').map(Number); return h*60+m; }
  function nowInShift(nowMin, startHHMM, endHHMM){
    const s=hhmmToMinutes(startHHMM), e=hhmmToMinutes(endHHMM);
    if (s===e) return false;               // tramo vacío
    return (e>s) ? (nowMin>=s && nowMin<e) // mismo día
                 : (nowMin>=s || nowMin<e);// cruza medianoche
  }
  function isPersonActiveNow(person){
    const now=getNowCDMX();
    const today=person.horario[now.dayIndex];
    if (!today || !Array.isArray(today.shifts) || today.shifts.length===0) return false;
    return today.shifts.some(t=>nowInShift(now.minutesSinceMidnight, t.start, t.end));
  }

  // ==================== Formato 12h (AM/PM) ====================
  function to12(hhmm){
    const [H,M] = hhmm.split(':').map(Number);
    const ampm = H >= 12 ? 'PM' : 'AM';
    let h12 = H % 12; if (h12 === 0) h12 = 12;
    return `${h12}:${String(M).padStart(2,'0')} ${ampm}`;
  }

  // ==================== Estado ====================
  let DB = loadDB();
  let selectedId = null;
  let _compactForced = false;

  // ==================== Audio de notificación ====================
  const sound = new Audio();
  sound.src = "https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg";
  sound.volume = 0.3;
  function playNotification(){
    try { sound.currentTime = 0; sound.play(); } catch(_) {}
  }

  // ==================== DOM ====================
  let elSearch, elAdd;
  let elCoordList, elDocsList;
  let elEditorName, elLiveBadge, elLiveStatus, elScheduleForm;
  let elSave, elDelete, elOpenSheet, elCloseSheet, elBottomSheet, elCompactToggle;

  function cacheDom(){
    elSearch = document.getElementById('searchInput');
    elAdd    = document.getElementById('addBtn');

    elCoordList = document.getElementById('coordinatorsList');
    elDocsList  = document.getElementById('doctorsList');

    elEditorName   = document.getElementById('editorName');
    elLiveBadge    = document.getElementById('liveBadge');
    elLiveStatus   = document.getElementById('liveStatus');
    elScheduleForm = document.getElementById('scheduleForm');
    elSave   = document.getElementById('saveBtn');
    elDelete = document.getElementById('deleteBtn');

    elBottomSheet  = document.getElementById('bottomSheet');
    elOpenSheet    = document.getElementById('openSheetBtn');
    elCloseSheet   = document.getElementById('closeSheetBtn');
    elCompactToggle= document.getElementById('compactToggle');
  }

  // ==================== Relojes (CDMX + Cancún) e indicadores ====================
  let lastSecond=-1;
  function renderClock(){
    const cdmx   = getTimeByZone(TZ_CDMX);
    const cancun = getTimeByZone(TZ_CANCUN);

    const elCDMX   = document.getElementById('clock-time-cdmx');
    const elCANCUN = document.getElementById('clock-time-cancun');
    if (elCDMX)   elCDMX.textContent   = cdmx.timeString;
    if (elCANCUN) elCANCUN.textContent = cancun.timeString;

    // Usamos el segundo de CDMX para refrescar estado/indicadores una vez por segundo
    if (cdmx.seconds!==lastSecond){
      lastSecond=cdmx.seconds;
      renderPeopleLists();
      if (selectedId) updateEditorHeader();
    }
  }

  // ==================== Listas por rol ====================
  function personNode(person){
    const item=document.createElement('div');
    item.className='person-item'+(person.id===selectedId?' active':'');
    item.setAttribute('role','listitem');

    const ind=document.createElement('span');
    const active=isPersonActiveNow(person);
    ind.className='indicator '+(active?'on':'off');
    ind.title=active?'Activo ahora':'Inactivo ahora';

    const name=document.createElement('div');
    name.textContent=person.nombre;

    const hint=document.createElement('span');
    hint.className='helper';
    hint.textContent='editar';

    item.appendChild(ind);
    item.appendChild(name);
    item.appendChild(hint);
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

    // Modo compacto automático + manual
    const shouldCompact = DB.people.length >= 12 || window.innerWidth < 768;
    document.body.classList.toggle('compact', shouldCompact || _compactForced);
    if (elCompactToggle) elCompactToggle.textContent = document.body.classList.contains('compact') ? 'Expandir' : 'Compactar';
  }

  // ==================== Bottom sheet (editor) ====================
  function openSheet(){ elBottomSheet.classList.add('open'); elBottomSheet.setAttribute('aria-hidden','false'); }
  function closeSheet(){ elBottomSheet.classList.remove('open'); elBottomSheet.setAttribute('aria-hidden','true'); }

  function selectPerson(id){ selectedId=id; renderPeopleLists(); buildEditor(); }

  function updateEditorHeader(){
    const person=DB.people.find(p=>p.id===selectedId); if(!person) return;
    const active=isPersonActiveNow(person);
    elEditorName.textContent = person.nombre + (person.role ? ` · ${capitalize(person.role)}` : '');
    elLiveStatus.textContent = active ? 'ACTIVO' : 'INACTIVO';
    elLiveBadge.style.borderColor = active ? 'var(--ok)' : 'var(--bad)';
  }

  // Crea una columna (wrapper) con input time y etiqueta AM/PM debajo
  function timeWithAMPM(initialValue, onChangeCb){
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '4px';

    const input = document.createElement('input');
    input.type = 'time';
    input.value = initialValue;
    input.addEventListener('change', ()=>{
      label.textContent = to12(input.value);
      input.title = to12(input.value);
      onChangeCb(input.value);
      saveDB(DB);         // autosave
      playNotification(); // sonido
    });
    input.title = to12(initialValue);

    const label = document.createElement('small');
    label.textContent = to12(initialValue);
    label.style.color = 'var(--muted)';
    label.style.fontSize = '12px';
    label.style.lineHeight = '1';

    wrap.appendChild(input);
    wrap.appendChild(label);
    return { wrap, input, label };
  }

  function buildEditor(){
    const person=DB.people.find(p=>p.id===selectedId); if(!person) return;
    updateEditorHeader();
    elScheduleForm.innerHTML='';

    person.horario.forEach((day, dayIdx)=>{
      const card=document.createElement('div'); card.className='day-card';

      // Header
      const header=document.createElement('div'); header.className='day-header';
      const title=document.createElement('div'); title.className='day-title'; title.textContent=DAY_LABELS[dayIdx];

      const actions=document.createElement('div'); actions.className='day-actions';
      const addBtn=document.createElement('button'); addBtn.className='btn btn-primary'; addBtn.type='button'; addBtn.textContent='Agregar tramo';
      addBtn.addEventListener('click',()=>{
        day.shifts.push({start:'09:00', end:'18:00'}); // usa estándar por defecto
        saveDB(DB);               // autosave
        playNotification();       // sonido
        buildEditor();
      });
      actions.appendChild(addBtn);
      header.appendChild(title);
      header.appendChild(actions);

      // Contenedor de tramos
      const container=document.createElement('div'); container.className='shifts';
      if (!Array.isArray(day.shifts)) day.shifts=[];

      day.shifts.forEach((s,idx)=>{
        const row=document.createElement('div'); row.className='shift-row';

        const lbl=document.createElement('div'); lbl.className='label'; lbl.textContent=`Tramo ${idx+1}`;

        // Input + AM/PM (inicio)
        const startUI = timeWithAMPM(s.start, (val)=>{ s.start = val; });

        // Input + AM/PM (fin)
        const endUI = timeWithAMPM(s.end, (val)=>{ s.end = val; });

        // Eliminar tramo
        const del=document.createElement('button'); del.className='icon-btn'; del.type='button'; del.title='Eliminar tramo'; del.textContent='×';
        del.addEventListener('click',()=>{
          day.shifts.splice(idx,1);
          saveDB(DB);         // autosave
          playNotification(); // sonido
          buildEditor();
        });

        row.appendChild(lbl);
        row.appendChild(startUI.wrap);
        row.appendChild(endUI.wrap);
        row.appendChild(del);
        container.appendChild(row);
      });

      const helper=document.createElement('div'); helper.className='helper';
      helper.textContent='Si fin < inicio, el tramo cruza la medianoche.';

      card.appendChild(header);
      card.appendChild(container);
      card.appendChild(helper);
      elScheduleForm.appendChild(card);
    });
  }

  // ==================== Persistencia y CRUD ====================
  function saveCurrent(){ saveDB(DB); renderPeopleLists(); updateEditorHeader(); }

  // Semana estándar para nuevas personas: L-V 09:00–18:00
  function standardWeek(){
    const W = [];
    for (let i = 0; i < 7; i++) {
      if (i <= 4) W.push({ shifts: [{ start: '09:00', end: '18:00' }] });
      else W.push({ shifts: [] });
    }
    return W;
  }

  function addPerson(){
    const nombre=prompt('Nombre de la nueva persona:');
    if(!nombre||!nombre.trim()) return;

    let role = prompt('Rol (coordinador/medico):','medico') || '';
    role = role.trim().toLowerCase();
    if (!['coordinador','medico'].includes(role)) {
      alert('Rol inválido. Usa: coordinador o medico.');
      return;
    }

    const id=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():('id-'+Math.random().toString(36).slice(2));
    const person={ id, nombre:nombre.trim(), role, horario:standardWeek() };

    DB.people.push(person);
    saveDB(DB);
    renderPeopleLists();
    selectPerson(person.id);
    openSheet();
  }

  function deleteCurrent(){
    if(!selectedId) return;
    const person=DB.people.find(p=>p.id===selectedId);
    if(!person) return;
    if(!confirm(`¿Eliminar a "${person.nombre}"? Esta acción no se puede deshacer.`)) return;

    DB.people = DB.people.filter(p=>p.id!==selectedId);
    saveDB(DB);
    selectedId=null;
    closeSheet();
    renderPeopleLists();
  }

  function toggleCompact(){
    _compactForced = !_compactForced;
    renderPeopleLists();
  }

  // ==================== Util ====================
  function capitalize(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }

  // ==================== Init ====================
  function init(){
    cacheDom();
    renderClock(); setInterval(renderClock, 500);

    elSearch.addEventListener('input', renderPeopleLists);
    elAdd.addEventListener('click', addPerson);

    elSave.addEventListener('click', saveCurrent);
    elDelete.addEventListener('click', deleteCurrent);

    elOpenSheet.addEventListener('click', openSheet);
    elCloseSheet.addEventListener('click', closeSheet);
    elCompactToggle.addEventListener('click', toggleCompact);

    renderPeopleLists();
  }

  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
