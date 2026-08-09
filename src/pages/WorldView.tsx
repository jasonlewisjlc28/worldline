import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Home, Globe2, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import WorldMap from "@/components/WorldMap";
import PersonPanel from "@/components/PersonPanel";
import SearchBar from "@/components/SearchBar";
import DidYouMeanDialog from "@/components/DidYouMeanDialog";
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
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [typo, setTypo] = useState<TypoState>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    showNotice(`Added ${result.person.name} — ${result.newConnections.length} connection(s) mapped.`);
    utils.world.detail.invalidate({ worldId: id });
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

  const highlightIds = useMemo(() => {
    const s = new Set<number>();
    if (hoverId != null) s.add(hoverId);
    return s.size ? s : undefined;
  }, [hoverId]);

  if (detailQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070d1a]">
        <Loader2 className="animate-spin text-sky-400" size={32} />
      </div>
    );
  }
  if (detailQuery.error || !detailQuery.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#070d1a] text-slate-300">
        <p>World not found.</p>
        <button
          onClick={() => navigate("/")}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm text-white"
        >
          Back to menu
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070d1a]">
      <WorldMap
        persons={persons}
        connections={connections}
        selectedId={selectedId}
        highlightIds={highlightIds}
        onSelect={(pid) => setSelectedId(pid)}
        onBackgroundClick={() => setSelectedId(null)}
      />

      {/* top bar */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4">
        <button
          onClick={() => navigate("/")}
          className="pointer-events-auto flex items-center gap-2 rounded-md border border-slate-700/70 bg-[#0c1526]/90 px-3 py-2 text-xs font-medium text-slate-300 backdrop-blur transition hover:border-sky-400/60 hover:text-sky-300"
        >
          <Home size={14} /> Menu
        </button>
        <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-slate-700/70 bg-[#0c1526]/90 px-4 py-2 backdrop-blur">
          <Globe2 size={14} className="text-sky-400" />
          <span className="text-sm font-semibold text-slate-200">
            {detailQuery.data.world.name}
          </span>
          <span className="text-xs text-slate-500">
            {persons.length} figure{persons.length === 1 ? "" : "s"} · {connections.length} tie
            {connections.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="w-20" />
      </div>

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
          onRemove={(pid) => removeMutation.mutate({ worldId: id, personId: pid })}
          onHoverPerson={setHoverId}
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
      {busy && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-xs text-sky-300 backdrop-blur">
          KIMI AI is researching connections…
        </div>
      )}
    </div>
  );
}
