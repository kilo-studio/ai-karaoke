/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true
  },
  env: {
    GENIUS_ACCESS_TOKEN: process.env.GENIUS_ACCESS_TOKEN,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  }
};

export default nextConfig;
