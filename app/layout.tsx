import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCM Passport — Style Journey",
  description: "An AI-curated in-store style journey prototype",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
