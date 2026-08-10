import { useMemo, useState } from "react";
import { X, Plus, Building2, Users, Flag, MapPin, Loader2, Check } from "lucide-react";
import type { ConnectionDto, PersonDto } from "@contracts/types";

export type PersonPanelProps = {
  person: PersonDto;
  allPersons: PersonDto[];
  connections: ConnectionDto[];
  busyName: string | null;
  onClose: () => void;
  onAddSuggestion: (suggestionName: string) => void;
  onSelectPerson: (id: number) => void;
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
    { key: "companies", label: "Companies", icon: <Building2 size={15} /> },
    { key: "parties", label: "Political Party", icon: <Flag size={15} /> },
  ];

  return (
    <aside className="pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-full max-w-md flex-col border-l border-slate-700/60 bg-[#0c1526]/95 shadow-2xl backdrop-blur">
      {/* header */}
      <div className="border-b border-slate-700/60 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{person.name}</h2>
            <p className="mt-1 text-sm text-amber-200/90">{person.title}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <MapPin size={12} /> {person.country}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-700/50 hover:text-slate-100"
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{person.summary}</p>
      </div>

      {/* relationship digest — intelligence-style, shown when connections exist */}
      {myConnections.length > 0 && (
        <div className="border-b border-slate-700/60 bg-violet-500/5 px-5 py-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300/80">
            ◈ Relationship Assessment
          </p>
          <ul className="space-y-2">
            {myConnections.map(({ connection, other }) => (
              <li key={connection.id} className="text-xs leading-relaxed">
                <button
                  onClick={() => onSelectPerson(other.id)}
                  className="font-semibold text-violet-300 hover:text-violet-200"
                >
                  {other.name}
                </button>
                <span className="text-slate-400"> — {connection.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* tabs */}
      <div className="flex border-b border-slate-700/60">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition ${
              tab === t.key
                ? "border-b-2 border-sky-400 bg-sky-400/10 text-sky-300"
                : "text-slate-400 hover:bg-slate-700/30 hover:text-slate-200"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "people" && (
          <div className="space-y-4">
            {myConnections.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  On the map ({myConnections.length})
                </h3>
                <ul className="space-y-2">
                  {myConnections.map(({ connection, other }) => (
                    <li
                      key={connection.id}
                      className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3 transition hover:border-violet-400/50"
                      onMouseEnter={() => onHoverPerson(other.id)}
                      onMouseLeave={() => onHoverPerson(null)}
                    >
                      <button
                        onClick={() => onSelectPerson(other.id)}
                        className="text-left text-sm font-semibold text-violet-300 hover:text-violet-200"
                      >
                        {other.name}
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {other.title}
                        </span>
                      </button>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                        {connection.summary}
                      </p>
                      {connection.tags && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {connection.tags.split(",").map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300"
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
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Suggested by AI ({pendingSuggestions.length})
                </h3>
                <ul className="space-y-2">
                  {pendingSuggestions.map((s) => {
                    const busy = busyName === s.name;
                    return (
                      <li
                        key={s.name}
                        className="flex items-start justify-between gap-3 rounded-lg border border-slate-700/60 bg-slate-800/40 p-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{s.name}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-400">
                            {s.reason}
                          </p>
                        </div>
                        <button
                          disabled={busyName !== null}
                          onClick={() => onAddSuggestion(s.name)}
                          className="mt-0.5 flex shrink-0 items-center gap-1 rounded-md bg-sky-500/90 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-sky-400 disabled:opacity-40"
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
              <p className="py-8 text-center text-sm text-slate-500">
                No connections or suggestions yet.
              </p>
            )}
          </div>
        )}

        {tab === "companies" && (
          <EntityList
            empty="No documented company involvements."
            items={person.companies}
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
      <div className="border-t border-slate-700/60 p-3">
        <button
          onClick={() => onRemove(person.id)}
          className="w-full rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
        >
          Remove from world
        </button>
      </div>
    </aside>
  );
}

function EntityList({
  items,
  empty,
}: {
  items: { name: string; summary: string; role: string; timeline: string }[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`${item.name}-${i}`}
          className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-200">{item.name}</p>
            {item.timeline && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-300">
                <Check size={10} /> {item.timeline}
              </span>
            )}
          </div>
          {item.role && (
            <p className="mt-0.5 text-xs font-medium text-amber-200/80">{item.role}</p>
          )}
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{item.summary}</p>
        </li>
      ))}
    </ul>
  );
}
