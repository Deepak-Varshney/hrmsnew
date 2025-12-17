"use client";

import { useEffect } from "react";

export default function ThemeColorScript() {
  useEffect(() => {
    // Apply saved theme color on mount
    const saved = localStorage.getItem("theme-color");
    if (saved) {
      document.documentElement.setAttribute("data-theme-color", saved);
    } else {
      document.documentElement.setAttribute("data-theme-color", "default");
    }
  }, []);

  return null;
}

