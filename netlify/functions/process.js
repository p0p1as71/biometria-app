exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return {statusCode:405,body:JSON.stringify({error:'Not allowed'})};
  let body; try{body=JSON.parse(event.body);}catch{return {statusCode:400,body:JSON.stringify({error:'Bad JSON'})};}
  const {image}=body;
  if(!image) return {statusCode:400,body:JSON.stringify({error:'Falta image'})};
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) return {statusCode:500,body:JSON.stringify({error:'API key no configurada'})};
  const schema={type:'object',additionalProperties:false,required:['fecha','estanques'],properties:{fecha:{type:'string'},estanques:{type:'array',items:{type:'object',additionalProperties:false,required:['id','medidas'],properties:{id:{type:'string'},medidas:{type:'array',items:{type:'object',additionalProperties:false,required:['numero','peso_g','estado'],properties:{numero:{type:'integer'},peso_g:{type:['number','null']},estado:{type:'string',enum:['OK','ANOMALIA','DUDOSO']}}}}}}}}};
  const prompt=`Analiza esta hoja de muestreo manuscrita. Esquina superior derecha: fecha. Cabeceras: IDs estanque. Hasta 50 filas y 8 columnas. 4 columnas IZQUIERDA=estanque 1. 4 columnas DERECHA=estanque 2 si hay datos. Si solo 4 columnas escritas es 1 estanque. Lee fila por fila. Marca ANOMALIA si supera 2.5 desviaciones tipicas. Marca DUDOSO si no lees con certeza. peso_g null si ilegible. Anomalias por estanque separadas.`;
  try{
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),25000);
    const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal:ctrl.signal,headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model:'gpt-4o-mini',max_tokens:8096,response_format:{type:'json_schema',json_schema:{name:'muestreo',strict:true,schema:schema}},messages:[{role:'user',content:[{type:'image_url',image_url:{url:`data:image/jpeg;base64,${image}`}},{type:'text',text:prompt}]}]})});
    clearTimeout(t);
    if(!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data=await res.json();
    const content=data.choices?.[0]?.message?.content;
    if(!content) throw new Error('Sin datos');
    const resultado=JSON.parse(content);
    resultado.estanques.forEach(e=>{
      const p=e.medidas.filter(m=>m.peso_g!=null).map(m=>m.peso_g);
      if(p.length<4) return;
      const media=p.reduce((a,b)=>a+b,0)/p.length;
      const std=Math.sqrt(p.reduce((a,b)=>a+(b-media)**2,0)/(p.length-1));
      e.medidas.forEach(m=>{
        if(m.peso_g==null) m.estado='DUDOSO';
        else if(Math.abs(m.peso_g-media)>2.5*std) m.estado='ANOMALIA';
        else if(m.estado!=='DUDOSO') m.estado='OK';
      });
    });
    return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify(resultado)};
  }catch(err){
    return {statusCode:500,body:JSON.stringify({error:err.message})};
  }
};
