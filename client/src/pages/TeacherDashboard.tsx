import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Swords, Users, BarChart3, Copy, Edit, LogOut, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Fight } from "@shared/schema";

export default function TeacherDashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const teacherId = localStorage.getItem("teacherId");
  const teacherGuildCode = localStorage.getItem("teacherGuildCode") || "";

  const handleLogout = () => {
    localStorage.removeItem("teacherId");
    localStorage.removeItem("teacherGuildCode");
    navigate("/");
    toast({ title: "Logged out", description: "You have been logged out successfully" });
  };
  
  // B10 FIX: Auto-refresh fights to show updated data
  const { data: fights, isLoading } = useQuery<Fight[]>({
    queryKey: [`/api/teacher/${teacherId}/fights`],
    enabled: !!teacherId,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 5000, // Poll every 5s to catch fight updates
  });

  const deleteFightMutation = useMutation({
    mutationFn: async (fightId: string) => {
      return await apiRequest("DELETE", `/api/fights/${fightId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teacher/${teacherId}/fights`] });
      toast({ title: "Fight deleted", description: "The fight has been removed" });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to delete fight", 
        variant: "destructive" 
      });
    },
  });

  const copyGuildCode = (guildCode: string) => {
    navigator.clipboard.writeText(guildCode);
    toast({ title: "Guild code copied!", description: "Share this code with your students" });
  };

  const handleDeleteFight = (fightId: string) => {
    if (confirm("Are you sure you want to delete this fight? This cannot be undone.")) {
      deleteFightMutation.mutate(fightId);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-950">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-title">
            Quest Master
          </h1>
          <div className="flex gap-2">
            <Link href="/teacher/items">
              <Button variant="outline" size="default" data-testid="button-manage-items">
                <Swords className="mr-2 h-5 w-5" />
                Manage Items
              </Button>
            </Link>
            <Link href="/teacher/guilds">
              <Button variant="outline" size="default" data-testid="button-manage-guilds">
                <Shield className="mr-2 h-5 w-5" />
                Manage Guilds
              </Button>
            </Link>
            <Link href="/teacher/stats">
              <Button variant="outline" size="default" data-testid="button-view-stats">
                <BarChart3 className="mr-2 h-5 w-5" />
                Statistics
              </Button>
            </Link>
            <Button variant="outline" size="default" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="mr-2 h-5 w-5" />
              Logout
            </Button>
            <Link href="/teacher/create">
              <Button size="default" data-testid="button-create-fight">
                <PlusCircle className="mr-2 h-5 w-5" />
                Create Fight
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {teacherGuildCode && (
          <Card className="mb-6 bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Your Guild Code</h3>
                  <p className="text-sm text-muted-foreground">Share this code with students to auto-enroll them in your guild</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xl font-mono px-4 py-2" data-testid="badge-teacher-guild-code">
                    {teacherGuildCode}
                  </Badge>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyGuildCode(teacherGuildCode)}
                    data-testid="button-copy-teacher-guild-code"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-8">
          <h2 className="text-4xl font-serif font-bold mb-2" data-testid="text-page-title">
            Your Battles
          </h2>
          <p className="text-muted-foreground">
            Create epic quiz battles and launch them for your students
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : fights && fights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fights.map((fight) => (
              <Card key={fight.id} className="hover-elevate" data-testid={`card-fight-${fight.id}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Swords className="h-5 w-5 text-primary" />
                    {fight.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    {fight.guildCode ? (
                      <>
                        <span className="text-xs text-muted-foreground">Guild Code:</span>
                        <Badge variant="secondary" className="font-mono" data-testid={`badge-guild-code-${fight.id}`}>
                          {fight.guildCode}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyGuildCode(fight.guildCode!)}
                          data-testid={`button-copy-code-${fight.id}`}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">No guild assigned</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{fight.questions.length} Questions</span>
                    <span>{fight.enemies.length} Enemies</span>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Link href={`/teacher/edit/${fight.id}`} className="flex-1">
                    <Button variant="outline" className="w-full" data-testid={`button-edit-${fight.id}`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </Link>
                  <Link href={`/teacher/host/${fight.id}`} className="flex-1">
                    <Button variant="default" className="w-full" data-testid={`button-host-${fight.id}`}>
                      <Users className="mr-2 h-4 w-4" />
                      Launch Host
                    </Button>
                  </Link>
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    onClick={() => handleDeleteFight(fight.id)}
                    disabled={deleteFightMutation.isPending}
                    data-testid={`button-delete-${fight.id}`}
                  >
                    <span className="sr-only">Delete</span>
                    ×
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Swords className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No fights yet</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Create your first quiz battle and start engaging your students with epic RPG-themed learning
              </p>
              <Link href="/teacher/create">
                <Button size="lg" data-testid="button-create-first">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Create Your First Fight
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
