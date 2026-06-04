// ── Generación de Excel con SheetJS ───────────────────────────────

function generarYDescargarExcel(resultado) {
  const wb = XLSX.utils.book_new();

  resultado.estanques.forEach(estanque => {
    const rows = [['#', `Peso_${estanque.id} (g)`, 'Estado']];

    estanque.medidas.forEach(m => {
      rows.push([m.numero, m.peso_g ?? '', m.estado]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Anchos de columna
    ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 12 }];

    // Colorear cabecera (fila 1)
    const headerStyle = {
      fill: { fgColor: { rgb: '1E40AF' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true }
    };

    // Colorear filas por estado
    estanque.medidas.forEach((m, i) => {
      const rowIdx = i + 1; // fila 0 = cabecera
      const cellAddr = XLSX.utils.encode_cell({ r: rowIdx, c: 2 }); // columna Estado
      if (!ws[cellAddr]) return;

      if (m.estado === 'ANOMALIA') {
        ws[cellAddr].s = { fill: { fgColor: { rgb: 'FEE2E2' } }, font: { color: { rgb: 'DC2626' }, bold: true } };
        const pesoCell = XLSX.utils.encode_cell({ r: rowIdx, c: 1 });
        if (ws[pesoCell]) ws[pesoCell].s = { fill: { fgColor: { rgb: 'FEE2E2' } } };
      } else if (m.estado === 'DUDOSO') {
        ws[cellAddr].s = { fill: { fgColor: { rgb: 'FEF3C7' } }, font: { color: { rgb: 'B45309' }, bold: true } };
        const pesoCell = XLSX.utils.encode_cell({ r: rowIdx, c: 1 });
        if (ws[pesoCell]) ws[pesoCell].s = { fill: { fgColor: { rgb: 'FEF3C7' } } };
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, estanque.id);
  });

  // Nombre del archivo
  const fecha = (resultado.fecha || new Date().toLocaleDateString('es-ES'))
    .replace(/\//g, '-');
  const ids = resultado.estanques.map(e => e.id).join('_');
  const filename = `muestreo_${ids}_${fecha}.xlsx`;

  XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary' });
  return filename;
}

// ── Datos para tabla HTML de preview ──────────────────────────────
function resultadoATablaHTML(resultado, soloAlertas = false) {
  // Construimos filas combinando todos los estanques por número
  const estanques = resultado.estanques;
  const maxRows = Math.max(...estanques.map(e => e.medidas.length));
  let html = '<table class="preview-table"><thead><tr><th>#</th>';

  estanques.forEach(e => {
    html += `<th>Peso ${e.id} (g)</th><th>Estado ${e.id}</th>`;
  });
  html += '</tr></thead><tbody>';

  for (let i = 0; i < maxRows; i++) {
    // Si soloAlertas, saltar filas sin alertas
    const tieneAlerta = estanques.some(e => {
      const m = e.medidas[i];
      return m && (m.estado === 'ANOMALIA' || m.estado === 'DUDOSO');
    });
    if (soloAlertas && !tieneAlerta) continue;

    html += `<tr><td>${i + 1}</td>`;
    estanques.forEach(e => {
      const m = e.medidas[i];
      if (!m) { html += '<td>—</td><td>—</td>'; return; }
      const peso = m.peso_g ?? '—';
      let estadoHtml = '';
      if (m.estado === 'ANOMALIA') estadoHtml = `<span class="status-anomalia">ANOMALÍA</span>`;
      else if (m.estado === 'DUDOSO') estadoHtml = `<span class="status-dudoso">DUDOSO</span>`;
      else estadoHtml = `<span class="status-ok">OK</span>`;
      html += `<td>${peso}</td><td>${estadoHtml}</td>`;
    });
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}
