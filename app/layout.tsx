// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "HRMS",
  description: "Attendance, leave and payroll",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" enableSystem defaultTheme="dark">
          {/*
            Pages render on the server with their data already loaded, so
            there is no in-page spinner. What the reader needs instead is
            confirmation that their click registered while the next page is
            being produced — that is this bar's whole job.
          */}
          <NextTopLoader
            color="hsl(224 84% 62%)"
            height={2}
            shadow={false}
            showSpinner={false}
            speed={250}
          />
          <Toaster position="top-right" richColors closeButton />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
