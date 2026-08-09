import { useState } from "react";
import { useNavigate } from "react-router";
import { Globe2, Play, FolderOpen, Plus, Loader2, ChevronRight } from "lucide-react";
import { trpc } from "@/providers/trpc";

export default function StartMenu() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"menu" | "new" | "load">("menu");
  const [worldName, setWorldName] = useState("");

  const worldsQuery = trpc.world.list.useQuery(undefined, { enabled: mode === "load" });
  const lastWorldQuery = trpc.world.list.useQuery();
  const createMutation = trpc.world.create.useMutation({
    onSuccess: (world) => {
      if (world) navigate(`/world/${world.id}`);
    },
  });

  const continueWorld = lastWorldQuery.data?.[0];

  const menuButton =
    "group flex w-72 items-center justify-between rounded-lg border border-slate-700/70 bg-slate-800/40 px-5 py-3.5 text-left text-slate-200 transition hover:border-sky-400/60 hover:bg-sky-400/10 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#070d1a] px-4">
      {/* backdrop decoration */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.15),transparent_60%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <Globe2 size={44} className="mb-4 text-sky-400" />
        <h1 className="text-4xl font-black tracking-tight text-slate-100">
          WORLD<span className="text-sky-400">LINE</span>
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-slate-400">
          A living map of power — people, parties, companies, and the ties that bind them.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          {mode === "menu" && (
            <>
              <button className={menuButton} onClick={() => setMode("new")}>
                <span className="flex items-center gap-3">
                  <Plus size={18} /> New World
                </span>
                <ChevronRight size={16} className="opacity-40 group-hover:opacity-100" />
              </button>
              <button
                className={menuButton}
                disabled={!continueWorld}
                onClick={() => continueWorld && navigate(`/world/${continueWorld.id}`)}
              >
                <span className="flex items-center gap-3">
                  <Play size={18} /> Continue
                  {continueWorld && (
                    <span className="text-xs text-slate-500">({continueWorld.name})</span>
                  )}
                </span>
                <ChevronRight size={16} className="opacity-40 group-hover:opacity-100" />
              </button>
              <button className={menuButton} onClick={() => setMode("load")}>
                <span className="flex items-center gap-3">
                  <FolderOpen size={18} /> Load World
                </span>
                <ChevronRight size={16} className="opacity-40 group-hover:opacity-100" />
              </button>
            </>
          )}

          {mode === "new" && (
            <div className="flex w-72 flex-col gap-3">
              <input
                autoFocus
                value={worldName}
                onChange={(e) => setWorldName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && worldName.trim()) {
                    createMutation.mutate({ name: worldName.trim() });
                  }
                }}
                placeholder="Name your world…"
                className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-sky-400"
              />
              <button
                className={menuButton}
                disabled={!worldName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ name: worldName.trim() })}
              >
                <span className="flex items-center gap-3">
                  {createMutation.isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Plus size={18} />
                  )}
                  Create & Enter
                </span>
              </button>
              <BackButton onClick={() => setMode("menu")} />
            </div>
          )}

          {mode === "load" && (
            <div className="flex w-72 flex-col gap-2">
              {worldsQuery.isLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="animate-spin text-slate-400" />
                </div>
              )}
              {worldsQuery.data?.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-500">
                  No saved worlds yet.
                </p>
              )}
              {worldsQuery.data?.map((w) => (
                <button
                  key={w.id}
                  className={menuButton}
                  onClick={() => navigate(`/world/${w.id}`)}
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{w.name}</span>
                    <span className="text-xs text-slate-500">
                      Last opened {new Date(w.updatedAt).toLocaleDateString()}
                    </span>
                  </span>
                  <ChevronRight size={16} className="opacity-40 group-hover:opacity-100" />
                </button>
              ))}
              <BackButton onClick={() => setMode("menu")} />
            </div>
          )}
        </div>
      </div>

      <p className="absolute bottom-6 text-xs text-slate-600">
        Search is powered by KIMI AI · sources are public record
      </p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-1 text-center text-xs text-slate-500 transition hover:text-slate-300"
    >
      ← Back
    </button>
  );
}
