import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ApiProvider } from "@/components/providers/ApiProvider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Face Media Sharing",
  description: "Share and organize photos with face recognition",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <ApiProvider>
            {children}
            <Toaster />
          </ApiProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
