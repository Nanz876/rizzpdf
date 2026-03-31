import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent webpack from bundling mupdf (WASM) — let Node.js require it directly
  serverExternalPackages: ["mupdf"],
};

export default nextConfig;
