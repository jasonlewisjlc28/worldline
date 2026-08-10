import { X, MapPin, Users, Building2, Landmark } from "lucide-react";
import type { PersonDto } from "@contracts/types";

export type CountryPanelProps = {
  countryName: string;
  persons: PersonDto[];
  onClose: () => void;
  onSelectPerson: (id: number) => void;
  onSelectCompany: (name: string) => void;
};

type EntityItem = {
  name: string;
  summary: string;
  ownership?: "state" | "partial" | "private";
};

const OWNERSHIP_LABELS: Record<string, string> = {
  state: "State-owned",
  partial: "Partial SOE",
  private: "Private",
};

function OwnershipTag({ ownership }: { ownership?: EntityItem["ownership"] }) {
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

const GOV_KEYWORDS = [
  "government",
  "administration",
  "ministry",
  "ministries",
  "city administration",
  "municipal",
  "parliament",
  "duma",
  "congress",
  "senate",
  "council",
  "committee",
  "kremlin",
  "white house",
  "downing street",
  "intelligence",
  "security service",
  "secret service",
  "armed forces",
  "military",
  "army",
  "navy",
  "air force",
  "police",
  "bureau",
  "embassy",
  "kgb",
  "fsb",
  "cia",
  "fbi",
  "mi5",
  "mi6",
  "mossad",
  "central bank",
  "supreme court",
  "united nations",
  "nato",
  "european union",
];

const COMPANY_MARKERS = [
  "gazprom",
  "rosneft",
  "corp",
  "corporation",
  "inc",
  "ltd",
  "llc",
  "plc",
  "s.a.",
  "gmbh",
  "group",
  "holdings",
  "company",
  "co.",
  "bank ",
  "airlines",
  "energy",
  "oil",
  "gas",
  "media",
  "news",
  "tv",
  "industries",
];

function isGovernmentEntity(e: EntityItem): boolean {
  const name = e.name.toLowerCase();
  // Names that clearly denote a business stay, even if the summary says
  // "state-owned" (e.g. Gazprom, Rosneft).
  if (COMPANY_MARKERS.some((m) => name.includes(m))) return false;
  return GOV_KEYWORDS.some((k) => name.includes(k));
}

function collectEntities(
  persons: PersonDto[],
  key: "companies" | "parties",
): EntityItem[] {
  const map = new Map<string, EntityItem>();
  for (const p of persons) {
    for (const e of p[key] ?? []) {
      if (!e?.name) continue;
      const ownership =
        key === "companies" && "ownership" in e ? e.ownership : undefined;
      const item: EntityItem = { name: e.name, summary: e.summary ?? "", ownership };
      if (key === "companies" && isGovernmentEntity(item)) continue;
      const k = e.name.trim().toLowerCase();
      if (!map.has(k)) map.set(k, item);
      else if (!map.get(k)!.ownership && ownership)
        map.get(k)!.ownership = ownership;
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
    <div className="flex items-center gap-2 border-b border-[#e3c4c4] pb-2">
      <span className="text-[#b91c1c]">{icon}</span>
      <h3 className="text-xs font-bold uppercase tracking-widest text-stone-700">
        {title}
      </h3>
      <span className="ml-auto rounded-full bg-[#f3dede] px-2 py-0.5 text-[10px] font-semibold text-stone-700">
        {count}
      </span>
    </div>
  );
}

function EntityList({
  items,
  onSelect,
}: {
  items: EntityItem[];
  onSelect?: (name: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-stone-700 italic">
        None mentioned by the figures on this map yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((e) => (
        <li key={e.name}>
          <button
            type="button"
            onClick={onSelect ? () => onSelect(e.name) : undefined}
            className={`w-full rounded-lg border border-[#e3c4c4] bg-[#f9ecec] p-3 text-left ${
              onSelect
                ? "cursor-pointer transition hover:border-[#b91c1c]/50 hover:bg-[#b91c1c]/5"
                : "cursor-default"
            }`}
          >
          <p className="text-sm font-semibold text-stone-900">{e.name}</p>
          {e.ownership && (
            <div className="mt-1.5">
              <OwnershipTag ownership={e.ownership} />
            </div>
          )}
          {e.summary && (
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              {e.summary}
            </p>
          )}
          </button>
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
  onSelectCompany,
}: CountryPanelProps) {
  const companies = collectEntities(persons, "companies");
  const parties = collectEntities(persons, "parties");

  return (
    <aside className="pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-full max-w-md flex-col border-l border-[#e3c4c4] bg-white/95 shadow-2xl backdrop-blur">
      {/* header */}
      <div className="border-b border-[#e3c4c4] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-stone-900">
              <MapPin size={18} className="text-[#b91c1c]" />
              {countryName}
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              {persons.length === 0
                ? "No figures on this map are tied to this country yet"
                : `${persons.length} figure${persons.length === 1 ? "" : "s"} with citizenship or political office here`}
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
            <p className="text-xs text-stone-700 italic">
              Add someone from {countryName} via the search bar and they will
              appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {persons.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => onSelectPerson(p.id)}
                    className="w-full rounded-lg border border-[#e3c4c4] bg-[#f9ecec] p-3 text-left transition hover:border-[#b91c1c]/50 hover:bg-[#b91c1c]/5"
                  >
                    <p className="text-sm font-semibold text-stone-900">
                      {p.name}
                    </p>
                    {p.title && (
                      <p className="mt-0.5 text-xs text-[#92400e]/90">
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
          <EntityList items={companies} onSelect={onSelectCompany} />
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
