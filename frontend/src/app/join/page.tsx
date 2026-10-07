"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, ArrowLeft, Loader2, User, KeyRound } from "lucide-react";
import { Header } from "../../components/Header";
import { DhakaBorder } from "../../components/DhakaPattern";
import { Language, translations } from "../../lib/translations";
import { getOrCreatePlayerId, getStoredPlayerName, setStoredPlayerName } from "../../lib/utils";

export default function JoinRoomPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [devanagariNumerals, setDevanagariNumerals] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const [roomCode, setRoomCode] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [phase, setPhase] = useState<"idle" | "validating" | "joining">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlayerName(getStoredPlayerName() || "Player 2");
  }, []);

  const t = translations[lang];
  const loading = phase !== "idle";

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError(lang === "ne" ? "कृपया कोठा कोड हाल्नुहोस्।" : "Please enter a room code.");
      return;
    }
    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      setError(lang === "ne" ? "कोठा कोड अमान्य छ।" : "That room code is not valid.");
      return;
    }

    setPhase("validating");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const playerId = getOrCreatePlayerId();
      const name = playerName.trim() || (lang === "ne" ? "खेलाडी २" : "Player 2");
      setStoredPlayerName(name);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://bingo-backend-e686.onrender.com";

      const lookup = await fetch(`${apiUrl}/api/rooms/${code}?player_id=${encodeURIComponent(playerId)}`, { signal: controller.signal });
      if (lookup.status === 404) {
        throw new Error(lang === "ne" ? "यो कोठा फेला परेन वा सकिएको छ।" : "This room does not exist or has expired.");
      }
      if (!lookup.ok) {
        throw new Error(lang === "ne" ? "कोठा जाँच गर्न सकिएन।" : "Unable to check this room. Please try again.");
      }
      const info = await lookup.json();
      if (info.is_full && !info.is_member) {
        throw new Error(lang === "ne" ? "यो कोठा पहिले नै भरिएको छ (अधिकतम २ खेलाडी)।" : "This room is already full (maximum 2 players).");
      }
      if (info.in_progress) {
        throw new Error(lang === "ne" ? "यो खेल पहिले नै सुरु भइसकेको छ।" : "This match has already started.");
      }

      setPhase("joining");
      const res = await fetch(`${apiUrl}/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: playerId,
          player_name: name,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detail = typeof errData.detail === "string" ? errData.detail : "Failed to join room";
        throw new Error(detail);
      }

      router.push(`/room/${code}`);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError(lang === "ne" ? "सम्पर्क समय सकियो। फेरि प्रयास गर्नुहोस्।" : "Connection timed out. Please try again.");
      } else {
        setError(err.message || (lang === "ne" ? "कोठामा प्रवेश गर्न सकिएन।" : "Could not join room"));
      }
      setPhase("idle");
    } finally {
      clearTimeout(timeout);
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
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-rose-700 p-2 flex items-center justify-center shadow-lg border border-amber-400/30">
                <LogIn className="w-6 h-6 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 font-serif mb-2">
              {t.joinRoom}
            </h1>

            <p className="text-xs text-center text-slate-400 mb-6">
              {lang === "ne"
                ? "साथीले दिएको ६-अंकीय कोठा कोड हालेर खेलमा सहभागी हुनुहोस्।"
                : "Enter the 6-character room code shared by your opponent to join the match."}
            </p>

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-rose-950/80 border border-rose-500/70 text-rose-200 text-xs text-center font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-amber-300/90 uppercase tracking-wider mb-1.5">
                  {t.roomCode}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 7K2P91"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 rounded-xl py-3 pl-10 pr-4 text-sm font-mono tracking-widest text-white uppercase placeholder-slate-500 outline-none transition-all"
                  />
                </div>
              </div>

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
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-rose-600 to-rose-700 hover:from-amber-500 hover:to-rose-600 text-white font-black text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-95 border border-amber-400/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{phase === "validating" ? t.validatingRoom : t.joiningRoom}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{t.joinRoom}</span>
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
