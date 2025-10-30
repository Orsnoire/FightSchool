import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, Medal } from "lucide-react";
import { type Guild } from "@shared/schema";

interface LeaderboardEntry {
  studentId: string;
  nickname: string;
  characterClass: string;
  totalDamageDealt: number;
  fightsCompleted: number;
}

export default function GuildLeaderboard() {
  const [, params] = useRoute("/student/guilds/:guildId/leaderboard");
  const guildId = params?.guildId;
  const studentId = localStorage.getItem("studentId");

  const { data: guild, isLoading: guildLoading } = useQuery<Guild>({
    queryKey: [`/api/guilds/${guildId}`],
    enabled: !!guildId,
  });

  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: [`/api/guilds/${guildId}/leaderboard`, "damageDealt"],
    enabled: !!guildId,
  });

  if (guildLoading || leaderboardLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-orange-950 dark:via-amber-950 dark:to-orange-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <div className="h-8 bg-muted rounded w-48 mx-auto"></div>
          </div>
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (!guild) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-orange-950 dark:via-amber-950 dark:to-orange-900 flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Guild not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRankIcon = (index: number) => {
    if (index === 0) return { icon: Trophy, color: "text-yellow-500" };
    if (index === 1) return { icon: Medal, color: "text-gray-400" };
    if (index === 2) return { icon: Medal, color: "text-amber-600" };
    return { icon: Medal, color: "text-muted-foreground" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-orange-950 dark:via-amber-950 dark:to-orange-900 flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href={`/student/guild-lobby/${guildId}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-page-title">
              Leaderboard
            </h1>
            <p className="text-sm text-muted-foreground">{guild.name}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 flex-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Top Performers by Damage Dealt
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length > 0 ? (
              <div className="space-y-3">
                {leaderboard.map((entry, index) => {
                  const { icon: RankIcon, color } = getRankIcon(index);
                  return (
                    <Card
                      key={entry.studentId}
                      className={`${
                        entry.studentId === studentId
                          ? 'border-2 border-primary'
                          : ''
                      }`}
                      data-testid={`leaderboard-entry-${index}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 min-w-[3rem]">
                              <Badge
                                variant={index < 3 ? "default" : "outline"}
                                className="w-8 h-8 flex items-center justify-center p-0 text-sm font-bold"
                              >
                                {index + 1}
                              </Badge>
                              <RankIcon className={`h-5 w-5 ${color}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-base">
                                  {entry.nickname}
                                </p>
                                {entry.studentId === studentId && (
                                  <Badge variant="default">You</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground capitalize">
                                {entry.characterClass}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-destructive">
                              {entry.totalDamageDealt.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.fightsCompleted} {entry.fightsCompleted === 1 ? 'fight' : 'fights'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold text-muted-foreground">No stats yet</p>
                <p className="text-sm text-muted-foreground mt-2">Complete fights to see leaderboard rankings!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
