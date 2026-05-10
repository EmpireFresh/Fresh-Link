"use client"

import { useState, useEffect } from "react"
import { getLang, setLang, applyStoredLang, type AppLang } from "@/lib/lang"

interface Props {
  compact?: boolean
}

export default function LangSwitcher({ compact = false }: Props) {
  const [lang, setLangState] = useState<AppLang>("fr-ar")

  useEffect(() => {
    setLangState(getLang())
    applyStoredLang()
    const handler = (e: Event) => setLangState((e as CustomEvent<AppLang>).detail)
    window.addEventListener("fl_lang_change", handler)
    return () => window.removeEventListener("fl_lang_change", handler)
  }, [])

  function toggle(which: "fr" | "ar") {
    let next: AppLang
    if (lang === "fr-ar") {
      next = which === "fr" ? "ar" : "fr"
    } else if (lang === "fr") {
      next = which === "fr" ? "fr-ar" : "ar"
    } else {
      next = which === "ar" ? "fr-ar" : "fr"
    }
    setLang(next)
    setLangState(next)
  }

  const frOn = lang === "fr" || lang === "fr-ar"
  const arOn = lang === "ar" || lang === "fr-ar"

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 border border-slate-200">
        <button
          onClick={() => toggle("fr")}
          title="Français"
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${frOn ? "bg-white shadow-sm text-blue-700 border border-blue-200" : "text-slate-400 hover:text-slate-600"}`}>
          🇫🇷{!compact && <span>FR</span>}
        </button>
        <button
          onClick={() => toggle("ar")}
          title="العربية"
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${arOn ? "bg-white shadow-sm text-emerald-700 border border-emerald-200" : "text-slate-400 hover:text-slate-600"}`}>
          🇲🇦{!compact && <span>AR</span>}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 border border-slate-200">
      <button
        onClick={() => toggle("fr")}
        title="Français"
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${frOn ? "bg-white shadow-sm text-blue-700 border border-blue-200" : "text-slate-400 hover:text-slate-600"}`}>
        🇫🇷 <span>FR</span>
      </button>
      <button
        onClick={() => toggle("ar")}
        title="العربية"
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${arOn ? "bg-white shadow-sm text-emerald-700 border border-emerald-200" : "text-slate-400 hover:text-slate-600"}`}>
        🇲🇦 <span>AR</span>
      </button>
    </div>
  )
}
