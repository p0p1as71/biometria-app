// ── Gestión de sesiones en localStorage ───────────────────────────
// (Supabase se integrará en siguiente fase)

const Storage = {

  getSesiones() {
    return JSON.parse(localStorage.getItem('sesiones') || '[]');
  },

  getSesion(id) {
    return this.getSesiones().find(s => s.id === id) || null;
  },

  borrarSesion(id) {
    const sesiones = this.getSesiones().filter(s => s.id !== id);
    localStorage.setItem('sesiones', JSON.stringify(sesiones));
  },

  borrarTodo() {
    localStorage.removeItem('sesiones');
  }
};
