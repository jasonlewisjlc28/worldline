import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowLeft, Building2, Users, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { CompanyDto, PersonDto } from "@contracts/types";

export type CompanyPanelProps = {
  worldId: number;
  companyName: string;
  persons: PersonDto[];
  onClose: () => void;
  onBack: () => void;
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
      ? "border-red-300/60 bg-red-500/15 text-white"
      : ownership === "partial"
        ? "border-amber-300/60 bg-amber-500/15 text-white"
        : "border-emerald-300/60 bg-emerald-300/15 text-white";
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
    <li className="rounded-lg border border-[#e3c4c4] bg-[#f9ecec] p-3">
      <button
        onClick={() => onSelectPerson(person.id)}
        className="text-left transition hover:text-[#b91c1c]"
      >
        <p className="text-sm font-semibold text-stone-900">{person.name}</p>
        {person.title && (
          <p className="mt-0.5 text-xs text-[#92400e]/90">{person.title}</p>
        )}
      </button>

      {(entry.role || entry.timeline) && (
        <p className="mt-1.5 text-xs font-medium text-[#b91c1c]/90">
          {entry.role}
          {entry.role && entry.timeline ? " · " : ""}
          {entry.timeline}
        </p>
      )}
      {entry.summary && (
        <p className="mt-1 text-xs leading-relaxed text-stone-500">
          {entry.summary}
        </p>
      )}

      {analysis ? (
        <div className="mt-2 rounded-md border border-[#b91c1c]/25 bg-[#b91c1c]/5 p-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#b91c1c]">
            <Sparkles size={10} /> KIMI Analysis
          </p>
          <p className="mt-1 text-xs leading-relaxed text-stone-700">
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
          className="mt-2 flex items-center gap-1.5 rounded-md border border-[#b91c1c]/30 bg-[#b91c1c]/10 px-2.5 py-1 text-[11px] font-medium text-[#b91c1c] transition hover:bg-[#b91c1c]/15 disabled:opacity-50"
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
        <p className="mt-1 text-[11px] text-red-700">
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
  onBack,
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

  // Render through a portal so no parent's backdrop-filter can demote this
  // panel in the stacking order — that was making it open UNDER the country
  // panel (invisible until the country panel was closed).
  return createPortal(
    <aside className="pointer-events-auto fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[#e3c4c4] bg-white shadow-2xl">
      {/* header */}
      <div className="border-b border-[#e3c4c4] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-stone-900">
              <Building2 size={18} className="text-[#b91c1c]" />
              {companyName}
            </h2>
            {ownership && (
              <div className="mt-2">
                <OwnershipTag ownership={ownership} />
              </div>
            )}
            {headerSummary && (
              <p className="mt-2 text-xs leading-relaxed text-stone-500">
                {headerSummary}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={onBack}
              className="rounded-md p-1.5 text-stone-500 transition hover:bg-[#f3dede] hover:text-stone-900"
              aria-label="Back to previous panel"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-stone-500 transition hover:bg-[#f3dede] hover:text-stone-900"
              aria-label="Close panel"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* people */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="flex items-center gap-2 border-b border-[#e3c4c4] pb-2">
          <span className="text-[#b91c1c]">
            <Users size={14} />
          </span>
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-700">
            Affiliated People
          </h3>
          <span className="ml-auto rounded-full bg-[#f3dede] px-2 py-0.5 text-[10px] font-semibold text-stone-700">
            {affiliations.length}
          </span>
        </div>
        {affiliations.length === 0 ? (
          <p className="text-xs italic text-stone-400">
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
    </aside>,
    document.body
  );
}
