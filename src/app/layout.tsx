import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Big_Shoulders, Inter } from "next/font/google";
import { GlobalSettings } from "@/ui/GlobalSettings";
import "./globals.css";

const bigShoulders = Big_Shoulders({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-big-shoulders",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  ),
  title: "Wanderpark",
  description:
    "Build the park of your dreams. Survive the business behind it. A 3D theme-park tycoon for your browser.",
  openGraph: {
    title: "Wanderpark",
    description:
      "Build the park of your dreams. Survive the business behind it. A 3D theme-park tycoon for your browser — free, no accounts.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Wanderpark" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wanderpark",
    description: "A 3D theme-park tycoon for your browser — free, no accounts.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bigShoulders.variable} ${inter.variable} ${atkinson.variable}`}>
      <body className="antialiased">
        <GlobalSettings />
        {children}
      </body>
    </html>
  );
}
