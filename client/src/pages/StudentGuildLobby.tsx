import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Users, Trophy, Scroll, Swords, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { type Guild, type Student, type StudentJobLevel, type CharacterClass, ALL_CHARACTER_CLASSES } from "@shared/schema";

interface GuildMemberWithStudent {
  id: string;
  studentId: string;
  joinedAt: number;
  nickname: string;
  characterClass: string;
}

interface LeaderboardEntry {
  studentId: string;
  nickname: string;
  characterClass: string;
  totalDamageDealt: number;
  fightsCompleted: number;
}

interface Quest {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  isCompleted: boolean;
}

interface Fight {
  id: string;
  title: string;
  questions: any[];
  enemies: any[];
  soloModeEnabled: boolean;
}

export default function StudentGuildLobby() {
  const [, params] = useRoute("/student/guild-lobby/:id");
  const [, navigate] = useLocation();
  const guildId = params?.id;
  const { toast } = useToast();
  const studentId = localStorage.getItem("studentId");
  const [hostingFightId, setHostingFightId] = useState<string | null>(null);
  const [showClassModal, setShowClassModal] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [jobLevels, setJobLevels] = useState<StudentJobLevel[]>([]);

  // Fetch guild data
  const { data: guild, isLoading: guildLoading } = useQuery<Guild>({
    queryKey: [`/api/guilds/${guildId}`],
    enabled: !!guildId,
  });

  // Fetch student data
  const { data: studentData } = useQuery<Student>({
    queryKey: [`/api/student/${studentId}`],
    enabled: !!studentId,
  });

  // Fetch job levels
  const { data: jobLevelsData } = useQuery<StudentJobLevel[]>({
    queryKey: [`/api/student/${studentId}/job-levels`],
    enabled: !!studentId,
  });

  // Update student and jobLevels when data is fetched
  if (studentData && student?.id !== studentData.id) {
    setStudent(studentData);
  }
  if (jobLevelsData && jobLevelsData.length !== jobLevels.length) {
    setJobLevels(jobLevelsData);
  }

  // Fetch guild members
  const { data: members = [] } = useQuery<GuildMemberWithStudent[]>({
    queryKey: [`/api/guilds/${guildId}/members`],
    enabled: !!guildId,
  });

  // Fetch leaderboard
  const { data: leaderboard = [] } = useQuery<LeaderboardEntry[]>({
    queryKey: [`/api/guilds/${guildId}/leaderboard`, "damageDealt"],
    enabled: !!guildId,
  });

  // Fetch quests
  const { data: quests = [] } = useQuery<Quest[]>({
    queryKey: [`/api/guilds/${guildId}/quests`],
    enabled: !!guildId,
  });

  // Fetch fights
  const { data: fights = [] } = useQuery<Fight[]>({
    queryKey: [`/api/guilds/${guildId}/fights`],
    enabled: !!guildId,
  });

  const handleClassChange = async (newClass: CharacterClass) => {
    if (!student?.gender) return;
    if (newClass === student.characterClass) {
      setShowClassModal(false);
      return;
    }
    
    const response = await fetch(`/api/student/${studentId}/character`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterClass: newClass, gender: student.gender }),
    });

    if (response.ok) {
      const updatedStudent = await response.json();
      setStudent(updatedStudent);
      setShowClassModal(false);
      toast({ 
        title: "Class changed!", 
        description: `You are now a ${newClass}` 
      });
      
      // Reload job levels to reflect new current class
      const jobResponse = await fetch(`/api/student/${studentId}/job-levels`);
      if (jobResponse.ok) {
        setJobLevels(await jobResponse.json());
      }
    } else {
      toast({ 
        title: "Failed to change class", 
        variant: "destructive" 
      });
    }
  };

  const hostSoloMode = async (fightId: string) => {
    setHostingFightId(fightId);

    // Create WebSocket connection to host solo mode
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      // Send host_solo message
      socket.send(JSON.stringify({
        type: "host_solo",
        studentId: studentId,
        fightId: fightId,
      }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "session_created" || message.type === "solo_session_created") {
        // Solo session created successfully
        localStorage.setItem("sessionId", message.sessionId);
        socket.close();
        toast({
          title: "Solo session created!",
          description: `Session code: ${message.sessionId}`,
        });
        navigate("/student/combat");
      } else if (message.type === "error") {
        socket.close();
        setHostingFightId(null);
        toast({
          title: "Failed to host solo mode",
          description: message.message || "The fight may not have solo mode enabled",
          variant: "destructive",
        });
      }
    };

    socket.onerror = () => {
      socket.close();
      setHostingFightId(null);
      toast({
        title: "Connection error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    };
  };

  if (guildLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-orange-950 dark:via-amber-950 dark:to-orange-900 flex items-center justify-center">
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
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-orange-950 dark:via-amber-950 dark:to-orange-900 flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Guild not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Top 5 leaderboard entries
  const top5Leaderboard = leaderboard.slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 dark:from-orange-950 dark:via-amber-950 dark:to-orange-900 flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/student/lobby">
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
            onClick={() => setShowClassModal(true)} 
            data-testid="button-change-job"
          >
            Change Job
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 flex-1 flex flex-col gap-6 overflow-hidden">
        {/* Top Section - 40% height with 3-column widget grid */}
        <div className="h-[40%] min-h-[300px]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {/* Roster Widget */}
            <Card className="flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Roster
                </CardTitle>
                <CardDescription>
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  {members.length > 0 ? (
                    <div className="space-y-2">
                      {members.map((member) => (
                        <div
                          key={member.studentId}
                          className={`p-2 rounded-md ${
                            member.studentId === studentId
                              ? 'bg-primary/10 border border-primary'
                              : 'bg-muted/50'
                          }`}
                          data-testid={`roster-member-${member.studentId}`}
                        >
                          <p className="font-medium text-sm">
                            {member.nickname}
                            {member.studentId === studentId && (
                              <span className="ml-2 text-xs text-primary">(You)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {member.characterClass || 'No class'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No members yet
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Leaderboard Widget */}
            <Card className="flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-primary" />
                  Leaderboard
                </CardTitle>
                <CardDescription>Top 5 by damage dealt</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  {top5Leaderboard.length > 0 ? (
                    <div className="space-y-2">
                      {top5Leaderboard.map((entry, index) => (
                        <div
                          key={entry.studentId}
                          className={`p-2 rounded-md ${
                            entry.studentId === studentId
                              ? 'bg-primary/10 border border-primary'
                              : 'bg-muted/50'
                          }`}
                          data-testid={`leaderboard-entry-${index}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge
                                variant={index < 3 ? "default" : "outline"}
                                className="flex-shrink-0 w-6 h-6 flex items-center justify-center p-0 text-xs"
                              >
                                {index + 1}
                              </Badge>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {entry.nickname}
                                  {entry.studentId === studentId && (
                                    <span className="ml-1 text-xs text-primary">(You)</span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize truncate">
                                  {entry.characterClass}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-sm text-destructive">
                                {entry.totalDamageDealt}
                              </p>
                              <p className="text-xs text-muted-foreground">DMG</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No leaderboard data yet
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Quests Widget */}
            <Card className="flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Scroll className="h-5 w-5 text-primary" />
                  Quests
                </CardTitle>
                <CardDescription>Active guild quests</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  {quests.length > 0 ? (
                    <div className="space-y-3">
                      {quests.map((quest) => (
                        <div
                          key={quest.id}
                          className="p-2 rounded-md bg-muted/50 space-y-1"
                          data-testid={`quest-${quest.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm">{quest.title}</p>
                            {quest.isCompleted && (
                              <Badge variant="default" className="text-xs">
                                Complete
                              </Badge>
                            )}
                          </div>
                          {quest.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {quest.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary rounded-full h-2 transition-all"
                                style={{
                                  width: `${Math.min(100, (quest.progress / quest.target) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {quest.progress}/{quest.target}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No active quests
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Section - 60% height with fight cards grid */}
        <div className="h-[60%] min-h-[400px]">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-primary" />
                Guild Fights
              </CardTitle>
              <CardDescription>Practice these fights in solo mode</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {fights.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                    {fights.map((fight) => (
                      <Card
                        key={fight.id}
                        className="hover-elevate"
                        data-testid={`fight-card-${fight.id}`}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div>
                            <h3 className="font-semibold text-lg mb-2">{fight.title}</h3>
                            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Target className="h-4 w-4" />
                                <span>{fight.questions?.length || 0} Questions</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Swords className="h-4 w-4" />
                                <span>{fight.enemies?.length || 0} Enemies</span>
                              </div>
                            </div>
                          </div>
                          {fight.soloModeEnabled ? (
                            <Button
                              className="w-full"
                              onClick={() => hostSoloMode(fight.id)}
                              disabled={hostingFightId === fight.id}
                              data-testid={`button-host-fight-${fight.id}`}
                            >
                              {hostingFightId === fight.id ? "Hosting..." : "Host Fight"}
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              className="w-full"
                              disabled
                              data-testid={`button-host-fight-${fight.id}`}
                            >
                              Solo Mode Disabled
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Swords className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No fights assigned to this guild yet</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Class Selection Modal */}
      <Dialog open={showClassModal} onOpenChange={setShowClassModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif">Select Your Class</DialogTitle>
            <DialogDescription>
              Choose a class to change to. Your progress in all jobs is saved.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {(() => {
              // Convert job levels array to map
              const jobLevelMap: Record<CharacterClass, number> = {
                warrior: 0, wizard: 0, scout: 0, herbalist: 0, warlock: 0,
              };
              
              jobLevels.forEach(jl => {
                jobLevelMap[jl.jobClass] = jl.level;
              });
              
              return ALL_CHARACTER_CLASSES.map((classType) => {
                const level = jobLevelMap[classType] || 0;
                const isCurrentClass = student?.characterClass === classType;
                
                return (
                  <Card
                    key={classType}
                    className={`cursor-pointer hover-elevate transition-all ${
                      isCurrentClass ? "ring-2 ring-primary bg-primary/5" : ""
                    }`}
                    onClick={() => handleClassChange(classType)}
                    data-testid={`modal-class-${classType}`}
                  >
                    <CardContent className="p-4 flex flex-col items-center gap-3">
                      <div className="relative">
                        <PlayerAvatar
                          characterClass={classType}
                          gender={student?.gender || "A"}
                          size="md"
                        />
                        <Badge 
                          className="absolute -bottom-2 -right-2 h-6 w-6 flex items-center justify-center p-0 rounded-full text-xs font-bold"
                          variant={level > 0 ? "default" : "secondary"}
                        >
                          {level}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold capitalize text-sm">
                          {classType.replace('_', ' ')}
                        </p>
                        {isCurrentClass && (
                          <p className="text-xs text-primary mt-1">Current</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
