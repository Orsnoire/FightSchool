import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Swords, Target, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type Guild } from "@shared/schema";

interface Fight {
  id: string;
  title: string;
  description: string;
  questions: any[];
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

  const { data: guild, isLoading: guildLoading } = useQuery<Guild>({
    queryKey: [`/api/guilds/${guildId}`],
    enabled: !!guildId,
  });

  const { data: fights = [], isLoading: fightsLoading } = useQuery<Fight[]>({
    queryKey: [`/api/guilds/${guildId}/fights`],
    enabled: !!guildId,
  });

  const hostSoloMode = async (fightId: string) => {
    if (!guildId) {
      toast({
        title: "Error",
        description: "Guild context is missing",
        variant: "destructive",
      });
      return;
    }

    setHostingFightId(fightId);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
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
                              {fight.questions?.length || 0} Questions
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
                            disabled={isHosting}
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
