import { useState } from "react";
import { ECONOMICS } from "../data/economics";
import ResourcesTab from "./ResourcesTab";
import {
  ArrowLeftRight,
  Briefcase,
  Scale,
  Coins,
  Tractor,
  Leaf,
} from "lucide-react";

const PALETTE = ["#b91c1c", "#ea580c", "#292524", "#ca8a04", "#78716c", "#0f766e"];
const color = (i: number) => PALETTE[i % PALETTE.length];

type Sub = "trade" | "labor" | "debt" | "currency" | "land" | "resources";

const SUBS: { id: Sub; label: string; icon: React.ReactNode }[] = [
  { id: "trade", label: "Imports & Exports", icon: <ArrowLeftRight size={12} /> },
  { id: "labor", label: "Labor Force", icon: <Briefcase size={12} /> },
  { id: "debt", label: "Balance of Payments", icon: <Scale size={12} /> },
  { id: "currency", label: "Currency", icon: <Coins size={12} /> },
  { id: "land", label: "Land Ownership", icon: <Tractor size={12} /> },
  { id: "resources", label: "Resources", icon: <Leaf size={12} /> },
];

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-bold uppercase tracking-widest text-[#b91c1c]">
      {children}
    </h4>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#e3c4c4] bg-[#f9f4ec] p-4">
      {children}
    </div>
  );
}

function Source({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-2 text-[10px] leading-relaxed text-stone-500">{children}</p>
  );
}

function Bar({ label, pct, i }: { label: string; pct: number; i: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-stone-800">{label}</span>
        <span className="text-xs font-bold tabular-nums text-stone-900">
          {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#efe3d3]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color(i) }}
        />
      </div>
    </div>
  );
}

function Missing() {
  return (
    <Card>
      <p className="text-xs italic text-stone-600">
        Data not available for this territory.
      </p>
    </Card>
  );
}

function DebtList({
  title,
  items,
  kind,
}: {
  title: string;
  items:
    | { creditor: string; share: string; note: string }[]
    | { debtor: string; note: string }[];
  kind: "owes" | "owed";
}) {
  return (
    <Card>
      <SubHead>{title}</SubHead>
      <ul className="mt-3 space-y-2">
        {items.map((it, i) => {
          const name =
            kind === "owes"
              ? (it as { creditor: string }).creditor
              : (it as { debtor: string }).debtor;
          const share =
            kind === "owes" ? (it as { share?: string }).share : undefined;
          return (
            <li
              key={name + i}
              className="rounded-md border border-[#e3c4c4] bg-white p-2.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-stone-900">
                  {name}
                </span>
                {share && (
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#b91c1c]">
                    {share}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-stone-500">
                {it.note}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function EconomicsTab({ countryName }: { countryName: string }) {
  const [sub, setSub] = useState<Sub>("trade");
  const e = ECONOMICS[countryName];

  return (
    <div className="space-y-4">
      {/* sub-tab strip */}
      <div className="flex flex-wrap gap-1">
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSub(s.id)}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
              sub === s.id
                ? "border-[#b91c1c]/40 bg-[#f9ecec] text-[#b91c1c]"
                : "border-[#e3c4c4] bg-white text-stone-500 hover:text-stone-900"
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {!e ? (
        <Missing />
      ) : sub === "trade" ? (
        <div className="space-y-4">
          {e.exp != null && e.imp != null ? (
            <Card>
              <SubHead>Trade as share of GDP</SubHead>
              <div className="mt-3 space-y-3">
                <Bar label="Exports of goods & services" pct={e.exp} i={0} />
                <Bar label="Imports of goods & services" pct={e.imp} i={1} />
                {e.exp != null && e.imp != null && (
                  <p className="text-[11px] font-semibold text-stone-800">
                    Trade balance:{" "}
                    <span
                      className={
                        e.exp - e.imp >= 0 ? "text-emerald-700" : "text-red-700"
                      }
                    >
                      {e.exp - e.imp >= 0 ? "+" : ""}
                      {(e.exp - e.imp).toFixed(1)}% of GDP
                    </span>
                  </p>
                )}
              </div>
            </Card>
          ) : (
            <Missing />
          )}
          {(e.exportPartners || e.mainGoods) && (
            <Card>
              <SubHead>Partners &amp; Goods</SubHead>
              <dl className="mt-3 space-y-2.5 text-xs">
                {e.exportPartners && (
                  <div>
                    <dt className="font-semibold text-stone-800">
                      Main export destinations
                    </dt>
                    <dd className="mt-0.5 leading-relaxed text-stone-600">
                      {e.exportPartners}
                    </dd>
                  </div>
                )}
                {e.importPartners && (
                  <div>
                    <dt className="font-semibold text-stone-800">
                      Main import sources
                    </dt>
                    <dd className="mt-0.5 leading-relaxed text-stone-600">
                      {e.importPartners}
                    </dd>
                  </div>
                )}
                {e.mainGoods && (
                  <div>
                    <dt className="font-semibold text-stone-800">
                      Key goods
                    </dt>
                    <dd className="mt-0.5 leading-relaxed text-stone-600">
                      {e.mainGoods}
                    </dd>
                  </div>
                )}
              </dl>
              <Source>
                Sources: World Bank WDI (latest 2019–2024); UN Comtrade / OEC.
              </Source>
            </Card>
          )}
        </div>
      ) : sub === "labor" ? (
        <div className="space-y-4">
          {e.srv != null && e.ind != null && e.agr != null ? (
            <Card>
              <SubHead>Employment by sector (% of labor force)</SubHead>
              <div className="mt-3 space-y-3">
                <Bar label="Services" pct={e.srv} i={0} />
                <Bar label="Industry" pct={e.ind} i={1} />
                <Bar label="Agriculture" pct={e.agr} i={2} />
              </div>
              <Source>
                Source: World Bank (modeled ILO estimates, latest 2019–2024).
              </Source>
            </Card>
          ) : (
            <Missing />
          )}
        </div>
      ) : sub === "debt" ? (
        <div className="space-y-4">
          {e.govDebt != null || e.extDebt != null ? (
            <Card>
              <SubHead>Debt burden</SubHead>
              <div className="mt-3 space-y-3">
                {e.govDebt != null && (
                  <Bar
                    label="Government debt (internal + external), % of GDP"
                    pct={e.govDebt}
                    i={0}
                  />
                )}
                {e.extDebt != null && (
                  <Bar
                    label="External debt, % of GNI"
                    pct={e.extDebt}
                    i={1}
                  />
                )}
              </div>
              <Source>
                Government debt combines domestic and foreign-owed obligations
                (IMF WEO estimate, % of GDP). External debt is what residents
                owe to non-residents (World Bank, % of GNI).
              </Source>
            </Card>
          ) : (
            <Missing />
          )}
          {e.owesTo && e.owesTo.length > 0 && (
            <DebtList
              title="Who this country owes (creditors)"
              items={e.owesTo}
              kind="owes"
            />
          )}
          {e.owedTo && e.owedTo.length > 0 && (
            <DebtList
              title="Who owes this country (debtors)"
              items={e.owedTo}
              kind="owed"
            />
          )}
          {!e.owesTo && !e.owedTo && (
            <Card>
              <p className="text-xs italic text-stone-600">
                Bilateral debt breakdown not yet documented for this country.
              </p>
            </Card>
          )}
          <p className="text-[10px] leading-relaxed text-stone-500">
            Breakdown sources: World Bank International Debt Statistics,
            AidData Chinese debt database, Paris Club records, IMF program
            documents, national debt offices. Figures are approximate
            outstanding amounts, latest documented.
          </p>
        </div>
      ) : sub === "currency" ? (
        <div className="space-y-4">
          {e.currency ? (
            <Card>
              <SubHead>Currency purchasing power</SubHead>
              <p className="mt-2 text-sm font-semibold text-stone-900">
                {e.currency}
              </p>
              {e.ppp != null && (
                <p className="mt-2 text-xs leading-relaxed text-stone-600">
                  PPP conversion factor:{" "}
                  <span className="font-bold tabular-nums text-stone-900">
                    {e.ppp.toLocaleString()}
                  </span>{" "}
                  local currency units per international dollar. A figure far
                  above the market exchange rate means the currency buys more
                  at home than abroad (strong domestic purchasing power); a
                  figure near or below it indicates purchasing power closer to
                  — or weaker than — international prices.
                </p>
              )}
              <Source>Source: World Bank PPP estimates (latest).</Source>
            </Card>
          ) : (
            <Missing />
          )}
        </div>
      ) : sub === "land" ? (
        <div className="space-y-4">
          {e.land ? (
            <Card>
              <SubHead>Finance / Corporate land ownership</SubHead>
              <p className="mt-2 text-xs leading-relaxed text-stone-600">
                {e.land}
              </p>
              <Source>
                Sources: Land Matrix Global Observatory, national land
                registries, FAO reporting.
              </Source>
            </Card>
          ) : (
            <Missing />
          )}
        </div>
      ) : (
        <ResourcesTab countryName={countryName} />
      )}
    </div>
  );
}
