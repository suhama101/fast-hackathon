/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Prevent webpack from bundling these — they run in Node.js runtime only.
    // pdf-parse/pdfjs-dist need DOMMatrix which only exists in browsers.
    // Marking as external tells Next.js to require() them at runtime instead.
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
};

export default nextConfig;
