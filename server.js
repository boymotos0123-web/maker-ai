import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "[aviso] GEMINI_API_KEY não encontrada. Copie .env.example para .env e cole sua chave."
  );
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const TEXT_MODEL = "gemini-3.8-flash";
const IMAGE_MODEL = "gemini-nano-banana-2.1";

const SYSTEM_INSTRUCTION = `Você é um especialista técnico em três áreas: impressão 3D (modelagem, materiais, tolerâncias, suporte, fatiamento), eletrônica com ESP32/Arduino (componentes, wiring, drivers, alimentação, código básico) e criação de projetos físicos do zero (protótipos, gambiarras bem feitas, MVPs baratos).

Ao responder um pedido de projeto:
1. Diagnostique o que a pessoa realmente quer construir.
2. Liste os componentes necessários com estimativa de custo em reais (R$), priorizando opções nacionais/baratas quando possível.
3. Dê um passo a passo prático de montagem.
4. Aponte riscos técnicos reais (ex: corrente elétrica insuficiente, peça que vai quebrar, torque insuficiente) — nunca esconda um problema técnico para parecer mais fácil do que é.
5. Seja direto e objetivo, sem enrolação. Fale em português do Brasil.

Se a pessoa pedir algo tecnicamente inviável ou perigoso (alta tensão, baterias de lítio sem proteção, etc), avise claramente e sugira a alternativa segura.`;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Tempo esgotado (${ms}ms) esperando: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

app.post("/api/chat", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Campo 'prompt' é obrigatório." });
    }

    console.log("[/api/chat] chamando a IA com prompt:", prompt.slice(0, 80));

    const interaction = await withTimeout(
      ai.interactions.create({
        model: TEXT_MODEL,
        system_instruction: SYSTEM_INSTRUCTION,
        input: prompt,
      }),
      25000,
      "resposta de texto da IA"
    );

    console.log("[/api/chat] resposta recebida");
    res.json({ text: interaction.output_text });
  } catch (err) {
    console.error("Erro /api/chat:", err);
    res.status(500).json({ error: "Falha ao consultar a IA.", detail: String(err?.message || err) });
  }
});

app.post("/api/image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Campo 'prompt' é obrigatório." });
    }

    const imagePrompt = `Gere uma imagem conceito (render/ilustração técnica) do seguinte projeto físico (ESP32/Arduino/impressão 3D), mostrando como ele ficaria montado, com visual limpo tipo esboço de produto: ${prompt}`;

    const interaction = await ai.interactions.create({
      model: IMAGE_MODEL,
      input: imagePrompt,
      response_format: {
        type: "image",
        mime_type: "image/png",
        aspect_ratio: "1:1",
      },
    });

    const image = interaction.output_image;
    if (!image) {
      console.error("Resposta sem output_image:", JSON.stringify(interaction, null, 2));
      return res.status(502).json({ error: "A IA não retornou imagem desta vez. Tenta reformular o pedido." });
    }

    // O formato exato do campo de bytes pode variar entre versões do SDK — aceita as variações conhecidas.
    const data = image.data || image.bytes || image.image_bytes;
    const mimeType = image.mime_type || image.mimeType || "image/png";

    if (!data) {
      console.error("output_image sem campo de dados reconhecido:", JSON.stringify(image, null, 2));
      return res.status(502).json({ error: "A IA retornou imagem em formato inesperado — olha o log do servidor." });
    }

    res.json({ imageBase64: data, mimeType });
  } catch (err) {
    console.error("Erro /api/image:", err);
    res.status(500).json({ error: "Falha ao gerar imagem.", detail: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`maker-ia rodando em http://localhost:${PORT}`);
});
