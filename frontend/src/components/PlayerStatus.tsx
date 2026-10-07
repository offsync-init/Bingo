"use client";

import React from "react";
import { Check, Crown, Flag, Hourglass } from "lucide-react";
import { PlayerInfo } from "../types/game";
import { Language, translations } from "../lib/translations";

interface PlayerStatusProps {
  player?: PlayerInfo | null;
  connected: boolean;
  lang: Language;
  compact?: boolean;
}

export const PlayerStatus: React.FC<PlayerStatusProps> = ({
  player,
  connected,
  lang,
  compact = false,
}) => {
  const t = translations[lang];
  const forfeited = Boolean(player?.is_forfeited);
  const ready = Boolean(player?.ready);
  const isLeader = Boolean(player?.is_leader);

  return (
    <div className={`flex items-center ${compact ? "gap-1.5 flex-wrap" : "gap-2 flex-wrap"}`}>
      <span
        className="inline-flex items-center gap-1 text-[10px] text-slate-400"
        title={connected ? t.connected : t.connDisconnected}
      >
        <span
          aria-hidden
          className={`inline-block rounded-full ${compact ? "w-1.5 h-1.5" : "w-2 h-2"} ${
            connected ? "bg-emerald-400" : "bg-slate-500"
          }`}
        />
        <span>{connected ? t.connectedShort : t.disconnectedShort}</span>
      </span>

      {player && !forfeited && (
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
            ready
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
          }`}
        >
          {ready ? <Check className="w-3 h-3" /> : <Hourglass className="w-3 h-3" />}
          <span>{ready ? t.ready : t.notReady}</span>
        </span>
      )}

      {isLeader && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50">
          <Crown className="w-3 h-3 text-amber-400" />
          <span>{t.roomLeader}</span>
        </span>
      )}

      {forfeited && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50">
          <Flag className="w-3 h-3" />
          <span>{t.forfeited}</span>
        </span>
      )}
    </div>
  );
};
