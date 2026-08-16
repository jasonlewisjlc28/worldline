import { useMemo, useState } from "react";
import { X, Plus, Building2, Users, Flag, MapPin, Loader2, Check } from "lucide-react";
import type { AlignmentDto, ConnectionDto, PersonDto } from "@contracts/types";

export type PersonPanelProps = {
  person: PersonDto;
  allPersons: PersonDto[];
  connections: ConnectionDto[];
  busyName: string | null;
  onClose: () => void;
  onAddSuggestion: (suggestionName: string) => void;
  onSelectPerson: (id: number) => void;
  onSelectCompany: (name: string) => void;
  onRemove: (personId: number) => void;
  onHoverPerson: (id: number | null) => void;
};

type TabKey = "people" | "companies" | "parties";

export default function PersonPanel({
  person,
  allPersons,
  connections,
  busyName,
  onClose,
  onAddSuggestion,
  onSelectPerson,
  onSelectCompany,
  onRemove,
  onHoverPerson,
}: PersonPanelProps) {
  const [tab, setTab] = useState<TabKey>("people");

  const personById = useMemo(
    () => new Map(allPersons.map((p) => [p.id, p])),
    [allPersons]
  );

  const myConnections = useMemo(() => {
    return connections
      .filter((c) => c.personAId === person.id || c.personBId === person.id)
      .map((c) => {
        const otherId = c.personAId === person.id ? c.personBId : c.personAId;
        const other = personById.get(otherId);
        return other ? { connection: c, other } : null;
      })
      .filter((x): x is { connection: ConnectionDto; other: PersonDto } => x !== null);
  }, [connections, person.id, personById]);

  const pendingSuggestions = person.suggestions.filter((s) => s.status === "pending");

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "people", label: "People", icon: <Users size={15} /> },
    { key: "companies", label: "Career Path", icon: <Building2 size={15} /> },
    { key: "parties", label: "Political Party", icon: <Flag size={15} /> },
  ];

  return (
    <aside className="pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-full max-w-md flex-col border-l border-[#e3c4c4] bg-white/95 shadow-2xl backdrop-blur">
      <div className="flex-1 overflow-y-auto">
      {/* header */}
      <div className="border-b border-[#e3c4c4] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-stone-900">{person.name}</h2>
            <p className="mt-1 text-sm text-[#92400e]">{person.title}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
              <MapPin size={12} /> {person.country}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-500 transition hover:bg-[#f3dede] hover:text-stone-900"
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-stone-700">{person.summary}</p>
      </div>

      {/* tabs */}
      <div className="flex border-b border-[#e3c4c4]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition ${
              tab === t.key
                ? "border-b-2 border-sky-400 bg-[#b91c1c]/10 text-[#b91c1c]"
                : "text-stone-500 hover:bg-[#f3dede]/30 hover:text-stone-800"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* body */}
      <div className="p-4">
        {tab === "people" && (
          <div className="space-y-4">
            {myConnections.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
                  On the map ({myConnections.length})
                </h3>
                <ul className="space-y-2">
                  {myConnections.map(({ connection, other }) => (
                    <li
                      key={connection.id}
                      className="rounded-lg border border-[#b91c1c]/25 bg-[#b91c1c]/5 p-3 transition hover:border-[#b91c1c]/50"
                      onMouseEnter={() => onHoverPerson(other.id)}
                      onMouseLeave={() => onHoverPerson(null)}
                    >
                      <button
                        onClick={() => onSelectPerson(other.id)}
                        className="text-left text-sm font-semibold text-[#991b1b] hover:text-[#7f1d1d]"
                      >
                        {other.name}
                        <span className="ml-2 text-xs font-normal text-stone-500">
                          {other.title}
                        </span>
                      </button>
                      <p className="mt-1.5 text-xs leading-relaxed text-stone-700">
                        {connection.summary}
                      </p>
                      {connection.alignment && (
                        <AlignmentGauge alignment={connection.alignment} />
                      )}
                      {connection.tags && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {connection.tags.split(",").map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-[#f3dede] px-2 py-0.5 text-[10px] uppercase tracking-wide text-stone-700"
                            >
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {pendingSuggestions.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Suggested by AI ({pendingSuggestions.length})
                </h3>
                <ul className="space-y-2">
                  {pendingSuggestions.map((s) => {
                    const busy = busyName === s.name;
                    return (
                      <li
                        key={s.name}
                        className="flex items-start justify-between gap-3 rounded-lg border border-[#e3c4c4] bg-[#f9ecec] p-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-stone-800">{s.name}</p>
                          <p className="mt-1 text-xs leading-relaxed text-stone-500">
                            {s.reason}
                          </p>
                        </div>
                        <button
                          disabled={busyName !== null}
                          onClick={() => onAddSuggestion(s.name)}
                          className="mt-0.5 flex shrink-0 items-center gap-1 rounded-md bg-[#b91c1c] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#991b1b] disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Plus size={13} />
                          )}
                          Add
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {myConnections.length === 0 && pendingSuggestions.length === 0 && (
              <p className="py-8 text-center text-sm text-stone-400">
                No connections or suggestions yet.
              </p>
            )}
          </div>
        )}

        {tab === "companies" && (
          <EntityList
            empty="No documented career entries."
            items={person.companies}
            onSelect={onSelectCompany}
          />
        )}
        {tab === "parties" && (
          <EntityList
            empty="No documented party memberships."
            items={person.parties}
          />
        )}
      </div>

      {/* footer */}
      <div className="border-t border-[#e3c4c4] p-3">
        <button
          onClick={() => onRemove(person.id)}
          className="w-full rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-500/20"
        >
          Remove from world
        </button>
      </div>
      </div>
    </aside>
  );
}


function alignmentLabel(overall: number): { text: string; color: string; barColor: string } {
  if (overall >= 8) return { text: "Deeply Aligned", color: "text-emerald-700", barColor: "bg-emerald-600" };
  if (overall >= 6) return { text: "Aligned", color: "text-lime-700", barColor: "bg-lime-600" };
  if (overall >= 4.5) return { text: "Transactional", color: "text-amber-700", barColor: "bg-amber-500" };
  if (overall >= 2.5) return { text: "Divergent", color: "text-orange-700", barColor: "bg-orange-500" };
  if (overall >= 1) return { text: "Adversarial", color: "text-red-700", barColor: "bg-red-500" };
  return { text: "At War", color: "text-red-900", barColor: "bg-red-800" };
}

const DIMENSION_LABELS: [keyof Pick<AlignmentDto, "strategic" | "financial" | "trust" | "ideological">, string, number][] = [
  ["strategic", "Strategic interests", 35],
  ["financial", "Financial interdependence", 25],
  ["trust", "Personal loyalty / trust", 20],
  ["ideological", "Ideological alignment", 20],
];

function AlignmentGauge({ alignment }: { alignment: AlignmentDto }) {
  const [expanded, setExpanded] = useState(false);
  const label = alignmentLabel(alignment.overall);
  const pct = Math.max(0, Math.min(100, (alignment.overall / 10) * 100));
  return (
    <div className="mt-2 rounded-md border border-[#e3c4c4] bg-[#f9ecec] p-2.5">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className={`text-[11px] font-bold ${label.color}`}>
          {label.text} · {alignment.overall.toFixed(1)}/10
          {alignment.cap !== undefined && alignment.cap < 10 && (
            <span className="ml-1 font-normal text-red-700">(capped)</span>
          )}
        </span>
        <span className="text-[10px] text-stone-400">
          {expanded ? "hide breakdown ▲" : "breakdown ▼"}
        </span>
      </button>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#f3dede]">
        <div className={`h-full rounded-full ${label.barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {expanded && (
        <ul className="mt-2 space-y-1.5 border-t border-[#e3c4c4] pt-2">
          {DIMENSION_LABELS.map(([key, name, weight]) => (
            <li key={key}>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold text-stone-700">
                  {name} <span className="font-normal text-stone-400">({weight}%)</span>
                </span>
                <span className="font-bold text-stone-800">{alignment[key]}/10</span>
              </div>
              {alignment.reasons?.[key] && (
                <p className="mt-0.5 text-[10px] leading-snug text-stone-400">
                  {alignment.reasons[key]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EntityList({
  items,
  empty,
  onSelect,
}: {
  items: {
    name: string;
    summary: string;
    role: string;
    timeline: string;
    ownership?: "state" | "partial" | "private";
  }[];
  empty: string;
  onSelect?: (name: string) => void;
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-stone-400">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={`${item.name}-${i}`}>
          <button
            type="button"
            onClick={onSelect ? () => onSelect(item.name) : undefined}
            className={`w-full rounded-lg border border-[#e3c4c4] bg-[#f9ecec] p-3 text-left ${
              onSelect
                ? "cursor-pointer transition hover:border-[#b91c1c]/50 hover:bg-[#b91c1c]/5"
                : "cursor-default"
            }`}
          >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-stone-800">{item.name}</p>
            {item.timeline && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#f3dede] px-2 py-0.5 text-[10px] text-stone-700">
                <Check size={10} /> {item.timeline}
              </span>
            )}
          </div>
          {item.ownership && (
            <div className="mt-1.5">
              <span
                className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  item.ownership === "state"
                    ? "border-red-300/60 bg-red-500/15 text-white"
                    : item.ownership === "partial"
                      ? "border-amber-300/60 bg-amber-500/15 text-white"
                      : "border-emerald-300/60 bg-emerald-300/15 text-white"
                }`}
              >
                {item.ownership === "state"
                  ? "State-owned"
                  : item.ownership === "partial"
                    ? "Partial SOE"
                    : "Private"}
              </span>
            </div>
          )}
          {item.role && (
            <p className="mt-0.5 text-xs font-medium text-[#92400e]/90">{item.role}</p>
          )}
          <p className="mt-1.5 text-xs leading-relaxed text-stone-500">{item.summary}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}
