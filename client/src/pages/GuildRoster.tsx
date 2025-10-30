import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users } from "lucide-react";
import { type Guild } from "@shared/schema";

interface GuildMemberWithStudent {
  id: string;
  studentId: string;
  joinedAt: number;
  nickname: string;
  characterClass: string;
}

export default function GuildRoster() {
  const [, params] = useRoute("/student/guilds/:guildId/roster");
  const guildId = params?.guildId;
  const studentId = localStorage.getItem("studentId");

  const { data: guild, isLoading: guildLoading } = useQuery<Guild>({
    queryKey: [`/api/guilds/${guildId}`],
    enabled: !!guildId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<GuildMemberWithStudent[]>({
    queryKey: [`/api/guilds/${guildId}/members`],
    enabled: !!guildId,
  });

  if (guildLoading || membersLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-orange-950 dark:via-amber-950 dark:to-orange-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <div className="h-8 bg-muted rounded w-48 mx-auto"></div>
          </div>
          <p className="text-muted-foreground">Loading roster...</p>
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
              Guild Roster
            </h1>
            <p className="text-sm text-muted-foreground">{guild.name}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 flex-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              All Members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {members.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {members.map((member) => (
                  <Card
                    key={member.studentId}
                    className={`${
                      member.studentId === studentId
                        ? 'border-2 border-primary'
                        : ''
                    }`}
                    data-testid={`member-card-${member.studentId}`}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-base truncate">
                          {member.nickname}
                        </p>
                        {member.studentId === studentId && (
                          <Badge variant="default" className="ml-2">You</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">
                        {member.characterClass || 'No class'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold text-muted-foreground">No members yet</p>
                <p className="text-sm text-muted-foreground mt-2">Be the first to join this guild!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
