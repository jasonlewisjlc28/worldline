import { X, MapPin, Users } from "lucide-react";
import type { PersonDto } from "@contracts/types";

export type CountryPanelProps = {
  countryName: string;
  persons: PersonDto[];
  onClose: () => void;
  onSelectPerson: (id: number) => void;
};

export default function CountryPanel({
  countryName,
  persons,
  onClose,
  onSelectPerson,
}: CountryPanelProps) {
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

      {/* people list */}
      <div className="flex-1 overflow-y-auto p-4">
        {persons.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-500">
            <Users size={28} className="opacity-40" />
            <p className="text-sm">
              Add someone from {countryName} via the search bar and they will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {persons.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onSelectPerson(p.id)}
                  className="w-full rounded-lg border border-slate-700/60 bg-slate-800/40 p-3 text-left transition hover:border-sky-400/50 hover:bg-sky-400/5"
                >
                  <p className="text-sm font-semibold text-slate-100">{p.name}</p>
                  {p.title && (
                    <p className="mt-0.5 text-xs text-amber-200/80">{p.title}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
