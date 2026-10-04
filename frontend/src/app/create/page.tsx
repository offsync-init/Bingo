"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusCircle, ArrowLeft, Loader2, User } from "lucide-react";
import { Header } from "../../components/Header";
import { DhakaBorder, NepaliMandalaBadge } from "../../components/DhakaPattern";
import { Language, translations } from "../../lib/translations";
import { getOrCreatePlayerId, getStoredPlayerName, setStoredPlayerName } from "../../lib/utils";

export default function CreateRoomPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [devanagariNumerals, setDevanagariNumerals] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const [playerName, setPlayerName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlayerName(getStoredPlayerName() || "Player 1");
  }, []);

  const t = translations[lang];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const playerId = getOrCreatePlayerId();
      const name = playerName.trim() || (lang === "ne" ? "खेलाडी १" : "Player 1");
      setStoredPlayerName(name);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiUrl}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: playerId,
          player_name: name,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to create room");
      }

      const data = await res.json();
      router.push(`/room/${data.room_id}`);
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

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

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-12 flex flex-col justify-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold mb-6 transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.backToHome}</span>
        </Link>

        <div className="w-full bg-slate-900 border-2 border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden">
          <DhakaBorder />

          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-700 to-amber-600 p-2 flex items-center justify-center shadow-lg border border-amber-400/30">
                <PlusCircle className="w-6 h-6 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 font-serif mb-2">
              {t.createRoom}
            </h1>

            <p className="text-xs text-center text-slate-400 mb-6">
              {lang === "ne"
                ? "नयाँ कोठा सिर्जना गरी साथीसँग १v१ बिङ्गो खेल्नुहोस्।"
                : "Create a private match room and invite an opponent with a room code or link."}
            </p>

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-rose-950/80 border border-rose-500/70 text-rose-200 text-xs text-center font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-amber-300/90 uppercase tracking-wider mb-1.5">
                  {t.yourName}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder={t.enterYourName}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 hover:from-rose-600 hover:to-amber-500 text-white font-black text-sm shadow-xl shadow-rose-950/60 transition-all hover:scale-[1.02] active:scale-95 border border-amber-400/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{t.creatingRoom}</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>{t.createRoom}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <DhakaBorder />
        </div>
      </main>
    </div>
  );
}
