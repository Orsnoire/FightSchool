import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Swords, Heart, Shield, Target } from "lucide-react";
import type { CombatStat } from "@shared/schema";

interface StudentStatsProps {
  params: { id: string };
}

export default function StudentStats({ params }: StudentStatsProps) {
  const studentId = params.id;
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = useQuery<CombatStat[]>({
    queryKey: [`/api/combat-stats/student/${studentId}`],
  });

  const totalFights = stats?.length || 0;
  const victories = stats?.filter(s => s.survived).length || 0;
  const totalDamage = stats?.reduce((sum, s) => sum + s.damageDealt, 0) || 0;
  const totalHealing = stats?.reduce((sum, s) => sum + s.healingDone, 0) || 0;
  const totalDamageTaken = stats?.reduce((sum, s) => sum + s.damageTaken, 0) || 0;
  const survivalRate = totalFights > 0 ? Math.round((victories / totalFights) * 100) : 0;

  const classCounts = stats?.reduce((acc, stat) => {
    acc[stat.characterClass] = (acc[stat.characterClass] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const favoriteClass = classCounts
    ? Object.entries(classCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None"
    : "None";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-title">
            My Statistics
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h2 className="text-4xl font-serif font-bold mb-2" data-testid="text-page-title">
            Combat Record
          </h2>
          <p className="text-muted-foreground">
            Your performance across all battles
          </p>
        </div>

        {isLoading ? (
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
                  <CardTitle className="text-sm font-medium">Total Fights</CardTitle>
                  <Swords className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-fights">
                    {totalFights}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-victories">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Victories</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary" data-testid="text-victories">
                    {victories}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-survival-rate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Survival Rate</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-survival-rate">
                    {survivalRate}%
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-damage-dealt">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Damage Dealt</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-damage-dealt">
                    {totalDamage}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-healing-done">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Healing Done</CardTitle>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-healing-done">
                    {totalHealing}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-damage-taken">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Damage Taken</CardTitle>
                  <Swords className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-damage-taken">
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
                  {stats.slice(0, 10).map((stat, index) => (
                    <div
                      key={stat.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                      data-testid={`fight-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${stat.survived ? 'bg-green-500' : 'bg-red-500'}`} />
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
                          {stat.survived ? 'Victory' : 'Defeated'}
                        </div>
                        <div className="text-muted-foreground">
                          {stat.damageDealt} dmg • {stat.healingDone} heal
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
