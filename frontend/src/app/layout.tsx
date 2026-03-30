import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spider-Sense AI",
  description: "Real-time computer vision threat awareness — with great power comes great responsibility",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen spider-bg" style={{ color: "#e62429" }}>
        {children}
      </body>
    </html>
  );
}
