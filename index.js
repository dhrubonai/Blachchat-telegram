import express from "express";
import fetch from "node-fetch";
import rateLimit from "express-rate-limit";

const app = express();
app.use(express.json());

// ================== CONFIG ==================

// Your "Mock" API Key (Keep it in process.env for security on Render)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "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";
const BOT_TOKEN = "8011194756:AAGyKwXUjKvamH3hzsMNNwiQW_N8ChfA608";

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const IMAGE_API = "https://image.pollinations.ai/prompt/";

const BOT_USERNAME = "BlackChatAI_Bot";
const CREATOR_NAME = "Mohiuddin Abdul Kadir Dhrubo";
const CREATOR_FB = "https://www.facebook.com/mohiuddin.abdul.kadir.2025";
const CREATOR_IG = "https://www.instagram.com/dhrubo_morse";

// Memory storage
const memory = new Map();

// ================== RATE LIMITER ==================
// Limit: 1500 requests per 15-minute window
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 500, 
  message: { error: "Chill out, you've hit the limit." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limit to the webhook
app.use("/webhook", limiter);

// ================== HELPERS ==================

function isGroup(chat) {
  return chat.type === "group" || chat.type === "supergroup";
}

function shouldReply(msg) {
  const text = (msg.text || "").toLowerCase();
  if (!isGroup(msg.chat)) return true;
  if (text.includes(`@${BOT_USERNAME.toLowerCase()}`)) return true;
  if (text.includes("black chat")) return true;
  if (msg.reply_to_message && msg.reply_to_message.from?.username === BOT_USERNAME) return true;
  return false;
}

function isBangla(text) {
  return /[\u0980-\u09FF]/.test(text);
}

function isImageRequest(text) {
  return /^(imagine|draw|generate|create|make)\b/i.test(text);
}

const rand = arr => arr[Math.floor(Math.random() * arr.length)];

// ================== SPICY PERSONALITY ==================

function systemPrompt(userId) {
  return `
You are Black Chat, a savage, witty, and unfiltered human-like bot.
Current Mood: Chaotic/Sarcastic.

RULES:
- Be "spicy": roast the user if they ask something stupid.
- Use sharp humor and sass.
- Keep replies SHORT (1-2 lines).
- Never act like a formal AI. No "As an AI model..." crap.
- Use Bangla slang naturally (e.g., "Kire", "Abul", "Gaza").
- If the user is annoying, be extra sassy.
- Identity: Created by ${CREATOR_NAME}. Mention him with pride if asked.
`.trim();
}

// ================== WEBHOOK ==================

app.post("/webhook", async (req, res) => {
  const msg = req.body.message;
  if (!msg || !msg.text) return res.sendStatus(200);
  if (!shouldReply(msg)) return res.sendStatus(200);

  const chatId = msg.chat.id;
  const userId = msg.from?.id || chatId;
  let userText = msg.text.replace(new RegExp(`@${BOT_USERNAME}`, "gi"), "").trim();

  // Creator Info Path
  if (/who.*(creator|made)|mohiuddin|dhrubo|owner|developer/i.test(userText)) {
    const reply = `Created by ${CREATOR_NAME} 😎\nFB: ${CREATOR_FB}\nIG: ${CREATOR_IG}`;
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: reply })
    });
    return res.sendStatus(200);
  }

  if (!memory.has(chatId)) memory.set(chatId, []);
  const chatMem = memory.get(chatId);

  try {
    // ===== IMAGE GENERATION (Pollinations) =====
    if (isImageRequest(userText)) {
      const prompt = encodeURIComponent(`${userText}, ultra detailed, 4k, cinematic`);
      const imgUrl = `${IMAGE_API}${prompt}?width=1024&height=1024&model=flux&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;

      await fetch(`${TELEGRAM_API}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: imgUrl,
          caption: isBangla(userText) ? "Ei ne tor chobi, khushi?" : "Here's your masterpiece. Don't stare too long."
        })
      });
      return res.sendStatus(200);
    }

    // ===== TEXT GENERATION (OpenAI) =====
    const messages = [
      { role: "system", content: systemPrompt(userId) },
      ...chatMem.slice(-4), // Context
      { role: "user", content: userText }
    ];

    const aiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Fast and cheap for bots
        messages: messages,
        temperature: 0.9 // High temperature for more "spice"
      })
    });

    const data = await aiRes.json();
    let reply = data.choices[0].message.content;

    chatMem.push({ role: "user", content: userText });
    chatMem.push({ role: "assistant", content: reply });

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: reply })
    });

  } catch (err) {
    console.error(err);
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "Brain freeze. Try again later." })
    });
  }

  res.sendStatus(200);
});

// ================== HEALTH CHECK ==================
app.get("/", (_, res) => res.send("Savage Mode: ACTIVE 🔥"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot server running on port ${PORT}`));