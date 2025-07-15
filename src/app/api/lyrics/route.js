export const dynamic = "force-dynamic";
import * as cheerio from "cheerio";

// src/app/api/lyrics/route.js
export async function POST(req) {
  console.log("📨 POST /api/lyrics received");
  const { title, artist, theme, provider = "lyrics.ovh" } = await req.json();

  // Normalize title and artist
  const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').split('feat.')[0].trim();
  const cleanArtist = artist.replace(/\(.*?\)|\[.*?\]/g, '').split('feat.')[0].trim();

  let lyrics = null;

  try {
    if (provider === "lyrics.ovh") {
      const lyricsURL = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`;
      console.log("📥 Requesting lyrics from:", lyricsURL);

      const lyricsRes = await fetch(lyricsURL);

      if (!lyricsRes.ok) {
        const html = await lyricsRes.text();
        console.warn("⚠️ Lyrics.ovh returned non-JSON response:", html);
        return new Response(JSON.stringify({ lyrics: null, error: "Lyrics not found." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const lyricsData = await lyricsRes.json();
      lyrics = lyricsData?.lyrics?.trim();
    } else if (provider === "genius") {
      const geniusRes = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`)}`, {
        headers: {
          Authorization: `Bearer ${process.env.GENIUS_ACCESS_TOKEN}`
        }
      });
      const geniusData = await geniusRes.json();
      const songPath = geniusData.response?.hits?.[0]?.result?.path;

      if (songPath) {
        const lyricsPage = await fetch(`https://genius.com${songPath}`);
        const html = await lyricsPage.text();
        const $ = cheerio.load(html);
        lyrics = $(".lyrics").text().trim() || $('[data-lyrics-container="true"]').text().trim();
      }
    }
  } catch (lyricsError) {
    console.error("❌ Error fetching lyrics:", lyricsError);
    return new Response(JSON.stringify({ lyrics: null, error: "Failed to fetch lyrics." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!lyrics) {
    return new Response(JSON.stringify({ lyrics: null, error: "Original lyrics not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const allowedModels = [
    "tngtech/deepseek-r1t2-chimera:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "openai/gpt-4o"
  ];
  const requestedModel = req.headers.get("x-model");
  const model = allowedModels.includes(requestedModel)
    ? requestedModel
    : "tngtech/deepseek-r1t2-chimera:free";

  const prompt = `Take the following lyrics from the song "${title}" by ${artist} and rewrite them in the theme of "${theme}". 
Do not worry about being family friendly, you can be explicit and innapropriate if it makes sense. Focus on inserting puns and being clever. You MUST ALWAYS match the rhythm, syllable count, and rhyme structure exactly with the original lyrics.
Do not explain your answer or include any commentary — just return the rewritten lyrics.

Original lyrics:
${lyrics}`;

  try {
    // AI request block: Route to OpenAI if model starts with "openai/", otherwise use OpenRouter
    if (model.startsWith("openai/")) {
      const openaiModel = model.split("/")[1];

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      console.log("🧠 OpenAI response:", JSON.stringify(data, null, 2));

      const lyrics = data.choices?.[0]?.message?.content?.trim();
      if (!lyrics) {
        return new Response(JSON.stringify({ lyrics: null }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ lyrics }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      // OpenRouter fallback
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Karaoke AI Lyrics",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      console.log("🧠 AI response:", JSON.stringify(data, null, 2));

      const lyrics = data.choices?.[0]?.message?.content?.trim();
      if (!lyrics) {
        return new Response(JSON.stringify({ lyrics: null }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ lyrics }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("❌ Error during AI request:", err);
    return new Response(JSON.stringify({ lyrics: null }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
// Simple GET method to help debug deployment and route accessibility
export async function GET(req) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}