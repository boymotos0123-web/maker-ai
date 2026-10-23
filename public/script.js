const form = document.getElementById("form");
const promptEl = document.getElementById("prompt");
const wantImageEl = document.getElementById("wantImage");
const messagesEl = document.getElementById("messages");
const sendBtn = document.getElementById("sendBtn");

function addMessage({ role, text, imgSrc, isLoading = false }) {
  const div = document.createElement("div");
  div.className = `msg msg-${role}${isLoading ? " msg-loading" : ""}`;
  const p = document.createElement("p");
  p.textContent = text;
  div.appendChild(p);
  if (imgSrc) {
    const img = document.createElement("img");
    img.src = imgSrc;
    img.alt = "Conceito gerado do projeto";
    div.appendChild(img);
  }
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

async function askChat(prompt) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro desconhecido");
  return data.text;
}

async function askImage(prompt) {
  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro desconhecido");
  return `data:${data.mimeType};base64,${data.imageBase64}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const prompt = promptEl.value.trim();
  if (!prompt) return;

  addMessage({ role: "user", text: prompt });
  promptEl.value = "";
  sendBtn.disabled = true;

  const loadingMsg = addMessage({ role: "ai", text: "Pensando...", isLoading: true });

  try {
    const [text, imgSrc] = await Promise.all([
      askChat(prompt),
      wantImageEl.checked ? askImage(prompt) : Promise.resolve(null),
    ]);
    loadingMsg.remove();
    addMessage({ role: "ai", text, imgSrc });
  } catch (err) {
    loadingMsg.remove();
    addMessage({ role: "error", text: `Deu erro: ${err.message}` });
  } finally {
    sendBtn.disabled = false;
  }
});
