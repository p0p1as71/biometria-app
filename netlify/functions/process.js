exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }
  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
  }
  const { image } = body;
  if (!image) return { statusCode: 400, body: JSON.stringify({ error: 'Falta image' }) };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'API key no configurada' }) };
  const jsonSchema = {
    type:'object', additionalProperties:false,
    required:['fecha','estanques'],
    properties:{
      fecha:{type:'string'},
      estanques:{type:'array',items:{
        type:'object',additionalProperties:false,
        required:['id','medidas'],
        properties:{
          id:{type:'string'},
          medidas:{type:'array',items:{
            type:'object',additionalProperties:false,
            required:['numero','peso_g','estado'],
            properties:{
              numero:{type:'integer'},
              peso_g:{type:['number','null']},
              estado:{type:'string',enum:['OK','ANOMALIA','DUDOSO']}
            }
          }}
        }
      }}
    }
  };
  const prompt = `Analiza esta hoja de muestreo manuscrita. Esquina superior derecha: fecha. Cabeceras: IDs estanque. Hasta 50 filas y 8 columnas. Las 4 columnas IZQUIERDA = estanque 1. Las 4 columnas DERECHA = estanque 2 si hay datos. Lee fila por fila. Marca ANOMALIA si el valor supera 2.5 desviaciones tipicas. Marca DUDOSO si no lees con certeza. peso_g null si ilegible.`;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({
        model:'gpt-4o-mini', max_tokens:8096,
        response_format:{type:'json_schema',json_schema:{name:'muestreo',strict:true,schema:jsonSchema}},
        messages:[{role:'user',content:[
          {type:'image_url',image_url:{url:`data:image/jpeg;base64,${image}`}},
          {type:'text',text:prompt}
        ]}]
      })
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const resultado = JSON.parse(data.choices[0].message.content);
    resultado.estanques.forEach(e => {
      const pesos = e.medidas.filter(m=>m.peso_g!=null).map(m=>m.peso_g);
      if (pesos.length < 4) return;
      const media = pesos.reduce((a,b)=>a+b,0)/pesos.length;
      const std = Math.sqrt(pesos.reduce((a,b)=>a+(b-media)**2,0)/(pesos.length-1));
      e.medidas.forEach(m=>{
        if (m.peso_g==null) m.estado='DUDOSO';
        else if (Math.abs(m.peso_g-media)>2.5*std) m.estado='ANOMALIA';
        else if (m.estado!=='DUDOSO') m.estado='OK';
      });
    });
    return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify(resultado)};
  } catch(err) {
    return {statusCode:500,body:JSON.stringify({error:err.message})};
  }
};
