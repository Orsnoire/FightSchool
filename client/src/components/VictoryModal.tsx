import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { CharacterClass, Gender, LootItem } from "@shared/schema";
import { getTotalXPForLevel } from "@shared/jobSystem";

interface VictoryModalProps {
  fightId: string;
  characterClass: CharacterClass;
  gender: Gender;
  xpGained: number;
  leveledUp: boolean;
  newLevel: number;
  currentXP: number;
  lootTable: LootItem[];
  onClose: () => void;
}

export function VictoryModal({
  fightId,
  characterClass,
  gender,
  xpGained,
  leveledUp,
  newLevel,
  currentXP,
  lootTable,
  onClose,
}: VictoryModalProps) {
  const { toast } = useToast();
  const [xpProgress, setXpProgress] = useState(0);
  const [animatedLevel, setAnimatedLevel] = useState(newLevel);
  const [selectedLoot, setSelectedLoot] = useState<string | null>(null);
  const [lootClaimed, setLootClaimed] = useState(false);
  
  const studentId = localStorage.getItem("studentId");
  
  // Calculate starting level from starting XP
  const startTotalXP = Math.max(0, currentXP - xpGained);
  const getLevel = (totalXP: number): number => {
    let level = 1;
    while (getTotalXPForLevel(level + 1) <= totalXP) {
      level++;
    }
    return level;
  };
  const startLevel = getLevel(startTotalXP);
  
  // Animate XP bar filling
  useEffect(() => {
    const duration = 2000; // 2 seconds
    const steps = 50;
    const stepDuration = duration / steps;
    let currentStep = 0;
    let hasShownLevelUpToast = false;
    
    setXpProgress(startTotalXP);
    setAnimatedLevel(startLevel);
    
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const animatedTotalXP = startTotalXP + (xpGained * progress);
      const currentAnimatedLevel = getLevel(animatedTotalXP);
      
      setXpProgress(animatedTotalXP);
      setAnimatedLevel(currentAnimatedLevel);
      
      // Show level up toast when we cross a level boundary
      if (leveledUp && currentAnimatedLevel >= newLevel && !hasShownLevelUpToast) {
        hasShownLevelUpToast = true;
        setTimeout(() => {
          toast({
            title: "🎉 Level Up!",
            description: `You reached level ${newLevel}!`,
            duration: 5000,
          });
        }, 100);
      }
      
      if (currentStep >= steps) {
        clearInterval(interval);
        setXpProgress(currentXP);
        setAnimatedLevel(newLevel);
      }
    }, stepDuration);
    
    return () => clearInterval(interval);
  }, [xpGained, currentXP, leveledUp, newLevel, startLevel, startTotalXP, toast]);
  
  const handleClaimLoot = async () => {
    if (!selectedLoot || !studentId) return;
    
    try {
      await apiRequest("POST", `/api/student/${studentId}/claim-loot`, { itemId: selectedLoot, fightId });
      
      setLootClaimed(true);
      toast({
        title: "Loot Claimed!",
        description: "Item added to your inventory",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to claim loot",
        variant: "destructive",
      });
    }
  };
  
  // Calculate XP needed for next level using the animated level
  const totalXPForCurrentLevel = getTotalXPForLevel(animatedLevel);
  const totalXPForNextLevel = getTotalXPForLevel(animatedLevel + 1);
  const xpNeededForNextLevel = totalXPForNextLevel - totalXPForCurrentLevel;
  const xpWithinCurrentLevel = Math.max(0, xpProgress - totalXPForCurrentLevel);
  const xpProgressPercent = Math.min(100, (xpWithinCurrentLevel / xpNeededForNextLevel) * 100);
  
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <h2 className="text-4xl font-serif font-bold">Victory!</h2>
            <Trophy className="h-8 w-8 text-yellow-500" />
          </div>
          
          <div className="flex justify-center">
            <PlayerAvatar characterClass={characterClass} gender={gender} size="lg" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-xl font-semibold">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <span>+{xpGained} XP</span>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Level {animatedLevel}</span>
                <span>{Math.floor(xpWithinCurrentLevel)} / {xpNeededForNextLevel} XP to next level</span>
              </div>
              <Progress value={xpProgressPercent} className="h-3" />
            </div>
          </div>
        </div>
        
        {lootTable.length > 0 && !lootClaimed && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-center">Select Your Reward</h3>
            <div className="grid grid-cols-3 gap-4">
              {lootTable.map((loot) => (
                <Button
                  key={loot.itemId}
                  variant={selectedLoot === loot.itemId ? "default" : "outline"}
                  className="h-auto p-4"
                  onClick={() => setSelectedLoot(loot.itemId)}
                  data-testid={`button-loot-${loot.itemId}`}
                >
                  <div className="text-sm">Item {loot.itemId.slice(0, 8)}</div>
                </Button>
              ))}
            </div>
            
            <Button
              onClick={handleClaimLoot}
              disabled={!selectedLoot}
              className="w-full"
              size="lg"
              data-testid="button-claim-loot"
            >
              Claim Reward
            </Button>
          </div>
        )}
        
        {(lootTable.length === 0 || lootClaimed) && (
          <Button
            onClick={onClose}
            className="w-full"
            size="lg"
            data-testid="button-return-lobby"
          >
            Return to Lobby
          </Button>
        )}
      </Card>
    </div>
  );
}
