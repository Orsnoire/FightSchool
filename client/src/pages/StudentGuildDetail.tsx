import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Trophy, Swords, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type Guild, type GuildMembership } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function StudentGuildDetail() {
  const [, params] = useRoute("/student/guild/:id");
  const [, navigate] = useLocation();
  const guildId = params?.id;
  const { toast } = useToast();
  const studentId = localStorage.getItem("studentId");

  const { data: guild, isLoading: guildLoading } = useQuery<Guild>({
    queryKey: [`/api/guilds/${guildId}`],
    enabled: !!guildId,
  });

  const { data: members } = useQuery<GuildMembership[]>({
    queryKey: [`/api/guilds/${guildId}/members`],
    enabled: !!guildId,
  });

  const { data: leaderboard } = useQuery<any[]>({
    queryKey: [`/api/guilds/${guildId}/leaderboard`, "damageDealt"],
    enabled: !!guildId,
  });

  const leaveGuildMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/guilds/${guildId}/members/${studentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/student/${studentId}/guilds`] });
      toast({ title: "Left guild", description: "You have left the guild" });
      navigate("/student/guilds");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to leave guild",
        variant: "destructive",
      });
    },
  });

  const handleLeaveGuild = () => {
    if (confirm("Are you sure you want to leave this guild?")) {
      leaveGuildMutation.mutate();
    }
  };

  if (guildLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <div className="h-8 bg-muted rounded w-48 mx-auto"></div>
          </div>
          <p className="text-muted-foreground">Loading guild...</p>
        </div>
      </div>
    );
  }

  if (!guild) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Guild not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/student/guilds">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-guild-name">
                {guild.name}
              </h1>
              <Badge variant="outline" className="flex items-center gap-1 w-fit mt-1">
                <Trophy className="h-3 w-3" />
                Level {guild.level}
              </Badge>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLeaveGuild}
            disabled={leaveGuildMutation.isPending}
            data-testid="button-leave-guild"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Leave Guild
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="leaderboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-guild">
            <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="roster" data-testid="tab-roster">Roster</TabsTrigger>
            <TabsTrigger value="info" data-testid="tab-info">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Guild Leaderboard</CardTitle>
                <CardDescription>Top contributors by damage dealt</CardDescription>
              </CardHeader>
              <CardContent>
                {leaderboard && leaderboard.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboard.map((entry, index) => (
                      <div
                        key={entry.studentId}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          entry.studentId === studentId ? 'bg-primary/10 border border-primary' : 'bg-muted/50'
                        }`}
                        data-testid={`leaderboard-entry-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={index < 3 ? "default" : "outline"} 
                            className="w-8 justify-center"
                          >
                            {index + 1}
                          </Badge>
                          <div>
                            <p className="font-medium">
                              {entry.nickname}
                              {entry.studentId === studentId && (
                                <span className="ml-2 text-sm text-primary">(You)</span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">{entry.characterClass}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-destructive">{entry.totalDamageDealt} DMG</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.fightsCompleted} fight{entry.fightsCompleted !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No leaderboard data yet. Complete guild fights to appear here!
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roster" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Guild Members</CardTitle>
                <CardDescription>
                  {members?.length || 0} member{members?.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {members && members.length > 0 ? (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          member.studentId === studentId ? 'border-primary bg-primary/10' : ''
                        }`}
                        data-testid={`member-${member.studentId}`}
                      >
                        <div>
                          <p className="font-medium">
                            {member.nickname || `Member ${member.studentId?.slice(0, 8)}` || 'Unknown'}
                            {member.studentId === studentId && (
                              <span className="ml-2 text-sm text-primary">(You)</span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No members yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Guild Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold flex items-center gap-2">
                    <Trophy className="h-6 w-6 text-amber-500" />
                    Level {guild.level}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Experience</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold flex items-center gap-2">
                    <Swords className="h-6 w-6 text-primary" />
                    {guild.experience} XP
                  </div>
                </CardContent>
              </Card>
            </div>

            {guild.description && (
              <Card>
                <CardHeader>
                  <CardTitle>About This Guild</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{guild.description}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
