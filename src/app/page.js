"use client";

import { useState } from "react";

const Button = ({ variant = "default", className, ...props }) => {
  const base = "px-4 py-2 rounded font-medium";
  const styles =
    variant === "outline"
      ? "border border-blue-600 text-blue-600 bg-white"
      : "bg-blue-600 text-white";
  return (
    <button
      type="button"
      {...props}
      className={`cursor-pointer ${base} ${styles} ${className || ""}`}
    />
  );
};

const Input = (props) => (
  <input
    {...props}
    className={`border p-2 rounded w-full ${props.className || ""}`}
  />
);

const Card = (props) => (
  <div
    className={`border rounded shadow p-4 bg-white ${props.className || ""}`}
  >
    {props.children}
  </div>
);

const CardContent = (props) => (
  <div className={props.className}>{props.children}</div>
);

const suggestedThemes = [
  "Cats",
  "Cheese",
  "Zoom fatigue",
  "Corporate life",
  "Getting adbucted by aliens",
  "Taco Tuesday",
];

export default function Home() {
  const [songQuery, setSongQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [customTheme, setCustomTheme] = useState("");
  const [chosenTheme, setChosenTheme] = useState("");
  const [generatedLyrics, setGeneratedLyrics] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [lyricsProvider, setLyricsProvider] = useState("lyrics.ovh");
  const [model, setModel] = useState("tngtech/deepseek-r1t2-chimera:free");

  const searchSongs = async (query) => {
    setSongQuery(query);
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`
      );

      if (
        !response.ok ||
        response.headers.get("content-type")?.includes("text/html")
      ) {
        const text = await response.text();
        console.warn(
          "❌ iTunes API returned unexpected response:",
          text.slice(0, 200)
        );
        return setSearchResults([]);
      }

      const data = await response.json();

      setSearchResults(
        data.results.map((track) => ({
          id: track.trackId,
          title: track.trackName,
          artist: track.artistName,
          appleMusicUrl: track.trackViewUrl,
        }))
      );
    } catch (error) {
      console.error("Error fetching songs:", error);
    }
  };

  const handleGenerateLyrics = async () => {
    if (!selectedSong) return;
    setLoading(true);
    setGeneratedLyrics("");
    const theme = customTheme || chosenTheme;

    if (demoMode) {
      const lyrics = `🎤 ${selectedSong.title} (Theme: ${theme})\n\nWhen I walk into the office late, my boss just stares at me\nTells me 'clock in with caffeine' — corporate life is misery...`;
      setTimeout(() => {
        setGeneratedLyrics(lyrics);
        setLoading(false);
      }, 500);
      return;
    }

    try {
      const response = await fetch("/api/lyrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-model": model,
        },
        body: JSON.stringify({
          title: selectedSong.title,
          artist: selectedSong.artist,
          theme: theme,
          provider: lyricsProvider,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Lyrics API error:", errorData?.error || "Unknown error");
        setGeneratedLyrics("⚠️ Could not fetch lyrics. Try a different song or provider.");
        return;
      }

      const data = await response.json();
      setGeneratedLyrics(data.lyrics || "No lyrics returned.");
    } catch (err) {
      console.error("Failed to generate lyrics:", err);
      setGeneratedLyrics("⚠️ Error generating lyrics. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AI Karaoke Lyric Remixer</h1>

      <div className="mb-4">
        <label className="mr-2 font-medium">Demo Mode</label>
        <input
          type="checkbox"
          checked={demoMode}
          onChange={() => setDemoMode(!demoMode)}
        />
      </div>

      <div className="mb-4">
        <label className="mr-2 font-medium">Lyrics Provider</label>
        <select
          value={lyricsProvider}
          onChange={(e) => setLyricsProvider(e.target.value)}
          className="border p-1 rounded"
        >
          <option value="lyrics.ovh">lyrics.ovh</option>
          <option value="flylyrics">flylyrics</option>
          <option value="audd">AudD ($)</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="mr-2 font-medium">AI Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="border p-1 rounded"
        >
          <option value="tngtech/deepseek-r1t2-chimera:free">deepseek (FREE)</option>
          <option value="meta-llama/llama-3.2-3b-instruct:free">llama (FREE - rate limited)</option>
          <option value="google/gemini-2.0-flash-exp:free">gemini (FREE - rate limited)</option>
          <option value="openai/gpt-4o">chatgpt-4.1 ($)</option>
        </select>
      </div>

      <label className="block mb-2 font-semibold">Search for a song:</label>
      <Input
        placeholder="Start typing a song title..."
        value={songQuery}
        onChange={(e) => searchSongs(e.target.value)}
        className="mb-2"
      />

      {searchResults.length > 0 && (
        <ul className="mb-4 border rounded p-2 bg-white max-h-60 overflow-y-auto">
          {searchResults.map((song) => (
            <li
              key={song.id}
              className="cursor-pointer hover:bg-gray-100 p-2 rounded"
              onClick={() => {
                setSelectedSong(song);
                setSongQuery(`${song.title} — ${song.artist}`);
                setSearchResults([]);
              }}
            >
              {song.title} — {song.artist}
            </li>
          ))}
        </ul>
      )}

      <label className="block mb-2 font-semibold">Choose a theme:</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {suggestedThemes.map((theme) => (
          <Button
            key={theme}
            variant={theme === chosenTheme ? "default" : "outline"}
            onClick={() => {
              setChosenTheme(theme);
              setCustomTheme(""); // Clear custom theme if one is selected
            }}
          >
            {theme}
          </Button>
        ))}
      </div>

      <Input
        placeholder="Or write your own theme..."
        value={customTheme}
        onChange={(e) => setCustomTheme(e.target.value)}
        className="mb-4"
      />

      <Button
        onClick={handleGenerateLyrics}
        disabled={loading || (!customTheme && !chosenTheme) || !selectedSong}
      >
        {loading ? "Generating..." : "Generate Lyrics"}
      </Button>

      {generatedLyrics && (
        <Card className="mt-6">
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm mb-4">
              {generatedLyrics}
            </pre>
            <a
              href={selectedSong.appleMusicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline text-sm"
            >
              ▶️ Open in Apple Music (Sing Mode)
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
