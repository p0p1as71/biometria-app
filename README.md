# Biometría App

Demo funcional · Automatización de muestreo biométrico mediante Vision AI.

## Stack
- HTML / CSS / JS (PWA)
- Netlify Functions (proxy API key)
- Claude Haiku 4.5 (Anthropic API)
- Supabase (histórico de sesiones)
- SheetJS (generación Excel)

## Variables de entorno (Netlify)
```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

## Desarrollo local
Abrir `index.html` en navegador o usar Netlify CLI:
```bash
npm install -g netlify-cli
netlify dev
```
