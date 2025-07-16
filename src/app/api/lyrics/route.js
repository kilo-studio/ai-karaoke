import * as cheerio from "cheerio";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const lyricsCache = new Map();

export async function POST(req) {
  console.log("📨 POST /api/lyrics received");

  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
  }

  const body = await req.json();
  console.log("🧾 Parsed request:", body);
  const { title, artist, theme, provider = "lyrics.ovh" } = body;

  const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').split('feat.')[0].trim();
  const cleanArtist = artist.replace(/\(.*?\)|\[.*?\]/g, '').split('feat.')[0].trim();

  const cacheKey = `${provider}::${cleanArtist}::${cleanTitle}`;
  let lyrics = null;
  if (lyricsCache.has(cacheKey)) {
    console.log("🗃️ Cache hit for lyrics");
    lyrics = lyricsCache.get(cacheKey);
  } else {
    console.log("🆕 Cache miss for lyrics");
  }

  try {
    if (!lyrics) {
      if (provider === "lyrics.ovh") {
        const lyricsURL = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`;
        console.log("📥 Requesting lyrics from:", lyricsURL);

        const lyricsRes = await fetch(lyricsURL);

        if (!lyricsRes.ok) {
          const html = await lyricsRes.text();
          console.warn("⚠️ Lyrics.ovh returned non-JSON response:", html);
          return NextResponse.json({ lyrics: null, error: "Lyrics not found." }, { status: 404 });
        }

        const lyricsData = await lyricsRes.json();
        lyrics = lyricsData?.lyrics?.trim();
        if (lyrics) lyricsCache.set(cacheKey, lyrics);
      } else if (provider === "flylyrics") {
        const lyricsURL = `https://lyrics-api.fly.dev/?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`;
        console.log("📥 Requesting lyrics from flylyrics:", lyricsURL);

        const lyricsRes = await fetch(lyricsURL);

        if (!lyricsRes.ok) {
          const errorText = await lyricsRes.text();
          console.warn("⚠️ flylyrics returned error:", errorText);
          return NextResponse.json({ lyrics: null, error: "Lyrics not found from flylyrics." }, { status: 404 });
        }

        const lyricsData = await lyricsRes.json();
        lyrics = lyricsData?.lyrics?.trim();
        if (lyrics) lyricsCache.set(cacheKey, lyrics);
      } else if (provider === "audd") {
        const auddApiKey = process.env.AUDD_API_KEY;
        if (!auddApiKey) {
          console.error("❌ AUDD_API_KEY is undefined!");
          return NextResponse.json({ lyrics: null, error: "AUDD_API_KEY not set" }, { status: 500 });
        }

        const auddURL = `https://api.audd.io/findLyrics/?q=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`)}&api_token=${auddApiKey}`;
        console.log("📥 Requesting lyrics from AudD:", auddURL);

        const auddRes = await fetch(auddURL);

        if (!auddRes.ok) {
          const errorText = await auddRes.text();
          console.warn("⚠️ AudD returned error:", errorText);
          return NextResponse.json({ lyrics: null, error: "Lyrics not found from AudD." }, { status: 404 });
        }

        const auddData = await auddRes.json();
        const firstResult = auddData?.result?.[0];
        lyrics = firstResult?.lyrics?.trim();
        if (lyrics) lyricsCache.set(cacheKey, lyrics);
      }
    }
  } catch (lyricsError) {
    console.error("❌ Error fetching lyrics:", lyricsError);
    return NextResponse.json({ lyrics: null, error: "Failed to fetch lyrics." }, { status: 500 });
  }

  if (!lyrics) {
    return NextResponse.json({ lyrics: null, error: "Original lyrics not found." }, { status: 404 });
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

      const aiLyrics = data.choices?.[0]?.message?.content?.trim();
      if (!aiLyrics) {
        return NextResponse.json({ lyrics: null }, { status: 500 });
      }

      return NextResponse.json({
        appleMusicUrl: `https://music.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}`,
        lyrics: aiLyrics
      }, { status: 200 });
    } else {
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

      const aiLyrics = data.choices?.[0]?.message?.content?.trim();
      if (!aiLyrics) {
        return NextResponse.json({ lyrics: null }, { status: 500 });
      }

      return NextResponse.json({
        appleMusicUrl: `https://music.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}`,
        lyrics: aiLyrics
      }, { status: 200 });
    }
  } catch (err) {
    console.error("❌ Error during AI request:", err);
    return NextResponse.json({ lyrics: null }, { status: 500 });
  }
}

export async function GET() {
  return new Response("Lyrics endpoint is alive", { status: 200 });
}
