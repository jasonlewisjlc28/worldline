import { useMemo, useState } from "react";
import { X, Link2, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { ConnectionDto, PersonDto } from "@contracts/types";

export type CreateConnectionDialogProps = {
  worldId: number;
  persons: PersonDto[];
  connections: ConnectionDto[];
  preselectedA?: number | null;
  onClose: () => void;
  onCreated: (aName: string, bName: string) => void;
};

export default function CreateConnectionDialog({
  worldId,
  persons,
  connections,
  preselectedA,
  onClose,
  onCreated,
}: CreateConnectionDialogProps) {
  const [aId, setAId] = useState<number | null>(preselectedA ?? null);
  const [bId, setBId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...persons].sort((x, y) => x.name.localeCompare(y.name)),
    [persons]
  );

  const tiedPairs = useMemo(() => {
    const s = new Set<string>();
    for (const c of connections) {
      s.add(`${Math.min(c.personAId, c.personBId)}-${Math.max(c.personAId, c.personBId)}`);
    }
    return s;
  }, [connections]);

  const alreadyTied =
    aId != null && bId != null
      ? tiedPairs.has(`${Math.min(aId, bId)}-${Math.max(aId, bId)}`)
      : false;

  const mutation = trpc.world.createConnection.useMutation({
    onSuccess: (_r, vars) => {
      const a = persons.find((p) => p.id === vars.personAId);
      const b = persons.find((p) => p.id === vars.personBId);
      onCreated(a?.name ?? "", b?.name ?? "");
      onClose();
    },
    onError: (e) => setError(e.message ?? "Failed to create the connection."),
  });

  const canSubmit =
    aId != null && bId != null && aId !== bId && !alreadyTied && !mutation.isPending;

  const selectCls =
    "w-full rounded-md border border-[#e3c4c4] bg-[#fdf3f3] px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#b91c1c]/60";

  return (
    <div className="pointer-events-auto absolute left-4 top-16 z-40 w-80 rounded-xl border border-[#e3c4c4] bg-white/95 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-[#e3c4c4] px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900">
          <Link2 size={15} className="text-[#b91c1c]" /> Create connection
        </h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-stone-500 transition hover:bg-[#f3dede] hover:text-stone-900"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-stone-500">
            First person
          </label>
          <select
            className={selectCls}
            value={aId ?? ""}
            onChange={(e) => setAId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select…</option>
            {sorted.map((p) => (
              <option key={p.id} value={p.id} disabled={p.id === bId}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-stone-500">
            Second person
          </label>
          <select
            className={selectCls}
            value={bId ?? ""}
            onChange={(e) => setBId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select…</option>
            {sorted.map((p) => {
              const tied =
                aId != null &&
                tiedPairs.has(`${Math.min(aId, p.id)}-${Math.max(aId, p.id)}`);
              return (
                <option key={p.id} value={p.id} disabled={p.id === aId || tied}>
                  {p.name}
                  {tied ? " (already connected)" : ""}
                </option>
              );
            })}
          </select>
        </div>

        {alreadyTied && (
          <p className="text-xs text-amber-700">
            These two already have a tie on the map.
          </p>
        )}
        {error && <p className="text-xs text-red-700">{error}</p>}

        <button
          disabled={!canSubmit}
          onClick={() => {
            if (aId == null || bId == null) return;
            setError(null);
            mutation.mutate({ worldId, personAId: aId, personBId: bId });
          }}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#b91c1c] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#991b1b] disabled:opacity-40"
        >
          {mutation.isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> KIMI AI is analyzing…
            </>
          ) : (
            <>
              <Link2 size={14} /> Create tie
            </>
          )}
        </button>
        <p className="text-[11px] leading-relaxed text-stone-400">
          KIMI AI will write the relationship analysis (shared interests,
          ideology, financial ties) for the new connection.
        </p>
      </div>
    </div>
  );
}
