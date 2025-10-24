import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, Trophy, Shield, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type Guild } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function StudentGuilds() {
  const { toast } = useToast();
  const studentId = localStorage.getItem("studentId");
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [guildCode, setGuildCode] = useState("");

  const { data: myGuilds, isLoading } = useQuery<Guild[]>({
    queryKey: [`/api/student/${studentId}/guilds`],
    enabled: !!studentId,
  });

  const joinGuildMutation = useMutation({
    mutationFn: async (code: string) => {
      const guildsData = await fetch(`/api/guilds/code/${code.toUpperCase()}`).then(r => r.json());
      if (!guildsData) {
        throw new Error("Guild not found");
      }
      return await apiRequest("POST", `/api/guilds/${guildsData.id}/members`, {
        studentId: studentId!,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/student/${studentId}/guilds`] });
      toast({ title: "Joined guild!", description: "You have successfully joined the guild" });
      setJoinDialogOpen(false);
      setGuildCode("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join guild. The guild may not exist or you may already be a member.",
        variant: "destructive",
      });
    },
  });

  const handleJoinGuild = () => {
    if (!guildCode.trim()) {
      toast({ title: "Please enter a guild code", variant: "destructive" });
      return;
    }
    joinGuildMutation.mutate(guildCode.trim());
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/student/lobby">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-title">
              My Guilds
            </h1>
          </div>
          <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-join-guild">
                <Plus className="mr-2 h-4 w-4" />
                Join Guild
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-join-guild">
              <DialogHeader>
                <DialogTitle>Join a Guild</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="guild-code">Guild Code</Label>
                  <Input
                    id="guild-code"
                    placeholder="Enter 6-character code"
                    maxLength={6}
                    value={guildCode}
                    onChange={(e) => setGuildCode(e.target.value.toUpperCase())}
                    data-testid="input-guild-code"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Ask your teacher for the guild code
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleJoinGuild}
                  disabled={joinGuildMutation.isPending}
                  data-testid="button-submit-join"
                >
                  {joinGuildMutation.isPending ? "Joining..." : "Join Guild"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-4xl font-serif font-bold mb-2" data-testid="text-page-title">
            Your Guilds
          </h2>
          <p className="text-muted-foreground">
            Join guilds to collaborate with classmates and earn rewards
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : myGuilds && myGuilds.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myGuilds.map((guild) => (
              <Card key={guild.id} className="hover-elevate active-elevate-2" data-testid={`card-guild-${guild.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg" data-testid={`text-guild-name-${guild.id}`}>
                      {guild.name}
                    </CardTitle>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Trophy className="h-3 w-3" />
                      Lv {guild.level}
                    </Badge>
                  </div>
                  {guild.description && (
                    <CardDescription className="line-clamp-2">
                      {guild.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>Members</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Trophy className="h-4 w-4" />
                      <span>{guild.experience} XP</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Link href={`/student/guild/${guild.id}`} className="w-full">
                    <Button variant="default" className="w-full" data-testid={`button-view-${guild.id}`}>
                      View Guild
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Shield className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No guilds yet</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Join a guild to team up with classmates, complete quests, and climb the leaderboard
              </p>
              <Button onClick={() => setJoinDialogOpen(true)} data-testid="button-join-first-guild">
                <Plus className="mr-2 h-5 w-5" />
                Join Your First Guild
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
