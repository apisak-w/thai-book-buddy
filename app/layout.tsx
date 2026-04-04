import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Literata, Plus_Jakarta_Sans, Sarabun } from "next/font/google";
import "./globals.css";
import { LIFFProvider } from "../providers/liff-providers";

const literata = Literata({ subsets: ["latin"], variable: "--font-literata" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const sarabun = Sarabun({ subsets: ["thai"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-sarabun" });

export const metadata: Metadata = {
  title: "LIFF App",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="en">
      <body className={`${literata.variable} ${jakarta.variable} ${sarabun.variable}`} nonce={nonce}>
        <LIFFProvider><main>{children}</main></LIFFProvider>
      </body>
    </html>
  );
}
