"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Palette, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type ThemeColor = 
  | "default" 
  | "violet" 
  | "rose" 
  | "rosegold" 
  | "emerald" 
  | "blue" 
  | "amber";

const themeColors: { name: ThemeColor; label: string; light: string; dark: string }[] = [
  { name: "default", label: "Default", light: "hsl(0, 0%, 9%)", dark: "hsl(0, 0%, 98%)" },
  { name: "violet", label: "Violet", light: "hsl(262, 83%, 58%)", dark: "hsl(263, 70%, 50%)" },
  { name: "rose", label: "Rose", light: "hsl(346, 77%, 50%)", dark: "hsl(346, 77%, 50%)" },
  { name: "rosegold", label: "Rose Gold", light: "hsl(25, 95%, 53%)", dark: "hsl(25, 95%, 53%)" },
  { name: "emerald", label: "Emerald", light: "hsl(142, 76%, 36%)", dark: "hsl(142, 71%, 45%)" },
  { name: "blue", label: "Blue", light: "hsl(221, 83%, 53%)", dark: "hsl(217, 91%, 60%)" },
  { name: "amber", label: "Amber", light: "hsl(38, 92%, 50%)", dark: "hsl(43, 96%, 56%)" },
];

export default function ThemeColorPicker() {
  const [selectedColor, setSelectedColor] = useState<ThemeColor>("default");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Load saved theme color from localStorage
    const saved = localStorage.getItem("theme-color") as ThemeColor;
    if (saved && themeColors.find(t => t.name === saved)) {
      setSelectedColor(saved);
      applyTheme(saved);
    } else {
      applyTheme("default");
    }
  }, []);

  const applyTheme = (color: ThemeColor) => {
    const root = document.documentElement;
    root.setAttribute("data-theme-color", color);
    localStorage.setItem("theme-color", color);
  };

  const handleColorSelect = (color: ThemeColor) => {
    setSelectedColor(color);
    applyTheme(color);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Change theme color">
          <Palette className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Theme Color</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-4">
          {themeColors.map((theme) => {
            const isSelected = selectedColor === theme.name;
            return (
              <button
                key={theme.name}
                onClick={() => handleColorSelect(theme.name)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105 hover:shadow-md ${
                  isSelected ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"
                }`}
                title={theme.label}
              >
                <div
                  className="w-12 h-12 rounded-full border-2 border-background shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${theme.light}, ${theme.dark})`,
                  }}
                />
                <span className="text-xs font-medium">{theme.label}</span>
                {isSelected && (
                  <Check className="absolute top-1 right-1 h-4 w-4 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

