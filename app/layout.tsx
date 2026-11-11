import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuickSuuq Affiliate Admin",
  description: "QuickSuuq custom affiliate management system",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="shopify-api-key" content="1f44ef2798c84636a0b82307c52f0334" />
        <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" strategy="beforeInteractive" />
      </head>
      <body>{children}</body>
    </html>
  );
}
