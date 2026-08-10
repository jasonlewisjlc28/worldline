import { useState } from "react";
import { Search, Loader2, Sparkles } from "lucide-react";

export type SearchBarProps = {
  busy: boolean;
  aiReady: boolean;
  onSearch: (query: string) => void;
  notice: string | null;
};

export default function SearchBar({ busy, aiReady, onSearch, notice }: SearchBarProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const q = value.trim();
    if (!q || busy) return;
    onSearch(q);
    setValue("");
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 pb-6">
      {notice && (
        <div className="pointer-events-auto max-w-lg rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-[#92400e] backdrop-blur">
          {notice}
        </div>
      )}
      <div className="pointer-events-auto flex w-full max-w-xl items-center gap-2 rounded-full border border-[#d9b3b3]/70 bg-white/92 px-4 py-2.5 shadow-2xl backdrop-blur transition focus-within:border-sky-400/70">
        {busy ? (
          <Loader2 size={18} className="shrink-0 animate-spin text-[#b91c1c]" />
        ) : (
          <Search size={18} className="shrink-0 text-stone-500" />
        )}
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          disabled={busy}
          placeholder={
            aiReady
              ? "Search a political figure — e.g. Vladimir Putin…"
              : "AI key not configured on the server yet…"
          }
          className="flex-1 bg-transparent text-sm text-stone-900 placeholder-stone-400 outline-none disabled:opacity-60"
        />
        <span className="hidden items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-[#991b1b] sm:flex">
          <Sparkles size={10} /> KIMI AI
        </span>
        <button
          onClick={submit}
          disabled={busy || !value.trim()}
          className="shrink-0 rounded-full bg-[#b91c1c] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#991b1b] disabled:opacity-40"
        >
          {busy ? "Adding…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
