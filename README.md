# Maker IA

Assistente pessoal de IA especializado em projetos de impressão 3D, ESP32 e Arduino — dá o passo a passo técnico e gera uma imagem conceito do projeto.

## Rodando localmente

```bash
npm install
cp .env.example .env
# edita o .env e cola sua GEMINI_API_KEY
npm start
```

Abre `http://localhost:3000`.

## Como funciona

- `server.js` — backend Express. Mantém a API key só no servidor (nunca exposta no navegador).
- `public/` — frontend (chat simples).
- Texto: modelo `gemini-3.8-flash`, com um `system_instruction` que especializa a IA em eletrônica/ESP32/Arduino/impressão 3D.
- Imagem: modelo `gemini-nano-banana-2.1`, gera uma imagem conceito/render do projeto descrito.

## Importante

A imagem gerada é um **conceito visual** (render/ilustração) de como o projeto ficaria — não é um arquivo 3D pronto pra imprimir (STL). Pra isso, o próximo passo seria gerar código paramétrico (ex: OpenSCAD) e abrir num slicer.

## Deploy (opcional)

Pra deixar isso rodando 24/7 fora do seu PC, dá pra subir de graça em [Render](https://render.com) ou [Railway](https://railway.app) — só configurar a variável de ambiente `GEMINI_API_KEY` no painel deles.
