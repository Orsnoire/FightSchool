import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Users, Trophy, Scroll, Swords, Target, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { type Guild, type Student, type StudentJobLevel, type CharacterClass, ALL_CHARACTER_CLASSES, type CombatState } from "@shared/schema";

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
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [showClassModal, setShowClassModal] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [jobLevels, setJobLevels] = useState<StudentJobLevel[]>([]);

  // Validate guild ID exists in URL - redirect to student dashboard if missing
  useEffect(() => {
    if (!guildId) {
      toast({
        title: "Invalid guild URL",
        description: "Please select a guild from your dashboard",
        variant: "destructive",
      });
      navigate("/student");
    }
  }, [guildId, navigate, toast]);

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

  // Fetch fights
  const { data: fights = [] } = useQuery<Fight[]>({
    queryKey: [`/api/guilds/${guildId}/fights`],
    enabled: !!guildId,
  });

  // Fetch active solo sessions
  const { data: activeSessions = [] } = useQuery<CombatState[]>({
    queryKey: [`/api/guilds/${guildId}/active-sessions`],
    enabled: !!guildId,
    refetchInterval: 5000, // Poll every 5 seconds for active sessions
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
    // Defensive check - ensure guildId exists (should always be true due to useEffect guard)
    if (!guildId) {
      toast({
        title: "Error",
        description: "Guild context is missing. Please return to your dashboard and select a guild.",
        variant: "destructive",
      });
      return;
    }

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
        guildId: guildId,
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

  const joinSession = (sessionId: string) => {
    setJoiningSessionId(sessionId);
    localStorage.setItem("sessionId", sessionId);
    navigate("/student/combat");
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

  // Get fight data for active sessions and sort by oldest first (sessionId is generated chronologically)
  const sessionsWithFightData = activeSessions
    .map(session => {
      const fight = fights.find(f => f.id === session.fightId);
      return { session, fight };
    })
    .filter(item => item.fight)
    .sort((a, b) => a.session.sessionId.localeCompare(b.session.sessionId));

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

      <main className="container mx-auto px-4 py-6 flex-1 flex flex-col overflow-hidden">
        {/* Top Third - Navigation Cards */}
        <div className="flex-1 min-h-0 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {/* Roster Navigation Card */}
            <Link href={`/student/guilds/${guildId}/roster`}>
              <Card className="hover-elevate active-elevate-2 cursor-pointer h-full flex flex-col items-center justify-center p-8" data-testid="link-roster">
                <Users className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-serif font-bold mb-2">Guild Roster</h3>
                <p className="text-sm text-muted-foreground text-center">
                  View all {members.length} {members.length === 1 ? 'member' : 'members'}
                </p>
              </Card>
            </Link>

            {/* Leaderboard Navigation Card */}
            <Link href={`/student/guilds/${guildId}/leaderboard`}>
              <Card className="hover-elevate active-elevate-2 cursor-pointer h-full flex flex-col items-center justify-center p-8" data-testid="link-leaderboard">
                <Trophy className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-serif font-bold mb-2">Leaderboard</h3>
                <p className="text-sm text-muted-foreground text-center">
                  View top performers
                </p>
              </Card>
            </Link>

            {/* Fights Navigation Card */}
            <Link href={`/student/guilds/${guildId}/fights`}>
              <Card className="hover-elevate active-elevate-2 cursor-pointer h-full flex flex-col items-center justify-center p-8" data-testid="link-fights">
                <Swords className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-serif font-bold mb-2">Fight Library</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Browse {fights.length} available {fights.length === 1 ? 'fight' : 'fights'}
                </p>
              </Card>
            </Link>
          </div>
        </div>

        {/* Middle Third - Guild Quests */}
        <div className="flex-1 min-h-0 pb-4">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Scroll className="h-5 w-5 text-primary" />
                Guild Quests
              </CardTitle>
              <CardDescription className="text-xs">Complete quests to earn rewards</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Scroll className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-base font-semibold text-muted-foreground">Coming Soon</p>
                <p className="text-xs text-muted-foreground mt-2">Guild quests will be available when the quest system is implemented</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Third - Active Solo Sessions */}
        <div className="flex-1 min-h-0 pb-4">
          <Card className="h-full flex flex-col min-h-0">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5 text-primary" />
                Active Solo Sessions
              </CardTitle>
              <CardDescription className="text-xs">Join an in-progress fight</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full">
                {sessionsWithFightData.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                    {sessionsWithFightData.map(({ session, fight }) => {
                      const playerCount = Object.keys(session.players || {}).length;
                      const enemy = fight!.enemies[0]; // Show first enemy
                      
                      return (
                        <Card
                          key={session.sessionId}
                          className="hover-elevate"
                          data-testid={`session-card-${session.sessionId}`}
                        >
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              {enemy?.image && (
                                <img
                                  src={enemy.image}
                                  alt={enemy.name}
                                  className="w-10 h-10 object-contain"
                                  data-testid={`enemy-icon-${session.sessionId}`}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm truncate">{fight!.title}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {playerCount} {playerCount === 1 ? 'player' : 'players'}
                                </p>
                              </div>
                            </div>
                            <Button
                              className="w-full"
                              size="sm"
                              onClick={() => joinSession(session.sessionId)}
                              disabled={joiningSessionId === session.sessionId}
                              data-testid={`button-join-${session.sessionId}`}
                            >
                              {joiningSessionId === session.sessionId ? 'Joining...' : 'Join'}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">No active sessions</p>
                    <p className="text-xs text-muted-foreground mt-1">Host a fight from the Fights widget to start a session</p>
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
                priest: 0, paladin: 0, dark_knight: 0, blood_knight: 0,
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
