import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize packages that don't bundle well with Turbopack
  serverExternalPackages: ["qrcode", "pdf-lib", "@react-pdf/renderer"],
};

export default nextConfig;
// Force deploy Wed Feb  4 19:42:04 CST 2026
