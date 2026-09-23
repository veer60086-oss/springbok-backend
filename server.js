// Springbok backend — proxies requests to the Anthropic API.
// Keeps your API key on the server, never in the app itself.

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

if (!API_KEY) {
  console.warn("WARNING: ANTHROPIC_API_KEY is not set. Requests will fail.");
}

// Prompt templates per tool. Keep these short and specific —
// good prompts matter more than clever code for output quality.
const PROMPTS = {
  insta: (v) => `Write 3 distinct Instagram captions for a post about: "${v.topic}".
Vibe: ${v.vibe}.
Each caption: 1-3 sentences, no emojis unless the vibe calls for it, end with 4 relevant hashtags.
Return ONLY a JSON array of 3 strings, nothing else.`,

  yt: (v) => `Write a YouTube Shorts script about: "${v.topic}".
Target length: ${v.length}.
Structure: a 3-second hook, clear beats building the idea, a strong call to action at the end.
Label each section (HOOK, BEAT 1, BEAT 2, ..., CTA).
Return ONLY a JSON array with one string containing the full script, nothing else.`,

  realestate: (v) => `Write 3 short real-estate follow-up text messages to a lead named "${v.name}".
Lead stage: ${v.stage}.
Each message: warm, specific to the stage, under 40 words, one clear next step or question.
Return ONLY a JSON array of 3 strings, nothing else.`,

  product: (v) => `Write 3 product descriptions for "${v.product}", whose main benefit is: "${v.benefit}".
Give 3 different tones: friendly/casual, minimal/premium, and benefit-driven/persuasive.
Each description: 2-3 sentences.
Return ONLY a JSON array of 3 strings, nothing else.`,
};

app.post("/api/generate", async (req, res) => {
  try {
    const { tool, values } = req.body;
    const buildPrompt = PROMPTS[tool];
    if (!buildPrompt) {
      return res.status(400).json({ error: "Unknown tool: " + tool });
    }

    const prompt = buildPrompt(values || {});

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return res.status(502).json({ error: "AI request failed." });
    }

    const data = await response.json();
    const text = data.content.map((c) => c.text || "").join("\n");

    let results;
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      results = JSON.parse(clean);
    } catch (e) {
      // Fallback: if the model didn't return clean JSON, wrap the raw text.
      results = [text.trim()];
    }

    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Springbok backend running on port ${PORT}`));
