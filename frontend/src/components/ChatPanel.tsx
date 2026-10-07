"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, User } from "lucide-react";
import { Language, translations } from "../lib/translations";
import { soundFX } from "../lib/audio";

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  myPlayerId: string;
  onSendMessage: (msg: string) => boolean;
  lang: Language;
  isOpen: boolean;
  onToggle: () => void;
  unreadCount?: number;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  myPlayerId,
  onSendMessage,
  lang,
  isOpen,
  onToggle,
  unreadCount = 0,
}) => {
  const [inputMsg, setInputMsg] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMsg.trim();
    if (!text) return;
    soundFX.playClick();
    const ok = onSendMessage(text);
    if (ok) {
      setInputMsg("");
    }
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts * 1000);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      {/* Floating Chat Trigger Button (Mobile / Desktop Collapsed) */}
      <button
        type="button"
        onClick={onToggle}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-amber-500 via-rose-600 to-amber-600 text-white font-bold text-xs sm:text-sm shadow-2xl border border-amber-300 active:scale-95 transition-all hover:brightness-110"
        aria-label="Open Chat"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="font-semibold">{lang === "ne" ? "गफगाफ (Chat)" : "Chat"}</span>
        {unreadCount > 0 && !isOpen && (
          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat Drawer / Side Modal */}
      {isOpen && (
        <div className="fixed bottom-16 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 max-h-[500px] h-[75vh] flex flex-col bg-slate-900/95 backdrop-blur-md border-2 border-amber-500/50 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                  {lang === "ne" ? "लाइभ गफगाफ" : "Live Room Chat"}
                </h3>
                <span className="text-[10px] text-slate-400 block -mt-0.5">
                  {lang === "ne" ? "सामूहिक सन्देश" : "Real-time player chat"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggle}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-950/60">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs">
                <User className="w-8 h-8 mb-2 text-slate-600 opacity-60" />
                <p>
                  {lang === "ne"
                    ? "कुनै सन्देश छैन। साथीलाई अभिवादन पठाउनुहोस्!"
                    : "No messages yet. Send a greeting to your opponent!"}
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === myPlayerId;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-bold text-slate-400">
                        {isMe ? `${msg.sender_name} (You)` : msg.sender_name}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>

                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs font-medium break-words leading-relaxed shadow ${
                        isMe
                          ? "bg-gradient-to-r from-amber-500 via-amber-600 to-rose-600 text-white rounded-tr-none border border-amber-400/40"
                          : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <form onSubmit={handleSend} className="p-2.5 bg-slate-950 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder={lang === "ne" ? "सन्देश लेख्नुहोस्..." : "Type a message..."}
              maxLength={200}
              className="flex-1 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!inputMsg.trim()}
              className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
