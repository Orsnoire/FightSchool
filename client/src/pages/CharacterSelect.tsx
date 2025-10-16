import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { CLASS_STATS, BASE_CLASSES, type BaseClass, type Gender } from "@shared/schema";
import { Shield, Sparkles, Target, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CLASS_INFO: Record<BaseClass, { icon: any; color: string }> = {
  knight: { icon: Shield, color: "text-knight" },
  wizard: { icon: Sparkles, color: "text-wizard" },
  scout: { icon: Target, color: "text-scout" },
  herbalist: { icon: Heart, color: "text-herbalist" },
};

export default function CharacterSelect() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedClass, setSelectedClass] = useState<BaseClass | null>(null);
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);

  const handleConfirm = async () => {
    if (!selectedClass || !selectedGender) {
      toast({ title: "Please select a class and gender", variant: "destructive" });
      return;
    }

    const studentId = localStorage.getItem("studentId");
    const response = await fetch(`/api/student/${studentId}/character`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterClass: selectedClass, gender: selectedGender }),
    });

    if (response.ok) {
      navigate("/student/lobby");
    } else {
      toast({ title: "Failed to save character", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-serif font-bold mb-2" data-testid="text-select-title">
            Choose Your Class
          </h1>
          <p className="text-muted-foreground">
            Select your role in the upcoming battle
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {BASE_CLASSES.map((classType) => {
            const Icon = CLASS_INFO[classType].icon;
            const stats = CLASS_STATS[classType];
            const isSelected = selectedClass === classType;

            return (
              <Card
                key={classType}
                className={`cursor-pointer transition-all hover-elevate ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedClass(classType)}
                data-testid={`card-class-${classType}`}
              >
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-6 w-6 ${CLASS_INFO[classType].color}`} />
                    <CardTitle className="capitalize">{classType}</CardTitle>
                  </div>
                  <CardDescription>{stats.role}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Health:</span>
                      <span className="font-semibold">{stats.maxHealth}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Damage:</span>
                      <span className="font-semibold">{stats.damage}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {selectedClass && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Select Gender</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                {(["A", "B"] as Gender[]).map((gender) => (
                  <div
                    key={gender}
                    className={`cursor-pointer p-4 border-2 rounded-md transition-all hover-elevate ${
                      selectedGender === gender ? "border-primary" : "border-border"
                    }`}
                    onClick={() => setSelectedGender(gender)}
                    data-testid={`button-gender-${gender}`}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <PlayerAvatar characterClass={selectedClass} gender={gender} size="lg" />
                      <p className="font-semibold">Option {gender}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleConfirm}
            disabled={!selectedClass || !selectedGender}
            data-testid="button-confirm-character"
          >
            Confirm Selection
          </Button>
        </div>
      </div>
    </div>
  );
}
