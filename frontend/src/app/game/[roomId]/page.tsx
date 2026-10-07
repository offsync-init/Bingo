"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default function GamePage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId.toUpperCase();

  useEffect(() => {
    router.replace(`/room/${roomId}`);
  }, [roomId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
        <span className="text-sm font-medium">Entering Room {roomId}...</span>
      </div>
    </div>
  );
}
