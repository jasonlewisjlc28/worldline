import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Home, Globe2, Loader2, Link2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import WorldMap from "@/components/WorldMap";
import PersonPanel from "@/components/PersonPanel";
import CountryPanel from "@/components/CountryPanel";
import CompanyPanel from "@/components/CompanyPanel";
import SearchBar from "@/components/SearchBar";
import DidYouMeanDialog from "@/components/DidYouMeanDialog";
import CreateConnectionDialog from "@/components/CreateConnectionDialog";
import { countryMatches } from "@/lib/countryMatch";
import type { SearchResultDto } from "@contracts/types";

type TypoState = { original: string; suggestion: string } | null;

export default function WorldView() {
  const { worldId } = useParams<{ worldId: string }>();
  const id = Number(worldId);
  const navigate = useNavigate();

  const utils = trpc.useUtils();
  const detailQuery = trpc.world.detail.useQuery(
    { worldId: id },
    { enabled: Number.isFinite(id), refetchInterval: false }
  );
  const statusQuery = trpc.world.status.useQuery();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [focusReq, setFocusReq] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  const [resourceMarkers, setResourceMarkers] = useState<{ name: string; lat: number; lng: number; kind: "mine" | "refinery" }[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [typo, setTypo] = useState<TypoState>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingLinks, setPendingLinks] = useState(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // While connection summaries are being generated in the background, poll for them.
  useEffect(() => {
    if (pendingLinks <= 0) {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }
    if (!pollTimer.current) {
      pollTimer.current = setInterval(() => {
        utils.world.detail.invalidate({ worldId: id });
      }, 4000);
    }
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [pendingLinks, id, utils]);

  // Stop polling once all expected connections have arrived.
  const connectionCount = detailQuery.data?.connections.length ?? 0;
  const personCount = detailQuery.data?.persons.length ?? 0;
  useEffect(() => {
    if (pendingLinks > 0 && connectionCount >= (personCount * (personCount - 1)) / 2) {
      setPendingLinks(0);
    }
  }, [connectionCount, personCount, pendingLinks]);

  const showNotice = (msg: string, ms = 5000) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), ms);
  };
  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const handleResult = (result: SearchResultDto) => {
    if (result.type === "typo") {
      setTypo({ original: result.original, suggestion: result.didYouMean });
      return;
    }
    if (result.type === "not_found") {
      showNotice(result.message);
      return;
    }
    if (result.type === "duplicate") {
      setSelectedId(result.person.id);
      showNotice(`${result.person.name} is already on the map.`);
      utils.world.detail.invalidate({ worldId: id });
      return;
    }
    // added
    setSelectedId(result.person.id);
    const pending = result.pendingLinks ?? 0;
    if (pending > 0) {
      setPendingLinks(pending);
      showNotice(`Added ${result.person.name} — mapping ${pending} connection(s) in the background…`);
    } else {
      showNotice(`Added ${result.person.name}.`);
    }
    utils.world.detail.invalidate({ worldId: id });
    utils.world.list.invalidate();
  };

  const onMutationError = (e: { message?: string }) => {
    showNotice(e.message ?? "Something went wrong while contacting the AI.", 8000);
  };

  const searchMutation = trpc.world.searchAndAdd.useMutation({
    onSuccess: (r) => handleResult(r),
    onError: onMutationError,
  });
  const confirmMutation = trpc.world.confirmAdd.useMutation({
    onSuccess: (r) => handleResult(r),
    onError: onMutationError,
  });
  const suggestionMutation = trpc.world.addSuggestion.useMutation({
    onSuccess: (r) => handleResult(r),
    onError: onMutationError,
  });
  const removeMutation = trpc.world.removePerson.useMutation({
    onSuccess: () => {
      setSelectedId(null);
      utils.world.detail.invalidate({ worldId: id });
      utils.world.list.invalidate();
    },
  });

  const busy =
    searchMutation.isPending || confirmMutation.isPending || suggestionMutation.isPending;
  const busyName = suggestionMutation.isPending
    ? suggestionMutation.variables?.suggestionName ?? null
    : null;

  const persons = useMemo(() => detailQuery.data?.persons ?? [], [detailQuery.data]);
  const connections = useMemo(
    () => detailQuery.data?.connections ?? [],
    [detailQuery.data]
  );
  const selected = persons.find((p) => p.id === selectedId) ?? null;
  const countryPersons = useMemo(
    () =>
      selectedCountry
        ? persons.filter((p) => countryMatches(p.country, selectedCountry))
        : [],
    [persons, selectedCountry]
  );

  const highlightIds = useMemo(() => {
    const s = new Set<number>();
    if (hoverId != null) s.add(hoverId);
    return s.size ? s : undefined;
  }, [hoverId]);

  if (detailQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6e2e2]">
        <Loader2 className="animate-spin text-[#b91c1c]" size={32} />
      </div>
    );
  }
  if (detailQuery.error || !detailQuery.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6e2e2] text-stone-700">
        <p>World not found.</p>
        <button
          onClick={() => navigate("/")}
          className="rounded-md bg-[#b91c1c] px-4 py-2 text-sm text-white"
        >
          Back to menu
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#f6e2e2]">
      <WorldMap
        persons={persons}
        connections={connections}
        selectedId={selectedId}
        selectedCountry={selectedCountry}
        highlightIds={highlightIds}
        onSelect={(pid) => {
          setSelectedId(pid);
          setSelectedCountry(null);
        }}
        onCountryClick={(name) => {
          setSelectedCountry(name);
          setSelectedId(null);
        }}
        markers={resourceMarkers}
        focusRequest={focusReq}
        onBackgroundClick={() => {
          setSelectedId(null);
          setSelectedCountry(null);
        }}
      />

      {/* top bar */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="pointer-events-auto flex flex-col items-start gap-2">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 rounded-md border border-[#e3c4c4] bg-white/92 px-3 py-2 text-xs font-medium text-stone-700 backdrop-blur transition hover:border-[#b91c1c]/60 hover:text-[#b91c1c]"
          >
            <Home size={14} /> Menu
          </button>
          {persons.length >= 2 && (
            <button
              onClick={() => setConnectOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-[#e3c4c4] bg-white/92 px-3 py-2 text-xs font-medium text-stone-700 backdrop-blur transition hover:border-[#b91c1c]/60 hover:text-[#b91c1c]"
            >
              <Link2 size={14} /> Create connection
            </button>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-[#e3c4c4] bg-white/92 px-4 py-2 backdrop-blur">
          <Globe2 size={14} className="text-[#b91c1c]" />
          <span className="text-sm font-semibold text-stone-800">
            {detailQuery.data.world.name}
          </span>
          <span className="text-xs text-stone-400">
            {persons.length} figure{persons.length === 1 ? "" : "s"} · {connections.length} tie
            {connections.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="w-20" />
      </div>

      {/* country panel */}
      {(selectedCountry || selectedCompany) && !selected && (
        <CountryPanel
          countryName={selectedCountry ?? ""}
          persons={countryPersons}
          onClose={() => {
            setSelectedCountry(null);
            setSelectedCompany(null);
            setResourceMarkers([]);
          }}
          onShowMines={(sites, focus) => {
            setResourceMarkers(sites);
            if (focus) setFocusReq({ lat: focus[0], lng: focus[1], nonce: Date.now() });
          }}
          onSelectPerson={(pid) => {
            setSelectedId(pid);
            setSelectedCountry(null);
            setSelectedCompany(null);
          }}
          onSelectCompany={(name) => setSelectedCompany(name)}
        />
      )}

      {/* company panel */}
      {selectedCompany && (
        <CompanyPanel
          worldId={id}
          companyName={selectedCompany}
          persons={persons}
          onClose={() => {
            setSelectedCompany(null);
            setSelectedCountry(null);
            setSelectedId(null);
          }}
          onBack={() => {
            // Return to whatever was open before the company panel.
            setSelectedCompany(null);
          }}
          onSelectPerson={(pid) => {
            setSelectedCompany(null);
            setSelectedId(pid);
            setSelectedCountry(null);
          }}
        />
      )}

      {/* detail panel */}
      {selected && (
        <PersonPanel
          person={selected}
          allPersons={persons}
          connections={connections}
          busyName={busyName}
          onClose={() => setSelectedId(null)}
          onAddSuggestion={(name) =>
            suggestionMutation.mutate({
              worldId: id,
              personId: selected.id,
              suggestionName: name,
            })
          }
          onSelectPerson={(pid) => setSelectedId(pid)}
          onSelectCompany={(name) => setSelectedCompany(name)}
          onRemove={(pid) => removeMutation.mutate({ worldId: id, personId: pid })}
          onHoverPerson={setHoverId}
        />
      )}

      {/* create connection dialog */}
      {connectOpen && (
        <CreateConnectionDialog
          worldId={id}
          persons={persons}
          connections={connections}
          preselectedA={selectedId}
          onClose={() => setConnectOpen(false)}
          onCreated={(a, b) => {
            showNotice(`Tie created: ${a} ↔ ${b}.`);
            utils.world.detail.invalidate({ worldId: id });
          }}
        />
      )}

      {/* search bar */}
      <SearchBar
        busy={busy}
        aiReady={statusQuery.data?.aiReady ?? false}
        onSearch={(q) => searchMutation.mutate({ worldId: id, query: q })}
        notice={notice}
      />

      {/* typo dialog */}
      <DidYouMeanDialog
        open={typo !== null}
        original={typo?.original ?? ""}
        suggestion={typo?.suggestion ?? ""}
        onCancel={() => setTypo(null)}
        onConfirm={() => {
          if (typo) confirmMutation.mutate({ worldId: id, name: typo.suggestion });
          setTypo(null);
        }}
      />

      {/* busy overlay */}
      {(busy || pendingLinks > 0) && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-full border border-[#b91c1c]/30 bg-[#b91c1c]/10 px-4 py-1.5 text-xs text-[#b91c1c] backdrop-blur">
          {busy ? "KIMI AI is researching…" : "KIMI AI is mapping connections in the background…"}
        </div>
      )}
    </div>
  );
}
