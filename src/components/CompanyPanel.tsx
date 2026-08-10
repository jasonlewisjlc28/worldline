import { useMemo, useState } from "react";
import { X, Building2, Users, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { CompanyDto, PersonDto } from "@contracts/types";

export type CompanyPanelProps = {
  worldId: number;
  companyName: string;
  persons: PersonDto[];
  onClose: () => void;
  onSelectPerson: (id: number) => void;
};

const OWNERSHIP_LABELS: Record<string, string> = {
  state: "State-owned",
  partial: "Partial SOE",
  private: "Private",
};

function OwnershipTag({ ownership }: { ownership?: CompanyDto["ownership"] }) {
  if (!ownership) return null;
  const styles =
    ownership === "state"
      ? "border-red-400/40 bg-red-400/10 text-red-300"
      : ownership === "partial"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
        : "border-emerald-300/60 bg-emerald-300/15 text-emerald-200";
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles}`}
    >
      {OWNERSHIP_LABELS[ownership]}
    </span>
  );
}

type Affiliation = { person: PersonDto; entry: CompanyDto };

function norm(s: string) {
  return s.trim().toLowerCase();
}

function PersonEntry({
  worldId,
  companyName,
  affiliation,
  onSelectPerson,
}: {
  worldId: number;
  companyName: string;
  affiliation: Affiliation;
  onSelectPerson: (id: number) => void;
}) {
  const { person, entry } = affiliation;
  const [analysis, setAnalysis] = useState<string | null>(null);
  const analyzeMutation = trpc.world.analyzeCompany.useMutation({
    onSuccess: (r) => setAnalysis(r.analysis),
  });

  return (
    <li className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3">
      <button
        onClick={() => onSelectPerson(person.id)}
        className="text-left transition hover:text-sky-300"
      >
        <p className="text-sm font-semibold text-slate-100">{person.name}</p>
        {person.title && (
          <p className="mt-0.5 text-xs text-amber-200/80">{person.title}</p>
        )}
      </button>

      {(entry.role || entry.timeline) && (
        <p className="mt-1.5 text-xs font-medium text-sky-300/90">
          {entry.role}
          {entry.role && entry.timeline ? " · " : ""}
          {entry.timeline}
        </p>
      )}
      {entry.summary && (
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {entry.summary}
        </p>
      )}

      {analysis ? (
        <div className="mt-2 rounded-md border border-sky-400/25 bg-sky-400/5 p-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-sky-300">
            <Sparkles size={10} /> KIMI Analysis
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            {analysis}
          </p>
        </div>
      ) : (
        <button
          disabled={analyzeMutation.isPending}
          onClick={() =>
            analyzeMutation.mutate({
              worldId,
              personId: person.id,
              companyName,
            })
          }
          className="mt-2 flex items-center gap-1.5 rounded-md border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-300 transition hover:bg-sky-400/20 disabled:opacity-50"
        >
          {analyzeMutation.isPending ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Sparkles size={11} />
          )}
          {analyzeMutation.isPending ? "Analyzing…" : "Deep analysis"}
        </button>
      )}
      {analyzeMutation.isError && (
        <p className="mt-1 text-[11px] text-red-300">
          Analysis failed — try again.
        </p>
      )}
    </li>
  );
}

export default function CompanyPanel({
  worldId,
  companyName,
  persons,
  onClose,
  onSelectPerson,
}: CompanyPanelProps) {
  const affiliations = useMemo<Affiliation[]>(() => {
    const out: Affiliation[] = [];
    for (const p of persons) {
      const entry = (p.companies ?? []).find(
        (c) => c?.name && norm(c.name) === norm(companyName)
      );
      if (entry) out.push({ person: p, entry });
    }
    return out.sort((a, b) => a.person.name.localeCompare(b.person.name));
  }, [persons, companyName]);

  const headerSummary = affiliations.find((a) => a.entry.summary)?.entry.summary ?? "";
  const ownership = affiliations.find((a) => a.entry.ownership)?.entry.ownership;

  return (
    <aside className="pointer-events-auto absolute right-0 top-0 z-30 flex h-full w-full max-w-md flex-col border-l border-slate-700/60 bg-[#0c1526]/97 shadow-2xl backdrop-blur">
      {/* header */}
      <div className="border-b border-slate-700/60 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100">
              <Building2 size={18} className="text-sky-400" />
              {companyName}
            </h2>
            {ownership && (
              <div className="mt-2">
                <OwnershipTag ownership={ownership} />
              </div>
            )}
            {headerSummary && (
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {headerSummary}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-700/50 hover:text-slate-100"
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* people */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="flex items-center gap-2 border-b border-slate-700/60 pb-2">
          <span className="text-sky-400">
            <Users size={14} />
          </span>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">
            Affiliated People
          </h3>
          <span className="ml-auto rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
            {affiliations.length}
          </span>
        </div>
        {affiliations.length === 0 ? (
          <p className="text-xs italic text-slate-500">
            No one on this map has a documented affiliation with {companyName}{" "}
            yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {affiliations.map((a) => (
              <PersonEntry
                key={a.person.id}
                worldId={worldId}
                companyName={companyName}
                affiliation={a}
                onSelectPerson={onSelectPerson}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
