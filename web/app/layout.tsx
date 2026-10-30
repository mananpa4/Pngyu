import type { Metadata } from "next";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Pngyu Tools — simple media conversion", template: "%s | Pngyu Tools" },
  description: "Fast, private-by-default conversion between common image and video formats.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Header />{children}<footer><div className="page-width">Pngyu Tools · temporary files are removed automatically</div></footer></body></html>;
}
