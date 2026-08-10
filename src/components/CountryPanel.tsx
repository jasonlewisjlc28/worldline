import { X, MapPin, Users, Building2, Landmark } from "lucide-react";
import type { PersonDto } from "@contracts/types";

export type CountryPanelProps = {
  countryName: string;
  persons: PersonDto[];
  onClose: () => void;
  onSelectPerson: (id: number) => void;
};

type EntityItem = { name: string; summary: string };

function collectEntities(
  persons: PersonDto[],
  key: "companies" | "parties",
): EntityItem[] {
  const map = new Map<string, EntityItem>();
  for (const p of persons) {
    for (const e of p[key] ?? []) {
      if (!e?.name) continue;
      const k = e.name.trim().toLowerCase();
      if (!map.has(k)) {
        map.set(k, { name: e.name, summary: e.summary ?? "" });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-700/60 pb-2">
      <span className="text-sky-400">{icon}</span>
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">
        {title}
      </h3>
      <span className="ml-auto rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
        {count}
      </span>
    </div>
  );
}

function EntityList({ items }: { items: EntityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic">
        None mentioned by the figures on this map yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((e) => (
        <li
          key={e.name}
          className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3"
        >
          <p className="text-sm font-semibold text-slate-100">{e.name}</p>
          {e.summary && (
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {e.summary}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function CountryPanel({
  countryName,
  persons,
  onClose,
  onSelectPerson,
}: CountryPanelProps) {
  const companies = collectEntities(persons, "companies");
  const parties = collectEntities(persons, "parties");

  return (
    <aside className="pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-full max-w-md flex-col border-l border-slate-700/60 bg-[#0c1526]/95 shadow-2xl backdrop-blur">
      {/* header */}
      <div className="border-b border-slate-700/60 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100">
              <MapPin size={18} className="text-sky-400" />
              {countryName}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {persons.length === 0
                ? "No figures on this map are tied to this country yet"
                : `${persons.length} figure${persons.length === 1 ? "" : "s"} with citizenship or political office here`}
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
      </div>

      {/* body */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* People */}
        <section className="space-y-3">
          <SectionHeader
            icon={<Users size={14} />}
            title="People"
            count={persons.length}
          />
          {persons.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              Add someone from {countryName} via the search bar and they will
              appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {persons.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => onSelectPerson(p.id)}
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-800/40 p-3 text-left transition hover:border-sky-400/50 hover:bg-sky-400/5"
                  >
                    <p className="text-sm font-semibold text-slate-100">
                      {p.name}
                    </p>
                    {p.title && (
                      <p className="mt-0.5 text-xs text-amber-200/80">
                        {p.title}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Companies */}
        <section className="space-y-3">
          <SectionHeader
            icon={<Building2 size={14} />}
            title="Companies"
            count={companies.length}
          />
          <EntityList items={companies} />
        </section>

        {/* Political Parties */}
        <section className="space-y-3">
          <SectionHeader
            icon={<Landmark size={14} />}
            title="Political Parties"
            count={parties.length}
          />
          <EntityList items={parties} />
        </section>
      </div>
    </aside>
  );
}
