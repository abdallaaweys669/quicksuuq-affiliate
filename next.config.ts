import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://quicksuuq.madalhub.me 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

