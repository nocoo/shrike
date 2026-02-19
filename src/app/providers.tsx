"use client";

import { ThemeProvider } from "next-themes";
import { LocaleProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
    >
      <LocaleProvider>
        {children}
        <Toaster position="bottom-center" duration={3000} />
      </LocaleProvider>
    </ThemeProvider>
  );
}
