"use client";

import { useState, useCallback } from "react";
import es from "@/i18n/es.json";
import en from "@/i18n/en.json";

const translations: Record<string, Record<string, string>> = { es, en };

export function useI18n() {
  const [lang, setLang] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lang") || "es";
    }
    return "es";
  });

  const t = useCallback(
    (key: string): string => {
      return translations[lang]?.[key] || translations["es"]?.[key] || key;
    },
    [lang]
  );

  const switchLang = useCallback((newLang: string) => {
    setLang(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("lang", newLang);
    }
  }, []);

  return { t, lang, switchLang };
}
