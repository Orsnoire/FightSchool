import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, Trophy, Heart, Swords, Shield } from "lucide-react";
import type { CombatStat } from "@shared/schema";

export default function TeacherStats() {
  const classCode = localStorage.getItem("teacherClassCode") || "DEMO123";

  const { data: stats, isLoading } = useQuery<CombatStat[]>({
    queryKey: [`/api/combat-stats/class/${classCode}`],
  });

  const studentStats = stats?.reduce((acc, stat) => {
    if (!acc[stat.studentId]) {
      acc[stat.studentId] = {
        nickname: stat.nickname,
        totalFights: 0,
        totalSurvived: 0,
        totalDamageDealt: 0,
        totalHealingDone: 0,
        totalDamageTaken: 0,
        totalDeaths: 0,
        classes: new Set<string>(),
      };
    }
    acc[stat.studentId].totalFights++;
    if (stat.survived) acc[stat.studentId].totalSurvived++;
    acc[stat.studentId].totalDamageDealt += stat.damageDealt;
    acc[stat.studentId].totalHealingDone += stat.healingDone;
    acc[stat.studentId].totalDamageTaken += stat.damageTaken;
    acc[stat.studentId].totalDeaths += stat.deaths;
    acc[stat.studentId].classes.add(stat.characterClass);
    return acc;
  }, {} as Record<string, any>);

  const topStudents = studentStats
    ? Object.entries(studentStats)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.totalSurvived - a.totalSurvived)
        .slice(0, 10)
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-title">
            Class Statistics
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-4xl font-serif font-bold mb-2" data-testid="text-page-title">
            Student Performance
          </h2>
          <p className="text-muted-foreground">
            Track your students' progress across all battles
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-1/4" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats && stats.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card data-testid="card-total-fights">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Fights</CardTitle>
                  <Swords className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-fights">
                    {stats.length}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-total-damage">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Damage Dealt</CardTitle>
                  <Swords className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-damage">
                    {stats.reduce((sum, s) => sum + s.damageDealt, 0)}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-total-healing">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Healing</CardTitle>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-healing">
                    {stats.reduce((sum, s) => sum + s.healingDone, 0)}
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
                    {Math.round((stats.filter(s => s.survived).length / stats.length) * 100)}%
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-leaderboard">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Top Students
                </CardTitle>
                <CardDescription>Students with the most victories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topStudents.map((student, index) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                      data-testid={`student-rank-${index + 1}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-semibold" data-testid={`text-student-${student.id}`}>
                            {student.nickname}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {student.totalFights} fights • {student.totalSurvived} wins
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {student.totalDamageDealt} damage
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {student.totalHealingDone} healing
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
              <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No stats yet</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Complete some fights to see student performance statistics
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
