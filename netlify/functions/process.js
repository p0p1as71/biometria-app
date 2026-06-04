exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return {statusCode:405,body:JSON.stringify({error:'Not allowed'})};
  let body; try{body=JSON.parse(event.body);}catch{return {statusCode:400,body:JSON.stringify({error:'Bad JSON'})};}
  const {image}=body;
  if(!image) return {statusCode:400,body:JSON.stringify({error:'Falta image'})};
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) return {statusCode:500,body:JSON.stringify({error:'API key no configurada'})};

  // Schema FILA-BASADO: cada fila tiene sus 4 pesos
  const schema={type:'object',additionalProperties:false,required:['fecha','estanques'],properties:{
    fecha:{type:'string'},
    estanques:{type:'array',items:{type:'object',additionalProperties:false,required:['id','filas'],properties:{
      id:{type:'string'},
      filas:{type:'array',items:{type:'object',additionalProperties:false,required:['fila','c1','c2','c3','c4'],properties:{
        fila:{type:'integer'},
        c1:{type:['number','null']},
        c2:{type:['number','null']},
        c3:{type:['number','null']},
        c4:{type:['number','null']}
      }}}
    }}}
  }};

  const prompt=`Analiza esta hoja de muestreo biometrico manuscrita.

ESTRUCTURA:
- Esquina superior derecha: fecha
- Cabeceras superiores: IDs de estanque escritos a mano
- 50 filas numeradas (1 a 50) en el lateral izquierdo
- Cada estanque ocupa 4 columnas de datos

EXTRACCION CRITICA:
- Para CADA una de las 50 filas debes extraer LOS 4 VALORES de las 4 columnas
- c1 = primera columna, c2 = segunda, c3 = tercera, c4 = cuarta
- Cada fila tiene 4 numeros distintos, NO uno solo
- Si una celda esta vacia o ilegible pon null
- Total de datos por estanque = 50 filas x 4 columnas = 200 valores

NUMERO DE ESTANQUES:
- Las 4 columnas IZQUIERDA = primer estanque
- Las 4 columnas DERECHA = segundo estanque SOLO si tienen numeros en 20+ filas
- Si las columnas derechas estan vacias devuelve SOLO 1 estanque

- Usa el ID real del estanque de la cabecera`;

  try{
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),40000);
    const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal:ctrl.signal,headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model:'gpt-4o',max_tokens:16000,response_format:{type:'json_schema',json_schema:{name:'muestreo',strict:true,schema:schema}},messages:[{role:'user',content:[{type:'image_url',image_url:{url:`data:image/jpeg;base64,${image}`,detail:'high'}},{type:'text',text:prompt}]}]})});
    clearTimeout(t);
    if(!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data=await res.json();
    const content=data.choices?.[0]?.message?.content;
    if(!content) throw new Error('Sin datos');
    const raw=JSON.parse(content);

    // APLANAR: convertir filas (c1-c4) en lista de 200 medidas
    const resultado={fecha:raw.fecha,estanques:[]};
    raw.estanques.forEach(est=>{
      const medidas=[];
      let n=1;
      est.filas.sort((a,b)=>a.fila-b.fila).forEach(f=>{
        [f.c1,f.c2,f.c3,f.c4].forEach(peso=>{
          medidas.push({numero:n++,peso_g:peso,estado:peso==null?'DUDOSO':'OK'});
        });
      });
      resultado.estanques.push({id:est.id,medidas:medidas});
    });

    // Recalcular anomalias por estanque
    resultado.estanques.forEach(e=>{
      const p=e.medidas.filter(m=>m.peso_g!=null).map(m=>m.peso_g);
      if(p.length<4) return;
      const media=p.reduce((a,b)=>a+b,0)/p.length;
      const std=Math.sqrt(p.reduce((a,b)=>a+(b-media)**2,0)/(p.length-1));
      e.medidas.forEach(m=>{
        if(m.peso_g==null) m.estado='DUDOSO';
        else if(Math.abs(m.peso_g-media)>2.5*std) m.estado='ANOMALIA';
        else m.estado='OK';
      });
    });

    return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify(resultado)};
  }catch(err){
    return {statusCode:500,body:JSON.stringify({error:err.message})};
  }
};
