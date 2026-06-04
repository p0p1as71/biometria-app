// netlify/functions/process.js
// Proxy seguro: la API key nunca sale al cliente

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { image } = body;
  if (!image) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta el campo image' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key no configurada' }) };
  }

  // ── Schema de respuesta ────────────────────────────────────────
  const schema = {
    type: 'object',
    properties: {
      fecha: { type: 'string', description: 'Fecha del muestreo (esquina superior derecha de la hoja)' },
      estanques: {
        type: 'array',
        minItems: 1,
        maxItems: 2,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID del estanque (ej: E3, F6, D5A)' },
            medidas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  numero:  { type: 'integer' },
                  peso_g:  { type: ['number', 'null'], description: 'null si celda ilegible' },
                  estado:  { type: 'string', enum: ['OK', 'ANOMALIA', 'DUDOSO'] }
                },
                required: ['numero', 'peso_g', 'estado']
              }
            }
          },
          required: ['id', 'medidas']
        }
      }
    },
    required: ['fecha', 'estanques']
  };

  // ── Prompt ─────────────────────────────────────────────────────
  const prompt = `Analiza esta hoja de muestreo biométrico manuscrita.

ESTRUCTURA DE LA HOJA:
- Esquina superior derecha: fecha del muestreo
- Cabeceras superiores: IDs de estanque (ej: E3, F6, D5A)
- La hoja tiene hasta 50 filas numeradas y hasta 8 columnas de datos
- Las 4 columnas de la IZQUIERDA corresponden al primer estanque (200 muestras: 50 filas × 4 columnas)
- Las 4 columnas de la DERECHA corresponden al segundo estanque (si las hay escritas)
- Si solo hay 4 columnas escritas, es un único estanque

INSTRUCCIONES:
1. Extrae la fecha de la esquina superior derecha
2. Identifica cuántos estanques hay (1 o 2) según si las columnas derechas tienen datos
3. Para cada estanque, extrae las medidas en orden: lee las 4 columnas de izquierda a derecha, fila por fila (1 a 50)
4. Marca como ANOMALIA los valores que se alejen estadísticamente del resto del lote (±2.5 desviaciones típicas)
5. Marca como DUDOSO cualquier número que no leas con certeza
6. Si una celda es ilegible, pon peso_g como null y estado DUDOSO

IMPORTANTE: calcula anomalías por estanque por separado, no mezclando los dos lotes.`;

  // ── Llamada a Claude API ────────────────────────────────────────
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8096,
        tools: [{
          name: 'registrar_muestreo',
          description: 'Registra los datos del muestreo extraídos de la imagen',
          input_schema: schema
        }],
        tool_choice: { type: 'tool', name: 'registrar_muestreo' },
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const toolBlock = data.content.find(b => b.type === 'tool_use');
    if (!toolBlock) throw new Error('El modelo no devolvió datos estructurados');

    const resultado = toolBlock.input;

    // ── Recalcular anomalías estadísticamente ───────────────────
    resultado.estanques.forEach(estanque => {
      const pesos = estanque.medidas
        .filter(m => m.peso_g !== null && m.peso_g !== undefined)
        .map(m => m.peso_g);

      if (pesos.length < 4) return;

      const media = pesos.reduce((a, b) => a + b, 0) / pesos.length;
      const std = Math.sqrt(pesos.reduce((a, b) => a + (b - media) ** 2, 0) / (pesos.length - 1));
      const umbral = 2.5 * std;

      estanque.medidas.forEach(m => {
        if (m.peso_g === null || m.peso_g === undefined) {
          m.estado = 'DUDOSO';
        } else if (Math.abs(m.peso_g - media) > umbral) {
          m.estado = 'ANOMALIA';
        } else if (m.estado !== 'DUDOSO') {
          m.estado = 'OK';
        }
      });
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resultado)
    };

  } catch (err) {
    console.error('Error en process.js:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
