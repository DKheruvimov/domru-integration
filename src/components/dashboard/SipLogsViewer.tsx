import React, { useState, useEffect } from "react";
import { Terminal, RefreshCw } from "lucide-react";

interface SipLog {
  timestamp: number;
  message: string;
  type: "info" | "error";
}

export default function SipLogsViewer() {
  const [logs, setLogs] = useState<SipLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/domru/sip/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <details className="group mt-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900/10 overflow-hidden animate-fade-in" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) fetchLogs(); }}>
      <summary className="px-4 py-2.5 text-[10px] font-bold tracking-wider text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer flex items-center justify-between font-sans select-none list-none">
        <span className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-emerald-500" />
          SIP-логирование (Dev)
        </span>
        <button
          onClick={(e) => { e.preventDefault(); fetchLogs(); }}
          className="text-[9px] bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-500 dark:text-zinc-400 font-mono hover:text-white transition flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </summary>
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-[11px] leading-relaxed select-text shadow-inner">
        <div
          className="bg-white dark:bg-black/30 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 h-48 overflow-y-auto space-y-1 text-zinc-600 dark:text-zinc-400 font-mono text-[10px]"
        >
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index} className={`whitespace-pre-wrap ${log.type === "error" ? "text-red-500" : ""}`}>
                <span className="text-zinc-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
              </div>
            ))
          ) : (
            <div className="text-center text-zinc-400 dark:text-zinc-600 mt-16">
              Нет логов SIP
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
