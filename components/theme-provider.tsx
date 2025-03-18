"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Initialize theme from localStorage when component mounts (client-side only)
  React.useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme && (savedTheme === "dark" || savedTheme === "light")) {
      const html = document.documentElement;
      html.classList.remove("light", "dark");
      html.classList.add(savedTheme);
    }
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
