/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['openai'], // prevents Next.js from bundling openai
};

export default nextConfig;
