import { StaminaBar } from "@/components/StaminaBar";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Swords, Target, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type Guild, type Student, type StudentJobLevel, type CharacterClass } from "@shared/schema";
import { availableAbilities, hasOffensiveAbility } from "@shared/combat/abilities";

interface Fight {
  id: string;
  title: string;
  description: string;
  questions: any[];
  questionCount?: number;
  enemies: any[];
  soloModeEnabled: boolean;
}

export default function GuildFights() {
  const [, params] = useRoute("/student/guilds/:guildId/fights");
  const [, navigate] = useLocation();
  const guildId = params?.guildId;
  const { toast } = useToast();
  const studentId = localStorage.getItem("studentId");
  const [hostingFightId, setHostingFightId] = useState<string | null>(null);
  const [soloWarningFightId, setSoloWarningFightId] = useState<string | null>(null);
  const { data: student, isFetching: studentFetching, isError: studentError, refetch: refetchStudent } = useQuery<Student>({
    queryKey: [`/api/student/${studentId}`], enabled: !!studentId,
    staleTime: 0, refetchOnMount: "always",
  });
  const { data: jobLevels, isFetching: levelsFetching, isError: levelsError, refetch: refetchLevels } = useQuery<StudentJobLevel[]>({
    queryKey: [`/api/student/${studentId}/job-levels`], enabled: !!studentId,
    staleTime: 0, refetchOnMount: "always",
  });
  const loadoutReady = !!student && !!jobLevels && !studentFetching && !levelsFetching && !studentError && !levelsError;
  const levels = Object.fromEntries((jobLevels || []).map(row => [row.jobClass, row.level])) as Partial<Record<CharacterClass, number>>;
  const canDamage = !!student && hasOffensiveAbility(availableAbilities(
    student.characterClass || "warrior", levels,
    [student.crossClassAbility1, student.crossClassAbility2].filter((id): id is string => !!id),
  ));

  const { data: guild, isLoading: guildLoading } = useQuery<Guild>({
    queryKey: [`/api/guilds/${guildId}`],
    enabled: !!guildId,
  });

  const { data: fights = [], isLoading: fightsLoading } = useQuery<Fight[]>({
    queryKey: [`/api/guilds/${guildId}/fights`],
    enabled: !!guildId,
  });

  const hostSoloMode = async (fightId: string, warned = false) => {
    if (!loadoutReady) return;
    if (!canDamage && !warned) {
      setSoloWarningFightId(fightId);
      return;
    }
    setSoloWarningFightId(null);
    if (!guildId) {
      toast({
        title: "Error",
        description: "Guild context is missing",
        variant: "destructive",
      });
      return;
    }

    setHostingFightId(fightId);

    try {
      const response=await apiRequest('POST', `/api/fights/${fightId}/solo-sessions`, {guildId});
      const room=await response.json();
      localStorage.setItem('sessionId',room.sessionId);
      navigate('/student/combat');
    } catch(error) { setHostingFightId(null); toast({title:'Unable to start solo fight',description:error instanceof Error?error.message:'Try again',variant:'destructive'}); }

  };

  if (guildLoading || fightsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-orange-950 dark:via-amber-950 dark:to-orange-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <div className="h-8 bg-muted rounded w-48 mx-auto"></div>
          </div>
          <p className="text-muted-foreground">Loading fights...</p>
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
              Fight Library
            </h1>
            <p className="text-sm text-muted-foreground">{guild.name}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 flex-1">
        <div className="mb-4 rounded-lg border bg-card p-3"><StaminaBar studentId={studentId} /></div>
        {(studentError || levelsError) && <p role="alert" className="mb-4 text-sm">Unable to check your loadout for solo play. <Button variant="outline" onClick={() => { refetchStudent(); refetchLevels(); }}>Retry loadout check</Button></p>}
        <p className="mb-4 text-sm">Playing with a partner or group? <Link href="/student" className="underline">Join a teacher-hosted fight with its session code</Link>.</p>
        <Dialog open={!!soloWarningFightId} onOpenChange={open => { if (!open) setSoloWarningFightId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>No offensive ability equipped</DialogTitle>
              <DialogDescription>Your current loadout can heal and support, but cannot damage enemies or win this fight alone. Solo rooms are private. Join a teacher-hosted group using its session code, or equip an offensive cross-class ability before playing solo.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate("/student")}>Join a group fight</Button>
              <Button variant="outline" onClick={() => navigate("/student/equipment")}>Change loadout</Button>
              <Button variant="outline" onClick={() => soloWarningFightId && hostSoloMode(soloWarningFightId, true)}>Continue solo anyway</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" />
              Available Fights ({fights.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {fights.map((fight) => {
                  const isHosting = hostingFightId === fight.id;
                  return (
                    <Card
                      key={fight.id}
                      className="hover-elevate"
                      data-testid={`fight-card-${fight.id}`}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <h3 className="font-bold text-lg mb-1">{fight.title}</h3>
                          {fight.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {fight.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1">
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {fight.questionCount ?? fight.questions?.length ?? 0} Questions
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {fight.enemies?.length || 0} Enemies
                            </span>
                          </div>
                        </div>

                        {fight.soloModeEnabled && (
                          <Button
                            className="w-full"
                            onClick={() => hostSoloMode(fight.id)}
                            disabled={isHosting || !loadoutReady}
                            data-testid={`button-host-solo-${fight.id}`}
                          >
                            {isHosting ? "Starting..." : "Host Solo Mode"}
                          </Button>
                        )}
                        
                        {!fight.soloModeEnabled && (
                          <Badge variant="secondary" className="w-full justify-center">
                            Teacher-hosted only
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Swords className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold text-muted-foreground">No fights available</p>
                <p className="text-sm text-muted-foreground mt-2">Check back later for new challenges!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
