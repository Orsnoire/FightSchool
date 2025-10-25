import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { type Student, type EquipmentSlot, type StudentJobLevel, type CharacterClass, type EquipmentItemDb, type BaseClass, type Guild, BASE_CLASSES, ALL_CHARACTER_CLASSES } from "@shared/schema";
import { LogOut, Swords, BarChart3, TrendingUp, Sword, Shield, Crown, RefreshCw, Heart, Zap, Crosshair, Sparkles, Brain, Wind, Users, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { getTotalPassiveBonuses, getTotalMechanicUpgrades, getCrossClassAbilities } from "@shared/jobSystem";
import { calculateCharacterStats } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

const RARITY_COLORS = {
  common: "border-gray-400",
  rare: "border-blue-500",
  epic: "border-purple-500",
  legendary: "border-yellow-500",
};

export default function Lobby() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [jobLevels, setJobLevels] = useState<StudentJobLevel[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>("weapon");
  const [sessionCode, setSessionCode] = useState("");
  const [showClassModal, setShowClassModal] = useState(false);
  const [showGuildDialog, setShowGuildDialog] = useState(false);
  const [soloFightId, setSoloFightId] = useState("");
  const [isHostingSolo, setIsHostingSolo] = useState(false);
  const studentId = localStorage.getItem("studentId");

  useEffect(() => {
    const loadStudent = async () => {
      const response = await fetch(`/api/student/${studentId}`);
      if (response.ok) {
        const data = await response.json();
        // Redirect to character selection if not completed
        if (!data.characterClass || !data.gender) {
          navigate("/student/character-select");
          return;
        }
        setStudent(data);
      }
    };
    
    const loadJobLevels = async () => {
      const response = await fetch(`/api/student/${studentId}/job-levels`);
      if (response.ok) {
        setJobLevels(await response.json());
      }
    };
    
    loadStudent();
    loadJobLevels();
  }, [studentId, navigate]);

  // Fetch equipped items
  const equippedItemIds = [student?.weapon, student?.headgear, student?.armor].filter(Boolean) as string[];
  const { data: equippedItems = [] } = useQuery<EquipmentItemDb[]>({
    queryKey: ['equipment-items', { ids: equippedItemIds.sort() }],
    queryFn: async () => {
      if (equippedItemIds.length === 0) return [];
      const response = await fetch(`/api/equipment-items?ids=${equippedItemIds.join(',')}`);
      return response.json();
    },
    enabled: equippedItemIds.length > 0,
  });

  // Fetch inventory items
  const inventoryIds = student?.inventory || [];
  const { data: inventoryItems = [] } = useQuery<EquipmentItemDb[]>({
    queryKey: ['equipment-items', { ids: inventoryIds.sort() }],
    queryFn: async () => {
      if (inventoryIds.length === 0) return [];
      const response = await fetch(`/api/equipment-items?ids=${inventoryIds.join(',')}`);
      return response.json();
    },
    enabled: inventoryIds.length > 0,
  });

  // Create a lookup map for equipped items
  const equippedItemsMap = (equippedItems || []).reduce((acc: Record<string, EquipmentItemDb>, item: EquipmentItemDb) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<string, EquipmentItemDb>);

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

  const hostSoloMode = async () => {
    if (!soloFightId.trim()) {
      toast({ title: "Please enter a fight ID", variant: "destructive" });
      return;
    }

    setIsHostingSolo(true);

    // Create WebSocket connection to host solo mode
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      // Send host_solo message
      socket.send(JSON.stringify({
        type: "host_solo",
        studentId: studentId,
        fightId: soloFightId.trim(),
      }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "session_created") {
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
        setIsHostingSolo(false);
        toast({
          title: "Failed to host solo mode",
          description: message.message || "The fight may not have solo mode enabled",
          variant: "destructive",
        });
      }
    };

    socket.onerror = () => {
      socket.close();
      setIsHostingSolo(false);
      toast({
        title: "Connection error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    };
  };

  const updateEquipment = async (slot: EquipmentSlot, itemId: string) => {
    const studentId = localStorage.getItem("studentId");
    const response = await fetch(`/api/student/${studentId}/equipment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [slot]: itemId }),
    });

    if (response.ok) {
      setStudent(await response.json());
      toast({ title: "Equipment updated!" });
    }
  };

  const updateCrossClassAbility = async (abilityId: string | null) => {
    try {
      const studentId = localStorage.getItem("studentId");
      const response = await fetch(`/api/student/${studentId}/equipment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crossClassAbility1: abilityId }),
      });

      if (response.ok) {
        setStudent(await response.json());
        toast({ title: abilityId ? "Cross-class ability equipped!" : "Cross-class ability removed!" });
      } else {
        let errorMessage = "Please try again";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // Failed to parse JSON error, use default message
        }
        toast({ 
          title: "Failed to update ability", 
          description: errorMessage,
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ 
        title: "Network error", 
        description: "Failed to connect to server",
        variant: "destructive" 
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("studentId");
    navigate("/");
  };

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

  if (!student || !student.characterClass || !student.gender) {
    return <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-black flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-black">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold" data-testid="text-lobby-title">
            Battle Lobby
          </h1>
          <div className="flex gap-2">
            <Link href="/student/guilds">
              <Button variant="outline" data-testid="button-my-guilds">
                <Users className="mr-2 h-4 w-4" />
                My Guilds
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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Your Character</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <PlayerAvatar
                  characterClass={student.characterClass}
                  gender={student.gender}
                  size="lg"
                />
                <div className="text-center">
                  <h2 className="text-2xl font-bold" data-testid="text-nickname">{student.nickname}</h2>
                  <p className="text-muted-foreground capitalize">{student.characterClass}</p>
                </div>
                <div className="w-full space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weapon:</span>
                    <span className="font-semibold capitalize" data-testid="text-weapon">
                      {student.weapon ? equippedItemsMap[student.weapon]?.name || "None" : "None"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Headgear:</span>
                    <span className="font-semibold capitalize" data-testid="text-headgear">
                      {student.headgear ? equippedItemsMap[student.headgear]?.name || "None" : "None"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Armor:</span>
                    <span className="font-semibold capitalize" data-testid="text-armor">
                      {student.armor ? equippedItemsMap[student.armor]?.name || "None" : "None"}
                    </span>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setShowClassModal(true)}
                  data-testid="button-open-class-modal"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Change Class
                </Button>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Class Progression
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  // Convert job levels array to map
                  const jobLevelMap: Record<CharacterClass, number> = {
                    warrior: 0, wizard: 0, scout: 0, herbalist: 0,
                    knight: 0, paladin: 0, dark_knight: 0, sage: 0, ranger: 0, druid: 0, monk: 0, warlock: 0,
                  };
                  
                  jobLevels.forEach(jl => {
                    jobLevelMap[jl.jobClass] = jl.level;
                  });
                  
                  const currentClassLevel = jobLevelMap[student.characterClass] || 0;
                  const currentJobLevel = jobLevels.find(jl => jl.jobClass === student.characterClass);
                  const currentExp = currentJobLevel?.experience || 0;
                  const passiveBonuses = getTotalPassiveBonuses(jobLevelMap);
                  
                  return (
                    <>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-sm text-muted-foreground">Current Class Level</div>
                        <div className="text-3xl font-bold text-primary capitalize">
                          {student.characterClass} Lv{currentClassLevel}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1" data-testid="text-experience">
                          {currentExp} XP
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="text-sm font-semibold text-muted-foreground">Character Stats</div>
                        {(() => {
                          // Calculate complete stats
                          const equipmentStats = {
                            str: 0, int: 0, agi: 0, mnd: 0, vit: 0,
                            def: 0, atk: 0, mat: 0, rtk: 0
                          };
                          
                          // Add equipped item bonuses (using old database fields for now)
                          // TODO: Migrate equipment database to use new stat system
                          equippedItems.forEach(item => {
                            // Convert old bonuses to new stats temporarily
                            // hpBonus → vit, attackBonus → atk, defenseBonus → def
                            equipmentStats.vit += Math.floor((item.hpBonus || 0) / 5); // HP = VIT × 5
                            equipmentStats.atk += item.attackBonus || 0;
                            equipmentStats.def += item.defenseBonus || 0;
                          });
                          
                          const mechanicUpgrades = getTotalMechanicUpgrades(jobLevelMap);
                          const stats = calculateCharacterStats(student.characterClass, equipmentStats, passiveBonuses, mechanicUpgrades);
                          
                          return (
                            <>
                              {/* Primary Stats */}
                              <div className="grid grid-cols-5 gap-2 text-center">
                                <div className="p-2 bg-muted rounded">
                                  <div className="text-xs text-muted-foreground">STR</div>
                                  <div className="font-bold text-damage">{stats.str}</div>
                                </div>
                                <div className="p-2 bg-muted rounded">
                                  <div className="text-xs text-muted-foreground">INT</div>
                                  <div className="font-bold text-primary">{stats.int}</div>
                                </div>
                                <div className="p-2 bg-muted rounded">
                                  <div className="text-xs text-muted-foreground">AGI</div>
                                  <div className="font-bold text-mana">{stats.agi}</div>
                                </div>
                                <div className="p-2 bg-muted rounded">
                                  <div className="text-xs text-muted-foreground">MND</div>
                                  <div className="font-bold text-healing">{stats.mnd}</div>
                                </div>
                                <div className="p-2 bg-muted rounded">
                                  <div className="text-xs text-muted-foreground">VIT</div>
                                  <div className="font-bold text-health">{stats.vit}</div>
                                </div>
                              </div>
                              
                              {/* Derived Combat Stats */}
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-2 bg-muted rounded">
                                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                    <Heart className="h-3 w-3" />
                                    HP
                                  </div>
                                  <div className="font-bold text-health">{stats.hp}</div>
                                </div>
                                <div className="p-2 bg-muted rounded">
                                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                    <Zap className="h-3 w-3" />
                                    MP
                                  </div>
                                  <div className="font-bold text-mana">{stats.mp}</div>
                                </div>
                                <div className="p-2 bg-muted rounded">
                                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                    <Shield className="h-3 w-3" />
                                    DEF
                                  </div>
                                  <div className="font-bold text-primary">{stats.def}</div>
                                </div>
                                <div className="p-2 bg-muted rounded">
                                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                    <Sword className="h-3 w-3" />
                                    ATK
                                  </div>
                                  <div className="font-bold text-damage">{stats.atk}</div>
                                </div>
                                <div className="p-2 bg-muted rounded">
                                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    MAT
                                  </div>
                                  <div className="font-bold text-primary">{stats.mat}</div>
                                </div>
                                <div className="p-2 bg-muted rounded">
                                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                    <Crosshair className="h-3 w-3" />
                                    RTK
                                  </div>
                                  <div className="font-bold text-mana">{stats.rtk}</div>
                                </div>
                              </div>
                              
                              {/* Max Combo Points if applicable */}
                              {stats.maxComboPoints > 0 && (
                                <div className="p-2 bg-muted rounded text-center">
                                  <div className="text-xs text-muted-foreground">Max Combo Points</div>
                                  <div className="font-bold text-primary">{stats.maxComboPoints}</div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      
                    </>
                  );
                })()}
              </CardContent>
            </Card>
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

            <Card>
              <CardHeader>
                <CardTitle>Equipment</CardTitle>
                <div className="flex gap-2 mt-4">
                  {(["weapon", "headgear", "armor"] as EquipmentSlot[]).map((slot) => (
                    <Button
                      key={slot}
                      variant={selectedSlot === slot ? "default" : "outline"}
                      onClick={() => setSelectedSlot(slot)}
                      className="capitalize"
                      data-testid={`button-slot-${slot}`}
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {inventoryItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No equipment in inventory</p>
                    <p className="text-xs mt-2">Defeat enemies to collect loot!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {inventoryItems
                      .filter((item) => item.slot === selectedSlot)
                      .map((item) => {
                        const isEquipped =
                          student[selectedSlot as keyof Pick<Student, "weapon" | "headgear" | "armor">] === item.id;

                        return (
                          <Card
                            key={item.id}
                            className={`cursor-pointer hover-elevate ${
                              isEquipped ? "ring-2 ring-primary" : ""
                            } border-2 ${RARITY_COLORS[item.quality as keyof typeof RARITY_COLORS]}`}
                            onClick={() => updateEquipment(selectedSlot, item.id)}
                            data-testid={`item-${item.id}`}
                          >
                            <CardContent className="p-4 text-center">
                              <div className="h-16 flex items-center justify-center mb-2">
                                {item.iconUrl ? (
                                  <img src={item.iconUrl} alt={item.name} className="h-12 w-12" />
                                ) : (
                                  <div className="text-muted-foreground">
                                    {item.slot === "weapon" && <Sword className="h-12 w-12" />}
                                    {item.slot === "armor" && <Shield className="h-12 w-12" />}
                                    {item.slot === "headgear" && <Crown className="h-12 w-12" />}
                                  </div>
                                )}
                              </div>
                              <p className="font-semibold text-sm">{item.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{item.quality}</p>
                              <div className="text-xs mt-1 space-y-0.5">
                                {item.hpBonus > 0 && <div className="text-health">+{item.hpBonus} HP</div>}
                                {item.attackBonus > 0 && <div className="text-damage">+{item.attackBonus} ATK</div>}
                                {item.defenseBonus > 0 && <div className="text-primary">+{item.defenseBonus} DEF</div>}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cross-Class Ability */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Cross-Class Ability
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-2">
                  Equip one ability from another class you've leveled up
                </p>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Create job level map
                  const jobLevelMap: Record<CharacterClass, number> = {
                    warrior: 0, wizard: 0, scout: 0, herbalist: 0,
                    warlock: 0, priest: 0, paladin: 0, dark_knight: 0, blood_knight: 0,
                  };
                  jobLevels.forEach(jl => {
                    jobLevelMap[jl.jobClass] = jl.level;
                  });

                  const availableAbilities = student?.characterClass 
                    ? getCrossClassAbilities(student.characterClass, jobLevelMap)
                    : [];

                  if (availableAbilities.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No cross-class abilities unlocked yet</p>
                        <p className="text-xs mt-2">Level other jobs to unlock abilities!</p>
                      </div>
                    );
                  }

                  const equippedAbility = availableAbilities.find(a => a.id === student?.crossClassAbility1);

                  return (
                    <div className="space-y-4">
                      {/* Currently Equipped */}
                      {equippedAbility && (
                        <div className="p-3 border-2 border-primary rounded-md bg-primary/5">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-sm flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                {equippedAbility.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {equippedAbility.description}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateCrossClassAbility(null)}
                              data-testid="button-unequip-ability"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Available Abilities */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Available Abilities:</p>
                        <div className="grid gap-2">
                          {availableAbilities.map((ability) => {
                            const isEquipped = ability.id === student?.crossClassAbility1;
                            
                            return (
                              <Card
                                key={ability.id}
                                className={`cursor-pointer hover-elevate ${
                                  isEquipped ? "ring-2 ring-primary opacity-50" : ""
                                }`}
                                onClick={() => !isEquipped && updateCrossClassAbility(ability.id)}
                                data-testid={`ability-${ability.id}`}
                              >
                                <CardContent className="p-3">
                                  <p className="font-semibold text-sm">{ability.name}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {ability.description}
                                  </p>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
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
                warrior: 0, wizard: 0, scout: 0, herbalist: 0,
                warlock: 0, priest: 0, paladin: 0, dark_knight: 0, blood_knight: 0,
              };
              
              jobLevels.forEach(jl => {
                jobLevelMap[jl.jobClass] = jl.level;
              });
              
              return ALL_CHARACTER_CLASSES.map((classType) => {
                const level = jobLevelMap[classType] || 0;
                const isCurrentClass = student.characterClass === classType;
                
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
                          gender={student.gender}
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

      {/* Guild Selection Dialog */}
      <Dialog open={showGuildDialog} onOpenChange={setShowGuildDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-guild-selection">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif">Select a Guild</DialogTitle>
            <DialogDescription>
              Choose a guild to access its fights and leaderboards
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {studentGuilds.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  You haven't joined any guilds yet
                </p>
                <Button
                  onClick={() => {
                    setShowGuildDialog(false);
                    navigate("/student/guilds");
                  }}
                  data-testid="button-browse-guilds"
                >
                  Browse Guilds
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {studentGuilds.map((guild) => (
                  <Card
                    key={guild.id}
                    className="cursor-pointer hover-elevate active-elevate-2"
                    onClick={() => {
                      setShowGuildDialog(false);
                      navigate(`/student/guild-lobby/${guild.id}`);
                    }}
                    data-testid={`button-select-guild-${guild.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg" data-testid={`text-guild-name-${guild.id}`}>
                            {guild.name}
                          </h3>
                          {guild.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {guild.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Trophy className="h-3 w-3" />
                            Lv {guild.level}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
