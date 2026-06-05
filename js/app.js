// ── Estado global ──────────────────────────────────────────────────
const state = {
  foto: null,        // File object
  fotoBase64: null,  // string base64
  resultado: null,   // HojaMuestreo (respuesta API parseada)
  sesiones: []       // histórico local
};

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Fecha en header
  const hoy = new Date();
  document.getElementById('dashboard-date').textContent =
    'DASHBOARD PRINCIPAL · ' + hoy.toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).toUpperCase();

  // Cargar sesiones guardadas
  cargarSesiones();
});

// ── Menú foto ──────────────────────────────────────────────────────
function toggleFotoMenu() {
  const menu = document.getElementById('foto-submenu');
  menu.classList.toggle('open');
}

function triggerCamera() {
  document.getElementById('foto-submenu').classList.remove('open');
  document.getElementById('input-camera').click();
}

function triggerUpload() {
  document.getElementById('foto-submenu').classList.remove('open');
  document.getElementById('input-upload').click();
}

// ── Foto seleccionada ──────────────────────────────────────────────
function onFotoSelected(input) {
  const file = input.files[0];
  if (!file) return;

  state.foto = file;
  state.resultado = null;

  // Leer base64
  const reader = new FileReader();
  reader.onload = (e) => {
    state.fotoBase64 = e.target.result.split(',')[1]; // solo datos, sin prefijo

    // Mostrar thumbnail
    const thumb = document.getElementById('thumbnail-wrap');
    thumb.innerHTML = `<img src="${e.target.result}" alt="foto">`;

    // Actualizar UI
    document.getElementById('procesar-sub').textContent = `📎 ${file.name}`;
    document.getElementById('btn-procesar').disabled = false;
    document.getElementById('session-status').textContent = `Foto cargada: ${file.name}`;

    // Resetear botones dependientes
    document.getElementById('btn-preview').disabled = true;
    document.getElementById('btn-enviar').disabled = true;
    document.getElementById('btn-alertas').disabled = true;
    document.getElementById('preview-sub').textContent = 'Procesa la foto primero';
    document.getElementById('enviar-sub').textContent = 'Procesa la foto primero';
    document.getElementById('num-alertas').textContent = '0';
    document.getElementById('alertas-sub').textContent = 'Sin alertas activas';
  };
  reader.readAsDataURL(file);
}

// ── Procesar foto ──────────────────────────────────────────────────
async function procesarFoto() {
  if (!state.fotoBase64) return;

  mostrarLoader('Analizando hoja de muestreo...');

  try {
    
async function comprimirImagen(base64, maxWidth=1024, quality=0.82) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      let w=img.width, h=img.height;
      if(w>maxWidth){h=Math.round(h*maxWidth/w);w=maxWidth;}
      c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      resolve(c.toDataURL('image/jpeg',quality).split(',')[1]);
    };
    img.src='data:image/jpeg;base64,'+base64;
  });
}

    mostrarLoader('Comprimiendo imagen...');
    const imgComp = await comprimirImagen(state.fotoBase64);
    mostrarLoader('Analizando hoja de muestreo...');
    const resultado = await llamarAPI(imgComp);
    state.resultado = resultado;

    // Calcular totales
    let totalAlertas = 0;
    let totalMuestras = 0;
    const resumenEstanques = [];

    resultado.estanques.forEach(e => {
      const anomalias = e.medidas.filter(m => m.estado === 'ANOMALIA').length;
      const dudosos   = e.medidas.filter(m => m.estado === 'DUDOSO').length;
      const alertas   = anomalias + dudosos;
      totalAlertas   += alertas;
      totalMuestras  += e.medidas.length;
      resumenEstanques.push(`${e.id}: ${anomalias} anomalía(s), ${dudosos} dudoso(s)`);
    });

    // Guardar sesión
    const sesion = {
      id: Date.now(),
      fecha: resultado.fecha || new Date().toLocaleDateString('es-ES'),
      estanques: resultado.estanques.map(e => e.id).join(' · '),
      totalMuestras,
      totalAlertas,
      fotoBase64: state.fotoBase64,
      resultado: resultado
    };
    try { guardarSesion(sesion); } catch(e) { console.warn(e); }

    // Actualizar UI
    document.getElementById('session-status').textContent =
      `✅ Procesado: ${resultado.estanques.map(e => e.id).join(' + ')} · ${totalMuestras} muestras`;

    document.getElementById('preview-sub').textContent =
      `${resultado.estanques.map(e => `${e.id}: ${e.medidas.length} muestras`).join(' · ')}`;
    document.getElementById('btn-preview').disabled = false;

    const asunto = `Muestreo ${resultado.fecha || new Date().toLocaleDateString('es-ES')} · ${resultado.estanques.map(e => e.id).join('+')}`;
    document.getElementById('enviar-sub').textContent = `Asunto: ${asunto}`;
    document.getElementById('btn-enviar').disabled = false;

    document.getElementById('num-alertas').textContent = totalAlertas;
    if (totalAlertas > 0) {
      document.getElementById('alertas-sub').textContent = resumenEstanques.join(' · ');
      document.getElementById('btn-alertas').disabled = false;
      document.getElementById('btn-alertas').style.background = '#991b1b';
    } else {
      document.getElementById('alertas-sub').textContent = 'Sin alertas — todo OK';
      document.getElementById('btn-alertas').disabled = false;
      document.getElementById('btn-alertas').style.background = '#16a34a';
    }

  } catch (err) {
    alert('Error al procesar la foto: ' + err.message);
    console.error(err);
  } finally {
    ocultarLoader();
  }
}

// ── Navegación ─────────────────────────────────────────────────────
function irPreview() {
  if (!state.resultado) return;
  sessionStorage.setItem('resultado_actual', JSON.stringify(state.resultado));
  window.location.href = 'preview.html';
}

function irHistorico() {
  window.location.href = 'history.html';
}

function irAlertas() {
  if (!state.resultado) return;
  sessionStorage.setItem('resultado_actual', JSON.stringify(state.resultado));
  sessionStorage.setItem('solo_alertas', '1');
  window.location.href = 'preview.html';
}

// ── Enviar mail ────────────────────────────────────────────────────
function enviarMail() {
  if (!state.resultado) return;

  const r = state.resultado;
  const asunto = encodeURIComponent(
    `Muestreo ${r.fecha || new Date().toLocaleDateString('es-ES')} · ${r.estanques.map(e => e.id).join('+')}`
  );

  let cuerpo = `Muestreo biométrico\nFecha: ${r.fecha}\n\n`;
  r.estanques.forEach(e => {
    const anom = e.medidas.filter(m => m.estado === 'ANOMALIA').length;
    const dud  = e.medidas.filter(m => m.estado === 'DUDOSO').length;
    cuerpo += `Estanque ${e.id}: ${e.medidas.length} muestras, ${anom} anomalías, ${dud} dudosos\n`;
  });
  cuerpo += '\nSe adjunta el Excel con los datos completos.';

  window.location.href = `mailto:?subject=${asunto}&body=${encodeURIComponent(cuerpo)}`;

  // Descargar Excel automáticamente para adjuntar
  generarYDescargarExcel(state.resultado);
}

// ── Loader ─────────────────────────────────────────────────────────
function mostrarLoader(texto) {
  document.getElementById('loader-text').textContent = texto || 'Procesando...';
  document.getElementById('loader').style.display = 'flex';
}
function ocultarLoader() {
  document.getElementById('loader').style.display = 'none';
}

// ── Sesiones locales ───────────────────────────────────────────────
function guardarSesion(sesion) {
  const ligera = {
    id: sesion.id,
    fecha: sesion.fecha,
    estanques: sesion.estanques,
    totalMuestras: sesion.totalMuestras,
    totalAlertas: sesion.totalAlertas
  };
  try {
    let sesiones = [];
    try { sesiones = JSON.parse(localStorage.getItem('sesiones') || '[]'); } catch(e) { sesiones = []; }
    sesiones.unshift(ligera);
    if (sesiones.length > 30) sesiones = sesiones.slice(0, 30);
    localStorage.setItem('sesiones', JSON.stringify(sesiones));
  } catch(e) {
    // localStorage lleno o corrupto: limpiar y guardar solo esta
    try {
      localStorage.clear();
      localStorage.setItem('sesiones', JSON.stringify([ligera]));
    } catch(e2) {
      // Si aun falla, ignorar: el histórico no es crítico
      console.warn('No se pudo guardar histórico:', e2);
    }
  }
  try { actualizarContadorSesiones(); } catch(e) {}
}

function cargarSesiones() {
  actualizarContadorSesiones();
}

function actualizarContadorSesiones() {
  const sesiones = JSON.parse(localStorage.getItem('sesiones') || '[]');
  document.getElementById('num-sesiones').textContent = sesiones.length;
}
