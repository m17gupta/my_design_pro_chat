import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import ReduxProvider from "@/store/ReduxProvider";
import "./globals.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Luna — Dzinly Design Intake",
  description:
    "Guided landscape design intake with Luna, your virtual AI designer — gather photos, files, goals, and preferences for designer Brooke Edwards.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head />
      <body className="min-h-full flex flex-col">
        <ReduxProvider>{children}</ReduxProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            error: {
              style: {
                background: "#ef4444",
                color: "#fff",
                fontSize: "13.5px",
                fontWeight: 500,
              },
              iconTheme: { primary: "#fff", secondary: "#ef4444" },
            },
          }}
        />
      </body>
    </html>
  );
}
