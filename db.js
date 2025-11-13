/*
  db.js (sin módulos). Define BD inicial + persistencia en localStorage.
  Ahora cada persona tiene: { id, nombre, role: 'coordinador' | 'medico', horario:[{shifts:[]},...]}
  Expone window.DB_API
*/
(function(){
  const STORAGE_KEY = 'portalHorariosDB_v3_roles';

  function safeUUID(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  const defaultDB = {
    people: [
      {
        id: safeUUID(),
        nombre: 'Ana López',
        role: 'coordinador',
        horario: [
          { shifts: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }] }, // L
          { shifts: [{ start: '09:00', end: '17:00' }] }, // M
          { shifts: [{ start: '09:00', end: '17:00' }] }, // X
          { shifts: [{ start: '09:00', end: '17:00' }] }, // J
          { shifts: [{ start: '09:00', end: '15:00' }] }, // V
          { shifts: [] }, // S
          { shifts: [] }, // D
        ]
      },
      {
        id: safeUUID(),
        nombre: 'Carlos Pérez',
        role: 'medico',
        horario: [
          { shifts: [] },
          { shifts: [{ start: '14:00', end: '22:00' }] },
          { shifts: [{ start: '14:00', end: '22:00' }] },
          { shifts: [{ start: '14:00', end: '22:00' }] },
          { shifts: [{ start: '14:00', end: '22:00' }] },
          { shifts: [{ start: '14:00', end: '22:00' }] },
          { shifts: [] },
        ]
      },
      {
        id: safeUUID(),
        nombre: 'María González',
        role: 'medico',
        horario: [
          { shifts: [{ start: '22:00', end: '06:00' }] },
          { shifts: [{ start: '22:00', end: '06:00' }] },
          { shifts: [{ start: '22:00', end: '06:00' }] },
          { shifts: [] },
          { shifts: [] },
          { shifts: [] },
          { shifts: [] },
        ]
      }
    ]
  };

  function loadDB(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultDB));
    try { return JSON.parse(raw); } catch { return JSON.parse(JSON.stringify(defaultDB)); }
  }

  function saveDB(db){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  // Exponer API global + clave para export
  window.DB_API = { STORAGE_KEY, defaultDB, loadDB, saveDB };
})();
