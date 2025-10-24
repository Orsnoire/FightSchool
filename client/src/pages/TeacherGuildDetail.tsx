import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Trophy, Swords, UserMinus, Copy, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Guild, type GuildMembership, type Fight } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";

const guildSettingsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

type GuildSettingsData = z.infer<typeof guildSettingsSchema>;

export default function TeacherGuildDetail() {
  const [, params] = useRoute("/teacher/guild/:id");
  const guildId = params?.id;
  const { toast } = useToast();
  const teacherId = localStorage.getItem("teacherId");

  const { data: guild, isLoading: guildLoading } = useQuery<Guild>({
    queryKey: [`/api/guilds/${guildId}`],
    enabled: !!guildId,
  });

  const { data: members } = useQuery<GuildMembership[]>({
    queryKey: [`/api/guilds/${guildId}/members`],
    enabled: !!guildId,
  });

  const { data: assignedFights } = useQuery<Fight[]>({
    queryKey: [`/api/guilds/${guildId}/fights`],
    enabled: !!guildId,
  });

  const { data: allFights } = useQuery<Fight[]>({
    queryKey: [`/api/teacher/${teacherId}/fights`],
    enabled: !!teacherId,
  });

  const { data: leaderboard } = useQuery<any[]>({
    queryKey: [`/api/guilds/${guildId}/leaderboard`, "damageDealt"],
    enabled: !!guildId,
  });

  const settingsForm = useForm<GuildSettingsData>({
    resolver: zodResolver(guildSettingsSchema),
    values: {
      name: guild?.name || "",
      description: guild?.description || "",
    },
  });

  const updateGuildMutation = useMutation({
    mutationFn: async (data: GuildSettingsData) => {
      return await apiRequest("PATCH", `/api/guilds/${guildId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${guildId}`] });
      toast({ title: "Guild updated", description: "Guild settings saved successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update guild",
        variant: "destructive",
      });
    },
  });

  const assignFightMutation = useMutation({
    mutationFn: async (fightId: string) => {
      return await apiRequest("POST", `/api/guilds/${guildId}/fights`, { fightId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${guildId}/fights`] });
      toast({ title: "Fight assigned", description: "Fight assigned to guild" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign fight",
        variant: "destructive",
      });
    },
  });

  const unassignFightMutation = useMutation({
    mutationFn: async (fightId: string) => {
      return await apiRequest("DELETE", `/api/guilds/${guildId}/fights/${fightId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${guildId}/fights`] });
      toast({ title: "Fight unassigned", description: "Fight removed from guild" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to unassign fight",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (studentId: string) => {
      return await apiRequest("DELETE", `/api/guilds/${guildId}/members/${studentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${guildId}/members`] });
      toast({ title: "Member removed", description: "Student removed from guild" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    },
  });

  const copyGuildCode = () => {
    if (guild) {
      navigator.clipboard.writeText(guild.code);
      toast({ title: "Guild code copied!", description: "Students can use this code to join the guild" });
    }
  };

  const handleUpdateSettings = (data: GuildSettingsData) => {
    updateGuildMutation.mutate(data);
  };

  const handleRemoveMember = (studentId: string) => {
    if (confirm("Are you sure you want to remove this member from the guild?")) {
      removeMemberMutation.mutate(studentId);
    }
  };

  const assignedFightIds = new Set(assignedFights?.map(f => f.id) || []);
  const unassignedFights = allFights?.filter(f => !assignedFightIds.has(f.id)) || [];

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
            <Link href="/teacher/guilds">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-guild-name">
                {guild.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="font-mono" data-testid="text-guild-code">
                  {guild.code}
                </Badge>
                <Button variant="ghost" size="icon" onClick={copyGuildCode} data-testid="button-copy-code">
                  <Copy className="h-3 w-3" />
                </Button>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  Level {guild.level}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4" data-testid="tabs-guild-management">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="members" data-testid="tab-members">Members</TabsTrigger>
            <TabsTrigger value="fights" data-testid="tab-fights">Assigned Fights</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold flex items-center gap-2">
                    <Users className="h-6 w-6 text-primary" />
                    {members?.length || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total XP</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold flex items-center gap-2">
                    <Trophy className="h-6 w-6 text-amber-500" />
                    {guild.experience}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Assigned Fights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold flex items-center gap-2">
                    <Swords className="h-6 w-6 text-destructive" />
                    {assignedFights?.length || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Top Contributors</CardTitle>
                <CardDescription>Guild leaderboard by damage dealt</CardDescription>
              </CardHeader>
              <CardContent>
                {leaderboard && leaderboard.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboard.slice(0, 5).map((entry, index) => (
                      <div
                        key={entry.studentId}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        data-testid={`leaderboard-entry-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="w-8 justify-center">
                            {index + 1}
                          </Badge>
                          <div>
                            <p className="font-medium">{entry.nickname}</p>
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
                    No leaderboard data yet. Assign fights and have members complete them!
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Guild Roster</CardTitle>
                <CardDescription>
                  {members?.length || 0} member{members?.length !== 1 ? 's' : ''} in this guild
                </CardDescription>
              </CardHeader>
              <CardContent>
                {members && members.length > 0 ? (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                        data-testid={`member-${member.studentId}`}
                      >
                        <div>
                          <p className="font-medium" data-testid={`member-name-${member.studentId}`}>
                            Student {member.studentId.slice(0, 8)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.studentId)}
                          data-testid={`button-remove-${member.studentId}`}
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No members yet. Share the guild code with students to let them join!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fights" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Assigned Fights</CardTitle>
                  <CardDescription>Fights that award XP to this guild</CardDescription>
                </CardHeader>
                <CardContent>
                  {assignedFights && assignedFights.length > 0 ? (
                    <div className="space-y-2">
                      {assignedFights.map((fight) => (
                        <div
                          key={fight.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                          data-testid={`assigned-fight-${fight.id}`}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{fight.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {fight.questions?.length || 0} questions
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unassignFightMutation.mutate(fight.id)}
                            data-testid={`button-unassign-${fight.id}`}
                          >
                            Unassign
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No fights assigned yet
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Available Fights</CardTitle>
                  <CardDescription>Assign fights to award guild XP</CardDescription>
                </CardHeader>
                <CardContent>
                  {unassignedFights.length > 0 ? (
                    <div className="space-y-2">
                      {unassignedFights.map((fight) => (
                        <div
                          key={fight.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                          data-testid={`unassigned-fight-${fight.id}`}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{fight.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {fight.questions?.length || 0} questions
                            </p>
                          </div>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => assignFightMutation.mutate(fight.id)}
                            data-testid={`button-assign-${fight.id}`}
                          >
                            Assign
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      All fights are assigned
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Guild Settings</CardTitle>
                <CardDescription>Update guild information</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...settingsForm}>
                  <form onSubmit={settingsForm.handleSubmit(handleUpdateSettings)} className="space-y-4">
                    <FormField
                      control={settingsForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guild Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Dragon Slayers"
                              data-testid="input-settings-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={settingsForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="A mighty guild of brave adventurers..."
                              data-testid="input-settings-description"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={updateGuildMutation.isPending}
                      data-testid="button-save-settings"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {updateGuildMutation.isPending ? "Saving..." : "Save Settings"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
