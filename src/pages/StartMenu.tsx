import { useState } from "react";
import { useNavigate } from "react-router";
import { Globe2, Play, FolderOpen, Plus, Loader2, ChevronRight, Trash2 } from "lucide-react";
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
  const utils = trpc.useUtils();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const deleteMutation = trpc.world.deleteWorld.useMutation({
    onSuccess: () => {
      setConfirmDeleteId(null);
      utils.world.list.invalidate();
    },
  });

  const continueWorld = lastWorldQuery.data?.[0];

  const menuButton =
    "group flex w-72 items-center justify-between rounded-lg border border-[#e3c4c4] bg-[#f9ecec] px-5 py-3.5 text-left text-stone-800 transition hover:border-[#b91c1c]/60 hover:bg-[#b91c1c]/10 hover:text-[#991b1b] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f6e2e2] px-4">
      {/* backdrop decoration */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.15),transparent_60%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <Globe2 size={44} className="mb-4 text-[#b91c1c]" />
        <h1 className="text-4xl font-black tracking-tight text-stone-900">
          WORLD<span className="text-[#b91c1c]">LINE</span>
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-stone-500">
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
                    <span className="text-xs text-stone-400">({continueWorld.name})</span>
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
                className="rounded-lg border border-[#e3c4c4] bg-[#fdf3f3] px-4 py-3 text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-[#b91c1c]"
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
                  <Loader2 className="animate-spin text-stone-500" />
                </div>
              )}
              {worldsQuery.data?.length === 0 && (
                <p className="py-4 text-center text-sm text-stone-400">
                  No saved worlds yet.
                </p>
              )}
              {worldsQuery.data?.map((w) => (
                <div key={w.id} className="relative">
                  <button
                    className={menuButton}
                    onClick={() => navigate(`/world/${w.id}`)}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{w.name}</span>
                      <span className="text-xs text-stone-400">
                        Last opened {new Date(w.updatedAt).toLocaleDateString()}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        role="button"
                        aria-label={`Delete ${w.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(w.id);
                        }}
                        className="rounded-md p-1.5 text-stone-400 opacity-0 transition hover:bg-red-500/15 hover:text-red-700 group-hover:opacity-100"
                      >
                        <Trash2 size={15} />
                      </span>
                      <ChevronRight size={16} className="opacity-40 group-hover:opacity-100" />
                    </span>
                  </button>
                  {confirmDeleteId === w.id && (
                    <div className="mt-1 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                      <p className="text-xs text-stone-700">
                        Delete <span className="font-semibold">{w.name}</span> and
                        everyone on it? This cannot be undone.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => deleteMutation.mutate({ worldId: w.id })}
                          disabled={deleteMutation.isPending}
                          className="flex-1 rounded-md bg-red-500/80 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-red-500 disabled:opacity-40"
                        >
                          {deleteMutation.isPending ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 rounded-md border border-[#d9b3b3] px-2 py-1.5 text-xs text-stone-700 transition hover:bg-[#f3dede]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <BackButton onClick={() => setMode("menu")} />
            </div>
          )}
        </div>
      </div>

      <p className="absolute bottom-6 text-xs text-stone-400">
        Search is powered by KIMI AI · sources are public record
      </p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-1 text-center text-xs text-stone-400 transition hover:text-stone-700"
    >
      ← Back
    </button>
  );
}
