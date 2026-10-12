import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionPreview } from "@/components/QuestionPreview";
import { RichContentRenderer } from "@/components/RichContentRenderer";
import { ALL_CHARACTER_CLASSES } from "@shared/schema";
import type { SessionReport, ReportRow } from "@shared/contracts/reporting";

type Filters = Record<
  | "guildId"
  | "sessionId"
  | "quizId"
  | "questionId"
  | "job"
  | "playerId"
  | "from"
  | "to",
  string
>;
const empty: Filters = {
  guildId: "",
  sessionId: "",
  quizId: "",
  questionId: "",
  job: "",
  playerId: "",
  from: "",
  to: "",
};
const accuracy = (r: { correct: number; attempts: number }) =>
  r.attempts ? `${((100 * r.correct) / r.attempts).toFixed(1)}%` : "—";
const label = (s: string) => s.replaceAll("_", " ");
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
export default function TeacherStats() {
  const [filters, setFilters] = useState<Filters>(empty),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const [view, setView] = useState<"sessions" | "players" | "questions">(
      "sessions",
    ),
    [sort, setSort] = useState("recent"),
    [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [search]);
  const params = new URLSearchParams({
    view,
    search: query,
    sort,
    page: String(page),
  });
  for (const [key, value] of Object.entries(filters))
    if (value) {
      if (key === "from" || key === "to") {
        const date = new Date(`${value}T00:00:00`);
        if (key === "to") date.setDate(date.getDate() + 1);
        params.set(key, String(date.getTime()));
      } else params.set(key, value);
    }
  const filterError =
    filters.playerId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      filters.playerId,
    )
      ? "Enter the full player ID, or use search for part of an ID."
      : filters.from && filters.to && filters.from > filters.to
        ? "The start date must be on or before the end date."
        : null;
  const report = useQuery<SessionReport>({
    queryKey: [`/api/combat-stats/report?${params}`],
    enabled: !filterError,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });
  const data = report.data;
  const filter = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
    setExpanded(null);
  };
  const drill = (row: ReportRow) => {
    setFilters((f) => ({
      ...f,
      sessionId: row.sessionId,
      ...(row.studentId ? { playerId: row.studentId } : {}),
    }));
    setView(row.studentId ? "questions" : "players");
    setPage(1);
  };
  const academicOnly = view === "questions" || !!filters.questionId;
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex items-center gap-4 py-5">
          <Link href="/teacher">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to teacher dashboard"
            >
              <ArrowLeft />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Session statistics</h1>
            <p className="text-sm text-muted-foreground">
              Explore participation, learning and combat performance.
            </p>
          </div>
        </div>
      </header>
      <main className="container space-y-6 py-6">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="flex items-center gap-2">
              <Search size={18} />
              <Input
                aria-label="Search statistics"
                placeholder="Search quizzes, questions, nicknames or IDs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <details open>
              <summary className="mb-3 cursor-pointer text-sm font-medium">
                <SlidersHorizontal className="mr-2 inline" size={16} />
                Filters
              </summary>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm">
                  Guild
                  <select
                    aria-label="Guild"
                    className={selectClass}
                    value={filters.guildId}
                    onChange={(e) => filter("guildId", e.target.value)}
                  >
                    <option value="">All guilds</option>
                    {data?.facets.guilds.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Quiz
                  <select
                    aria-label="Quiz"
                    className={selectClass}
                    value={filters.quizId}
                    onChange={(e) => filter("quizId", e.target.value)}
                  >
                    <option value="">All quizzes</option>
                    {data?.facets.quizzes.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Session
                  <Input
                    value={filters.sessionId}
                    placeholder="Session ID"
                    onChange={(e) => filter("sessionId", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Job
                  <select
                    aria-label="Job"
                    className={selectClass}
                    value={filters.job}
                    onChange={(e) => filter("job", e.target.value)}
                  >
                    <option value="">All jobs</option>
                    {ALL_CHARACTER_CLASSES.map((j) => (
                      <option key={j} value={j}>
                        {label(j)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Question
                  <Input
                    value={filters.questionId}
                    placeholder="Question ID"
                    onChange={(e) => filter("questionId", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Player ID
                  <Input
                    value={filters.playerId}
                    placeholder="Exact player ID"
                    onChange={(e) => filter("playerId", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  From
                  <Input
                    type="date"
                    value={filters.from}
                    onChange={(e) => filter("from", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Through
                  <Input
                    type="date"
                    value={filters.to}
                    onChange={(e) => filter("to", e.target.value)}
                  />
                </label>
              </div>
            </details>
            <Button
              variant="ghost"
              onClick={() => {
                setFilters(empty);
                setSearch("");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
        {filterError && (
          <p role="status" className="text-sm text-muted-foreground">
            {filterError}
          </p>
        )}
        {report.isError ? (
          <Card>
            <CardContent className="pt-5" role="alert">
              <p>
                Statistics could not be loaded. Check the filters and try again.
              </p>
              <Button className="mt-3" onClick={() => report.refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}
        {data && !filterError && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Sessions", data.summary.sessions],
                ["Players", data.summary.players],
                ["Accuracy", accuracy(data.summary)],
                [
                  "Correct / opportunities",
                  `${data.summary.correct} / ${data.summary.attempts}`,
                ],
              ].map(([name, value]) => (
                <Card key={name}>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">{name}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {data.summary.historicalParticipants > 0 && (
              <p className="rounded-md border p-3 text-sm">
                Some historical results contain totals only. Question-level
                detail and unanswered counts are unavailable for those attempts.
              </p>
            )}
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2" aria-label="Statistics view">
            {(["sessions", "players", "questions"] as const).map((v) => (
              <Button
                key={v}
                variant={view === v ? "default" : "outline"}
                onClick={() => {
                  setView(v);
                  setPage(1);
                  setExpanded(null);
                }}
              >
                {v === "questions"
                  ? "Question attempts"
                  : v === "players"
                    ? "Players"
                    : "Sessions"}
              </Button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            Sort
            <select
              className={selectClass}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="recent">Most recent</option>
              <option value="accuracy">Highest accuracy</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
        {academicOnly && (
          <p className="text-sm text-muted-foreground">
            Showing academic evidence. Combat totals are available in the
            unfiltered session and player views.
          </p>
        )}
        {report.isLoading ? (
          <p role="status">Loading statistics…</p>
        ) : data && !report.isError && !filterError ? (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    {[
                      view === "sessions"
                        ? "Session / quiz"
                        : "Player / session",
                      view === "questions"
                        ? "Question / outcome"
                        : "Participation",
                      "Correct",
                      "Incorrect",
                      "Unanswered",
                      "Accuracy",
                      ...(!academicOnly
                        ? [
                            "Damage",
                            "Healing",
                            "Blocked",
                            "Deaths",
                            "XP / gold",
                          ]
                        : []),
                      "Details",
                    ].map((h) => (
                      <th key={h} className="whitespace-nowrap p-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => {
                    const key = `${r.sessionId}:${r.studentId || ""}:${r.round || i}`;
                    return (
                      <tr key={key} className="border-t align-top">
                        <td className="min-w-48 p-3">
                          <strong>
                            {view === "sessions" ? r.quizTitle : r.nickname}
                          </strong>
                          <div className="text-xs text-muted-foreground">
                            {new Date(r.startedAt).toLocaleString()}
                          </div>
                          <button
                            className="break-all text-xs underline"
                            onClick={() => filter("sessionId", r.sessionId)}
                          >
                            {r.sessionId}
                          </button>
                          {r.studentId && (
                            <div>
                              <button
                                className="break-all text-xs underline"
                                onClick={() => filter("playerId", r.studentId!)}
                              >
                                {r.studentId}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="min-w-36 p-3">
                          {view === "questions" ? (
                            <>
                              <button
                                className="text-xs underline"
                                onClick={() =>
                                  filter("questionId", r.questionId!)
                                }
                              >
                                {r.questionId}
                              </button>
                              <p>
                                Round {r.round} · {r.outcome}
                              </p>
                            </>
                          ) : (
                            <>
                              <p>{r.guildName || "No guild"}</p>
                              <p>
                                {view === "sessions"
                                  ? `${r.players} players`
                                  : label(r.job || "")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {r.status}
                                {r.status === "completed"
                                  ? ` · ${r.victory ? "Victory" : "Ended"}`
                                  : ""}
                                {r.survived !== undefined
                                  ? ` · ${r.survived ? "Survived" : "KO"}`
                                  : ""}
                              </p>
                            </>
                          )}
                        </td>
                        <td className="p-3">{r.correct}</td>
                        <td className="p-3">{r.incorrect}</td>
                        <td className="p-3">{r.unanswered ?? "—"}</td>
                        <td className="p-3">{accuracy(r)}</td>
                        {!academicOnly && (
                          <>
                            <td className="p-3">
                              {Number(r.damage.toFixed(2))}
                            </td>
                            <td className="p-3">
                              {Number(r.healing.toFixed(2))}
                            </td>
                            <td className="p-3">
                              {Number(r.blocked.toFixed(2))}
                            </td>
                            <td className="p-3">{r.deaths}</td>
                            <td className="p-3">
                              {r.xp} / {r.gold}
                            </td>
                          </>
                        )}
                        <td className="p-3">
                          {view === "questions" ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setExpanded(expanded === key ? null : key)
                                }
                              >
                                View question
                              </Button>
                              {expanded === key && r.question && (
                                <div className="mt-3 min-w-72 max-w-xl">
                                  <QuestionPreview question={r.question} />
                                  <p className="mt-2 font-semibold">
                                    Correct answer
                                  </p>
                                  <RichContentRenderer
                                    html={r.question.correctAnswer}
                                  />
                                  <p className="mt-2 break-all text-xs">
                                    Version {r.questionVersion}
                                  </p>
                                </div>
                              )}
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => drill(r)}
                            >
                              {view === "sessions"
                                ? "View players"
                                : "View attempts"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!data.rows.length && (
                <p className="p-8 text-center text-muted-foreground">
                  No matching{" "}
                  {view === "questions"
                    ? "recorded question attempts"
                    : "results"}
                  .
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {data.total} results · Page {page} of{" "}
                {Math.max(1, Math.ceil(data.total / data.pageSize))}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={page * data.pageSize >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
