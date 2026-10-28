import { StaminaBar } from "@/components/StaminaBar";
import { CampaignBetaLink } from '@/features/campaign/BetaNotice';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CharacterPanel } from "@/features/lobby/CharacterPanel";
import { ClassAbilitiesPanel } from "@/features/lobby/ClassAbilitiesPanel";
import { ClassAppearanceDialog } from "@/features/lobby/ClassAppearanceDialog";
import { CrossClassPanel } from "@/features/lobby/CrossClassPanel";
import { EquipmentPanel } from "@/features/lobby/EquipmentPanel";
import { GuildPicker } from "@/features/lobby/GuildPicker";
import { createLobbyPreview } from "@/features/lobby/preview";
import { ProgressionPanel } from "@/features/lobby/ProgressionPanel";
import type { LobbyStudent } from "@/features/lobby/types";
import { useClassAppearance } from "@/features/lobby/useClassAppearance";
import { useLoadoutActions } from "@/features/lobby/useLoadoutActions";
import { useLobbyEquipment } from "@/features/lobby/useLobbyEquipment";
import { useToast } from "@/hooks/use-toast";
import { useStudentLoadout } from "@/hooks/useStudentLoadout";
import { type Guild } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, LogOut, ShoppingBag, Swords, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

export default function Lobby() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [sessionCode, setSessionCode] = useState("");
  const [showGuildDialog, setShowGuildDialog] = useState(false);
  const studentId = localStorage.getItem("studentId");
  const { student, jobLevels, isFetching: loadoutFetching, isError: loadoutError } = useStudentLoadout(studentId);
  useEffect(() => {
    if (student && (!student.characterClass || !student.gender)) navigate('/student/character-select');
  }, [student, navigate]);

  const { equippedItems, inventoryItems, equippedItemsMap, equippedVisuals, equipmentFetching, equipmentError } = useLobbyEquipment(student);
  const { updateEquipment, updateCrossClassAbility } = useLoadoutActions(studentId);
  const appearance = useClassAppearance(studentId, student);

  // Fetch student's guilds
  const { data: studentGuilds = [] } = useQuery<Guild[]>({
    queryKey: [`/api/student/${studentId}/guilds`],
    enabled: !!studentId,
  });

  const joinFight = async () => {
    if (!sessionCode.trim()) {
      toast({ title: "Please enter a session code", variant: "destructive" });
      return;
    }

    // Validate session exists and is active
    const response = await fetch(`/api/sessions/${sessionCode.trim().toUpperCase()}`);
    if (!response.ok) {
      const errorData = await response.json();
      toast({
        title: "Cannot join session",
        description: errorData.error || "Invalid session code or session has ended",
        variant: "destructive"
      });
      return;
    }

    const sessionInfo = await response.json();
    localStorage.setItem("sessionId", sessionInfo.sessionId);
    navigate("/student/combat");
  };

  const handleLogout = async () => {
    await fetch("/api/student/logout", { method: "POST" });
    localStorage.removeItem("studentId");
    localStorage.removeItem("sessionId");
    navigate("/");
  };

  if (!student || !student.characterClass || !student.gender) {
    return <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-black flex items-center justify-center">Loading...</div>;
  }

  const readyStudent = student as LobbyStudent;
  const { previewStats, previewPlayer } = createLobbyPreview(readyStudent, jobLevels, equippedItems);
  const showAbilityValues = !loadoutFetching && !loadoutError && !equipmentFetching && !equipmentError && jobLevels.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-black">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold" data-testid="text-lobby-title">
            Battle Lobby
          </h1>
          <div className="flex flex-wrap gap-2">
            <Link href="/student/advancement"><Button variant="outline" data-testid="button-advancement">Advancement</Button></Link>
            <CampaignBetaLink />
            <Link href="/student/guilds">
              <Button variant="outline" data-testid="button-my-guilds">
                <Users className="mr-2 h-4 w-4" />
                My Guilds
              </Button>
            </Link>
            <Link href="/student/shop">
              <Button variant="outline" data-testid="button-guild-shop">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Guild Shop
              </Button>
            </Link>
            <Link href={`/student/${studentId}/stats`}>
              <Button variant="outline" data-testid="button-view-stats">
                <BarChart3 className="mr-2 h-4 w-4" />
                Stats
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-4 rounded-lg border bg-card p-3"><StaminaBar studentId={studentId} /></div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <CharacterPanel student={readyStudent} equippedItemsMap={equippedItemsMap} equippedVisuals={equippedVisuals} savedAppearance={appearance.savedAppearance} openClassModal={appearance.openClassModal} />

            <ProgressionPanel student={readyStudent} jobLevels={jobLevels} previewStats={previewStats} />

            {/* Abilities Card */}
            <ClassAbilitiesPanel student={readyStudent} jobLevels={jobLevels} previewPlayer={previewPlayer} showAbilityValues={showAbilityValues} />
          </div>

          <div className="lg:col-span-3">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Your Guilds
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Access guild fights and collaborate with your classmates
                </p>
                <Button
                  onClick={() => setShowGuildDialog(true)}
                  className="w-full"
                  data-testid="button-view-guilds"
                >
                  <Users className="mr-2 h-4 w-4" />
                  View Guilds
                </Button>
              </CardContent>
            </Card>

            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Swords className="h-5 w-5 text-primary" />
                  Join Battle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="session-code">Session Code</Label>
                  <Input
                    id="session-code"
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                    placeholder="Enter 6-character session code"
                    maxLength={6}
                    className="font-mono text-lg tracking-widest"
                    data-testid="input-session-code"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        joinFight();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Your teacher will give you a class code to enter here
                  </p>
                </div>
                <Button onClick={joinFight} className="w-full" data-testid="button-join-fight">
                  <Swords className="mr-2 h-4 w-4" />
                  Join Battle
                </Button>
              </CardContent>
            </Card>

            <EquipmentPanel student={readyStudent} jobLevels={jobLevels} inventoryItems={inventoryItems} equippedItemsMap={equippedItemsMap}
              loadoutFetching={loadoutFetching} equipmentFetching={equipmentFetching} loadoutError={loadoutError} equipmentError={equipmentError} updateEquipment={updateEquipment} />

            {/* Cross-Class Abilities */}
            <CrossClassPanel student={readyStudent} jobLevels={jobLevels} updateCrossClassAbility={updateCrossClassAbility} />
          </div>
        </div>
      </main>

      {/* Class Selection Modal */}
      <ClassAppearanceDialog student={readyStudent} jobLevels={jobLevels} equippedVisuals={equippedVisuals} controller={appearance} />

      {/* Guild Selection Dialog */}
      <GuildPicker studentGuilds={studentGuilds} showGuildDialog={showGuildDialog} setShowGuildDialog={setShowGuildDialog} navigate={navigate} />
    </div>
  );
}
