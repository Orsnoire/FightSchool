import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import type { StudentCombatSummary } from "@shared/contracts/history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Swords, Heart, Shield, Target } from "lucide-react";
import type { CombatStat } from "@shared/schema";

interface StudentStatsProps {
  params: { id: string };
}

export default function StudentStats({ params }: StudentStatsProps) {
  const studentId = params.id;
  const summary = useQuery<StudentCombatSummary>({
    queryKey: [`/api/combat-stats/student/${studentId}/summary`],
  });
  const history = useInfiniteQuery({
    queryKey: [`/api/combat-stats/student/${studentId}`],
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const response = await fetch(
        `/api/combat-stats/student/${studentId}?limit=10${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ""}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Unable to load combat history");
      return {
        rows: (await response.json()) as CombatStat[],
        next: response.headers.get("X-Next-Cursor"),
      };
    },
    getNextPageParam: (last) => last.next || undefined,
  });
  const stats = history.data?.pages.flatMap((page) => page.rows);
  const isLoading = history.isLoading || summary.isLoading;
  const totalFights = summary.data?.totalFights || 0;
  const victories = summary.data?.survived || 0;
  const totalDamage = summary.data?.totalDamage || 0;
  const totalHealing = summary.data?.totalHealing || 0;
  const totalDamageTaken = summary.data?.totalDamageTaken || 0;
  const survivalRate = totalFights
    ? Math.round((100 * victories) / totalFights)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1
            className="text-2xl font-serif font-bold text-primary"
            data-testid="text-title"
          >
            My Statistics
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h2
            className="text-4xl font-serif font-bold mb-2"
            data-testid="text-page-title"
          >
            Combat Record
          </h2>
          <p className="text-muted-foreground">
            Your performance across all battles
          </p>
        </div>

        {history.isError || summary.isError ? (
          <div role="alert">
            Unable to load your combat record.{" "}
            <Button
              onClick={() => {
                void history.refetch();
                void summary.refetch();
              }}
            >
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-24" />
              </Card>
            ))}
          </div>
        ) : stats && stats.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <Card data-testid="card-total-fights">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Fights
                  </CardTitle>
                  <Swords className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className="text-2xl font-bold"
                    data-testid="text-total-fights"
                  >
                    {totalFights}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-victories">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Victories
                  </CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className="text-2xl font-bold text-primary"
                    data-testid="text-victories"
                  >
                    {victories}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-survival-rate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Survival Rate
                  </CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className="text-2xl font-bold"
                    data-testid="text-survival-rate"
                  >
                    {survivalRate}%
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-damage-dealt">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Damage Dealt
                  </CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className="text-2xl font-bold"
                    data-testid="text-damage-dealt"
                  >
                    {totalDamage}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-healing-done">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Healing Done
                  </CardTitle>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className="text-2xl font-bold"
                    data-testid="text-healing-done"
                  >
                    {totalHealing}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-damage-taken">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Damage Taken
                  </CardTitle>
                  <Swords className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className="text-2xl font-bold"
                    data-testid="text-damage-taken"
                  >
                    {totalDamageTaken}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-fight-history">
              <CardHeader>
                <CardTitle>Fight History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.map((stat, index) => (
                    <div
                      key={stat.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                      data-testid={`fight-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${stat.survived ? "bg-green-500" : "bg-red-500"}`}
                        />
                        <div>
                          <div className="font-medium capitalize">
                            {stat.characterClass}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(stat.completedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-medium">
                          {stat.survived ? "Victory" : "Defeated"}
                        </div>
                        <div className="text-muted-foreground">
                          {stat.damageDealt} dmg • {stat.healingDone} heal
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {history.hasNextPage && (
                  <Button
                    className="mt-4"
                    disabled={history.isFetchingNextPage}
                    onClick={() => void history.fetchNextPage()}
                  >
                    {history.isFetchingNextPage
                      ? "Loading…"
                      : "Load older fights"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Trophy className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No battles yet</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Join a fight to start building your combat record
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
