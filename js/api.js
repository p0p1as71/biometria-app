// ── Llamada al proxy Netlify → Claude API ──────────────────────────
async function llamarAPI(base64Image) {
  const response = await fetch('/.netlify/functions/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return await response.json(); // HojaMuestreo
}
