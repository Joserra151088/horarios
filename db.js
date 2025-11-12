/*
  db.js (sin módulos, compatible con file://)
  Define la “base de datos” inicial y funciones de carga/guardado.
  Expone window.DB_API para que app.js pueda usarla.
*/
(function(){
  const STORAGE_KEY = 'portalHorariosDB_v2_multi';

  // Fallback seguro para UUID si crypto.randomUUID no está disponible
  function safeUUID(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Base de datos inicial con horarios de ejemplo
  const defaultDB = {
    people: [
      {
        id: safeUUID(),
        nombre: 'Ana López',
        horario: [
          { shifts: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }] }, // Lunes
          { shifts: [{ start: '09:00', end: '17:00' }] }, // Martes
          { shifts: [{ start: '09:00', end: '17:00' }] }, // Miércoles
          { shifts: [{ start: '09:00', end: '17:00' }] }, // Jueves
          { shifts: [{ start: '09:00', end: '15:00' }] }, // Viernes
          { shifts: [] }, // Sábado
          { shifts: [] }, // Domingo
        ]
      },
      {
        id: safeUUID(),
        nombre: 'Carlos Pérez',
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

  // Cargar base de datos desde localStorage o usar la predeterminada
  function loadDB(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultDB));
    try { return JSON.parse(raw); } catch { return JSON.parse(JSON.stringify(defaultDB)); }
  }

  // Guardar base de datos en localStorage
  function saveDB(db){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  // Exponer API global
  window.DB_API = { STORAGE_KEY, defaultDB, loadDB, saveDB };
})();
