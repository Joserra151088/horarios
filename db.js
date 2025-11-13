/*
  db.js (sin módulos). Base de datos en código + persistencia en localStorage.
  Esquema de cada persona:
    { id, nombre, role: 'coordinador' | 'medico', horario: [ {shifts: []}, ... x7 ] }

  Cambios:
  - Se asigna horario estándar 09:00–18:00 (L-V) a TODO el personal.
  - STORAGE_KEY versión nueva para forzar carga del defaultDB actualizado.
*/

(function () {
  const STORAGE_KEY = 'portalHorariosDB_v5_roles_std';

  // Fallback seguro para UUID si el navegador no soporta crypto.randomUUID
  function safeUUID() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Semana estándar: L-V 09:00–18:00, S-D sin tramos
  function standardWeek() {
    const W = [];
    for (let i = 0; i < 7; i++) {
      if (i <= 4) { // 0..4 = L-V
        W.push({ shifts: [{ start: '09:00', end: '18:00' }] });
      } else {
        W.push({ shifts: [] }); // S-D
      }
    }
    return W;
  }

  // ==================== BD por defecto ====================
  const defaultDB = {
    people: [
      // ---------- Coordinadores ----------
      { id: safeUUID(), nombre: 'Frida Romo',        role: 'coordinador', horario: standardWeek() },
      { id: safeUUID(), nombre: 'Erika García',      role: 'coordinador', horario: standardWeek() },
      { id: safeUUID(), nombre: 'Leidy Díaz',        role: 'coordinador', horario: standardWeek() },
      { id: safeUUID(), nombre: 'Yaneli Moran',      role: 'coordinador', horario: standardWeek() },
      { id: safeUUID(), nombre: 'Mónica Domínguez',  role: 'coordinador', horario: standardWeek() },

      // ---------- Médicos ----------
      { id: safeUUID(), nombre: 'Brenda Hernández',  role: 'medico',      horario: standardWeek() },
      { id: safeUUID(), nombre: 'Fernando Pico',     role: 'medico',      horario: standardWeek() },
      { id: safeUUID(), nombre: 'Michell Fourlong',  role: 'medico',      horario: standardWeek() },
      { id: safeUUID(), nombre: 'Alfonso Domínguez', role: 'medico',      horario: standardWeek() },
    ]
  };

  // ==================== Persistencia ====================
  function loadDB() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultDB));
    try {
      return JSON.parse(raw);
    } catch {
      return JSON.parse(JSON.stringify(defaultDB));
    }
  }

  function saveDB(db) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  // API global para que app.js lo use
  window.DB_API = { STORAGE_KEY, defaultDB, loadDB, saveDB };
})();
