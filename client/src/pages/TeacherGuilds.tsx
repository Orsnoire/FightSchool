import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, PlusCircle, Users, Trophy, Archive, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertGuildSchema, type Guild } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";

const guildFormSchema = insertGuildSchema.pick({
  name: true,
  description: true,
});

type GuildFormData = z.infer<typeof guildFormSchema>;

export default function TeacherGuilds() {
  const { toast } = useToast();
  const teacherId = localStorage.getItem("teacherId");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: guilds, isLoading } = useQuery<Guild[]>({
    queryKey: [`/api/teacher/${teacherId}/guilds`],
    enabled: !!teacherId,
  });

  const form = useForm<GuildFormData>({
    resolver: zodResolver(guildFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createGuildMutation = useMutation({
    mutationFn: async (data: GuildFormData) => {
      return await apiRequest("POST", "/api/guilds", {
        ...data,
        teacherId: teacherId!,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teacher/${teacherId}/guilds`] });
      toast({ title: "Guild created", description: "Your new guild has been created successfully" });
      setCreateDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create guild",
        variant: "destructive",
      });
    },
  });

  const archiveGuildMutation = useMutation({
    mutationFn: async (guildId: string) => {
      return await apiRequest("PATCH", `/api/guilds/${guildId}`, {
        isArchived: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teacher/${teacherId}/guilds`] });
      toast({ title: "Guild archived", description: "The guild has been archived" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to archive guild",
        variant: "destructive",
      });
    },
  });

  const unarchiveGuildMutation = useMutation({
    mutationFn: async (guildId: string) => {
      return await apiRequest("PATCH", `/api/guilds/${guildId}`, {
        isArchived: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teacher/${teacherId}/guilds`] });
      toast({ title: "Guild restored", description: "The guild has been restored" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to restore guild",
        variant: "destructive",
      });
    },
  });

  const copyGuildCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Guild code copied!", description: "Students can use this code to join the guild" });
  };

  const handleCreateGuild = (data: GuildFormData) => {
    createGuildMutation.mutate(data);
  };

  const handleArchiveGuild = (guildId: string) => {
    if (confirm("Are you sure you want to archive this guild? Students won't be able to join or access it.")) {
      archiveGuildMutation.mutate(guildId);
    }
  };

  const activeGuilds = guilds?.filter(g => !g.isArchived) || [];
  const archivedGuilds = guilds?.filter(g => g.isArchived) || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/teacher">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-title">
              Guild Management
            </h1>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-guild">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Guild
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-guild">
              <DialogHeader>
                <DialogTitle>Create New Guild</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateGuild)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guild Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Dragon Slayers"
                            data-testid="input-guild-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="A mighty guild of brave adventurers..."
                            data-testid="input-guild-description"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createGuildMutation.isPending}
                      data-testid="button-submit-guild"
                    >
                      {createGuildMutation.isPending ? "Creating..." : "Create Guild"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
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
            Organize students into guilds, assign quests, and track group progress
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
        ) : activeGuilds.length === 0 && archivedGuilds.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No guilds yet</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Create your first guild to organize students into groups for collaborative learning
              </p>
              <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-guild">
                <PlusCircle className="mr-2 h-5 w-5" />
                Create Your First Guild
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {activeGuilds.length > 0 && (
              <div className="mb-8">
                <h3 className="text-2xl font-serif font-bold mb-4">Active Guilds</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeGuilds.map((guild) => (
                    <Card key={guild.id} className="hover-elevate active-elevate-2" data-testid={`card-guild-${guild.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <CardTitle className="text-lg" data-testid={`text-guild-name-${guild.id}`}>
                              {guild.name}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="font-mono" data-testid={`text-guild-code-${guild.id}`}>
                                {guild.code}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyGuildCode(guild.code);
                                }}
                                data-testid={`button-copy-code-${guild.id}`}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Trophy className="h-3 w-3" />
                            Lv {guild.level}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {guild.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                            {guild.description}
                          </p>
                        )}
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
                      <CardFooter className="flex gap-2">
                        <Link href={`/teacher/guild/${guild.id}`} className="flex-1">
                          <Button variant="default" className="w-full" data-testid={`button-manage-${guild.id}`}>
                            Manage
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleArchiveGuild(guild.id)}
                          data-testid={`button-archive-${guild.id}`}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {archivedGuilds.length > 0 && (
              <div>
                <h3 className="text-2xl font-serif font-bold mb-4 text-muted-foreground">
                  Archived Guilds
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {archivedGuilds.map((guild) => (
                    <Card key={guild.id} className="opacity-60" data-testid={`card-archived-guild-${guild.id}`}>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Archive className="h-4 w-4" />
                          {guild.name}
                        </CardTitle>
                        <CardDescription>{guild.code}</CardDescription>
                      </CardHeader>
                      <CardFooter>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => unarchiveGuildMutation.mutate(guild.id)}
                          data-testid={`button-unarchive-${guild.id}`}
                        >
                          Restore Guild
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
