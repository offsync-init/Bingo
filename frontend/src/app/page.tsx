"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PlusCircle, LogIn, Sparkles, ShieldCheck, Flame, Users, Trophy, Clock } from "lucide-react";
import { Header } from "../components/Header";
import { DhakaBorder, NepaliMandalaBadge, NepalSunMoonIcon } from "../components/DhakaPattern";
import { Language, translations } from "../lib/translations";

export default function HomePage() {
  const [lang, setLang] = useState<Language>("en");
  const [devanagariNumerals, setDevanagariNumerals] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const t = translations[lang];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header
        lang={lang}
        onToggleLang={() => setLang((prev) => (prev === "en" ? "ne" : "en"))}
        devanagariNumerals={devanagariNumerals}
        onToggleNumerals={() => setDevanagariNumerals((prev) => !prev)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
      />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 flex flex-col items-center justify-center text-center">
        {/* Hero Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-semibold mb-6 shadow-md animate-in fade-in zoom-in duration-300">
          <NepaliMandalaBadge size={18} />
          <span>{lang === "ne" ? "नेपाली मौलिक ढाका शैली" : "Authentic Nepali Dhaka Visuals"}</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-400 to-amber-500 font-serif mb-3">
          {t.title}
        </h1>

        <p className="text-lg sm:text-xl font-medium text-slate-300 max-w-2xl mb-2">
          {t.subtitle}
        </p>

        <p className="text-sm text-amber-200/80 max-w-lg mb-8">
          {t.tagline}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mb-12">
          <Link
            href="/create"
            className="w-full sm:w-1/2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 hover:from-rose-600 hover:to-amber-500 text-white font-black text-base shadow-xl shadow-rose-950/60 transition-all hover:scale-105 active:scale-95 border border-amber-400/40 flex items-center justify-center gap-2 group"
          >
            <PlusCircle className="w-5 h-5 text-amber-300 group-hover:rotate-90 transition-transform duration-300" />
            <span>{t.createRoom}</span>
          </Link>

          <Link
            href="/join"
            className="w-full sm:w-1/2 py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-extrabold text-base shadow-lg transition-all hover:scale-105 active:scale-95 border border-amber-500/40 hover:border-amber-400 flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5 text-amber-400" />
            <span>{t.joinRoom}</span>
          </Link>
        </div>

        {/* Decorative Dhaka Divider */}
        <div className="w-full max-w-md my-4">
          <DhakaBorder />
        </div>

        {/* Game Rules Card */}
        <div className="w-full max-w-2xl bg-slate-900/80 border border-amber-500/30 rounded-2xl p-6 sm:p-8 text-left shadow-2xl relative overflow-hidden mt-4">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <NepaliMandalaBadge size={140} />
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-black text-amber-300 tracking-wide font-serif uppercase">
              {t.rulesHeader}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-300">
            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-slate-800 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
                1
              </span>
              <span>{t.rule1}</span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-slate-800 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
                2
              </span>
              <span>{t.rule2}</span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-slate-800 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
                3
              </span>
              <span>
                <strong className="text-amber-300 font-bold">{t.rule3}</strong>
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-slate-800 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
                4
              </span>
              <span>{t.rule4}</span>
            </div>

            <div className="flex items-start gap-2.5 sm:col-span-2">
              <span className="w-6 h-6 rounded-full bg-slate-800 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
                5
              </span>
              <span>{t.rule5}</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 border-t border-slate-900 bg-slate-950">
        <DhakaBorder className="mb-3 opacity-50" />
        <p>Nepali Bingo 1v1 &bull; Real-Time Multiplayer Web Game &bull; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
