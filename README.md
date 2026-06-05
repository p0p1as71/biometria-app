# Biometria App

Demo funcional - Automatizacion de muestreo biometrico mediante Vision AI.

## Stack
- HTML / CSS / JS (PWA)
- Netlify Functions (proxy seguro de API key)
- OpenAI gpt-4o (extraccion de vision)
- localStorage (historico de sesiones en dispositivo)
- SheetJS (generacion de Excel)

## Variables de entorno (Netlify)

OPENAI_API_KEY=

## Como funciona
1. Se toma o sube una foto de la hoja de muestreo manuscrita
2. La imagen se comprime en el cliente y se envia a la Netlify Function
3. La Function llama a OpenAI gpt-4o con extraccion estructurada (JSON schema)
4. Se extraen 200 muestras por estanque (50 filas x 4 columnas)
5. Las anomalias se recalculan estadisticamente (2.5 desviaciones tipicas)
6. El operario revisa, descarga el Excel y lo envia

## Gobernanza
El sistema detecta, no decide. La validacion y el envio final son del operario.

## Desarrollo local

npm install -g netlify-cli
netlify dev

