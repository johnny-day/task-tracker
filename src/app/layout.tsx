import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./components/NavBar";
import Providers from "./components/Providers";

export const metadata: Metadata = {
  title: "TaskTracker",
  description:
    "Track tasks, calendar, and fitness goals with smart completion estimates",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg">
        <Providers>
          <NavBar />
          <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
