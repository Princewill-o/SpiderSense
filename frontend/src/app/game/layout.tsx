import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spider-Man Game - Spider-Sense AI",
  description: "Classic Spider-Man side-scrolling game",
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
