import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { EQUIPMENT_ITEMS, type Student, type EquipmentSlot } from "@shared/schema";
import { LogOut, Swords, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

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
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>("weapon");
  const [fightCode, setFightCode] = useState("");
  const studentId = localStorage.getItem("studentId");

  useEffect(() => {
    const loadStudent = async () => {
      const response = await fetch(`/api/student/${studentId}`);
      if (response.ok) {
        setStudent(await response.json());
      }
    };
    loadStudent();
  }, [studentId]);

  const joinFight = async () => {
    if (!fightCode.trim()) {
      toast({ title: "Please enter a fight code", variant: "destructive" });
      return;
    }

    // Check if fight exists
    const response = await fetch(`/api/fights/${fightCode}`);
    if (!response.ok) {
      toast({ title: "Invalid fight code", description: "Fight not found", variant: "destructive" });
      return;
    }

    localStorage.setItem("fightId", fightCode);
    navigate("/student/combat");
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

  const handleLogout = () => {
    localStorage.removeItem("studentId");
    navigate("/student/login");
  };

  if (!student) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold" data-testid="text-lobby-title">
            Battle Lobby
          </h1>
          <div className="flex gap-2">
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
                      {EQUIPMENT_ITEMS.weapon.find((i) => i.id === student.weapon)?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Headgear:</span>
                    <span className="font-semibold capitalize" data-testid="text-headgear">
                      {EQUIPMENT_ITEMS.headgear.find((i) => i.id === student.headgear)?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Armor:</span>
                    <span className="font-semibold capitalize" data-testid="text-armor">
                      {EQUIPMENT_ITEMS.armor.find((i) => i.id === student.armor)?.name}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Swords className="h-5 w-5 text-primary" />
                  Join Battle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fight-code">Fight Code</Label>
                  <Input
                    id="fight-code"
                    value={fightCode}
                    onChange={(e) => setFightCode(e.target.value)}
                    placeholder="Enter fight code from your teacher"
                    data-testid="input-fight-code"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        joinFight();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Your teacher will give you a fight code to enter here
                  </p>
                </div>
                <Button onClick={joinFight} className="w-full" data-testid="button-join-fight">
                  <Swords className="mr-2 h-4 w-4" />
                  Join Battle
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Equipment</CardTitle>
                <div className="flex gap-2 mt-4">
                  {(Object.keys(EQUIPMENT_ITEMS) as EquipmentSlot[]).map((slot) => (
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {EQUIPMENT_ITEMS[selectedSlot].map((item) => {
                    const isEquipped =
                      student[selectedSlot as keyof Pick<Student, "weapon" | "headgear" | "armor">] === item.id;

                    return (
                      <Card
                        key={item.id}
                        className={`cursor-pointer hover-elevate ${
                          isEquipped ? "ring-2 ring-primary" : ""
                        } border-2 ${RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS]}`}
                        onClick={() => updateEquipment(selectedSlot, item.id)}
                        data-testid={`item-${item.id}`}
                      >
                        <CardContent className="p-4 text-center">
                          <div className="h-16 flex items-center justify-center mb-2">
                            <div className="text-4xl">🗡️</div>
                          </div>
                          <p className="font-semibold text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{item.rarity}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
