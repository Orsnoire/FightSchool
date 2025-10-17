import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, PlusCircle, Trash2 } from "lucide-react";
import { insertFightSchema, type InsertFight, type Question, type Enemy, type LootItem, EQUIPMENT_ITEMS } from "@shared/schema";
import dragonImg from "@assets/generated_images/Dragon_enemy_illustration_328d8dbc.png";
import goblinImg from "@assets/generated_images/Goblin_horde_enemy_illustration_550e1cc2.png";
import wizardImg from "@assets/generated_images/Dark_wizard_enemy_illustration_a897a309.png";

export default function CreateFight() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [lootTable, setLootTable] = useState<LootItem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    type: "multiple_choice",
    timeLimit: 30,
    options: ["", "", "", ""],
  });
  const [currentEnemy, setCurrentEnemy] = useState<Partial<Enemy>>({
    image: dragonImg,
    maxHealth: 50,
  });

  const teacherId = localStorage.getItem("teacherId") || "";

  const form = useForm<InsertFight>({
    resolver: zodResolver(insertFightSchema),
    defaultValues: {
      teacherId,
      title: "",
      classCode: "",
      questions: [],
      enemies: [],
      baseXP: 10,
      baseEnemyDamage: 1,
      enemyDisplayMode: "consecutive",
      lootTable: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertFight) => {
      const response = await apiRequest("POST", "/api/fights", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher", teacherId, "fights"] });
      toast({ title: "Fight created successfully!" });
      navigate("/teacher");
    },
    onError: (error) => {
      toast({ 
        title: "Failed to create fight", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    },
  });

  const addQuestion = () => {
    if (!currentQuestion.question || !currentQuestion.correctAnswer) {
      toast({ title: "Please fill in question and correct answer", variant: "destructive" });
      return;
    }
    const newQuestion: Question = {
      id: Date.now().toString(),
      type: currentQuestion.type as any,
      question: currentQuestion.question,
      options: currentQuestion.options,
      correctAnswer: currentQuestion.correctAnswer,
      timeLimit: currentQuestion.timeLimit || 30,
    };
    const updatedQuestions = [...questions, newQuestion];
    setQuestions(updatedQuestions);
    form.setValue("questions", updatedQuestions);
    setCurrentQuestion({
      type: "multiple_choice",
      timeLimit: 30,
      options: ["", "", "", ""],
    });
  };

  const addEnemy = () => {
    if (!currentEnemy.name || !currentEnemy.maxHealth) {
      toast({ title: "Please fill in enemy name and health", variant: "destructive" });
      return;
    }
    const newEnemy: Enemy = {
      id: Date.now().toString(),
      name: currentEnemy.name,
      image: currentEnemy.image || dragonImg,
      maxHealth: currentEnemy.maxHealth,
    };
    const updatedEnemies = [...enemies, newEnemy];
    setEnemies(updatedEnemies);
    form.setValue("enemies", updatedEnemies);
    setCurrentEnemy({ image: dragonImg, maxHealth: 50 });
  };

  const onSubmit = (data: InsertFight) => {
    if (questions.length === 0) {
      toast({ title: "Add at least one question", variant: "destructive" });
      return;
    }
    createMutation.mutate({ ...data, teacherId, questions, enemies, lootTable });
  };

  const addLootItem = (itemId: string) => {
    const newLootTable = [...lootTable, { itemId }];
    setLootTable(newLootTable);
    form.setValue("lootTable", newLootTable);
  };

  const removeLootItem = (index: number) => {
    const newLootTable = lootTable.filter((_, i) => i !== index);
    setLootTable(newLootTable);
    form.setValue("lootTable", newLootTable);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/teacher")} data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-serif font-bold mb-8" data-testid="text-create-title">
          Create New Fight
        </h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fight Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Epic Dragon Battle" {...field} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="classCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class Code</FormLabel>
                      <FormControl>
                        <Input placeholder="MATH101" {...field} data-testid="input-classcode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="baseXP"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base XP Reward: {field.value}</FormLabel>
                      <Slider
                        min={1}
                        max={100}
                        step={1}
                        value={[field.value || 10]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        data-testid="slider-basexp"
                      />
                      <p className="text-sm text-muted-foreground">Base XP awarded for completing this fight (additional XP based on performance)</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="baseEnemyDamage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enemy Damage Level: {field.value}</FormLabel>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[field.value || 1]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        data-testid="slider-base-enemy-damage"
                      />
                      <p className="text-sm text-muted-foreground">Difficulty scaling: higher values mean enemies deal more damage (1 = easy, 10 = very hard)</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="enemyDisplayMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enemy Display Mode</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-enemy-display-mode">
                            <SelectValue placeholder="Select enemy display mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="consecutive">Consecutive (One at a time)</SelectItem>
                          <SelectItem value="simultaneous">Simultaneous (All at once)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">Choose how multiple enemies appear in combat</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Tabs defaultValue="questions" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="questions" data-testid="tab-questions">Questions ({questions.length})</TabsTrigger>
                <TabsTrigger value="enemies" data-testid="tab-enemies">Enemies ({enemies.length})</TabsTrigger>
                <TabsTrigger value="loot" data-testid="tab-loot">Loot ({lootTable.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="questions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Question</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Question Type</label>
                      <Select
                        value={currentQuestion.type}
                        onValueChange={(value: any) => setCurrentQuestion({ ...currentQuestion, type: value })}
                      >
                        <SelectTrigger data-testid="select-question-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                          <SelectItem value="true_false">True/False</SelectItem>
                          <SelectItem value="short_answer">Short Answer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Question</label>
                      <Input
                        value={currentQuestion.question || ""}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                        placeholder="What is 2 + 2?"
                        data-testid="input-question"
                      />
                    </div>

                    {currentQuestion.type === "multiple_choice" && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Options</label>
                        {currentQuestion.options?.map((opt, i) => (
                          <Input
                            key={i}
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...(currentQuestion.options || [])];
                              newOpts[i] = e.target.value;
                              setCurrentQuestion({ ...currentQuestion, options: newOpts });
                            }}
                            placeholder={`Option ${i + 1}`}
                            data-testid={`input-option-${i}`}
                          />
                        ))}
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium">Correct Answer</label>
                      <Input
                        value={currentQuestion.correctAnswer || ""}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: e.target.value })}
                        placeholder="4"
                        data-testid="input-correct-answer"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Time Limit: {currentQuestion.timeLimit}s</label>
                      <Slider
                        value={[currentQuestion.timeLimit || 30]}
                        onValueChange={([value]) => setCurrentQuestion({ ...currentQuestion, timeLimit: value })}
                        min={5}
                        max={120}
                        step={5}
                        data-testid="slider-time-limit"
                      />
                    </div>

                    <Button type="button" onClick={addQuestion} className="w-full" data-testid="button-add-question">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Question
                    </Button>
                  </CardContent>
                </Card>

                {questions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Questions ({questions.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {questions.map((q, i) => (
                        <div key={q.id} className="flex items-center justify-between p-3 border border-border rounded-md" data-testid={`question-item-${i}`}>
                          <div>
                            <p className="font-medium">{q.question}</p>
                            <p className="text-sm text-muted-foreground">{q.type} • {q.timeLimit}s</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const updated = questions.filter((_, idx) => idx !== i);
                              setQuestions(updated);
                              form.setValue("questions", updated);
                            }}
                            data-testid={`button-delete-question-${i}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="enemies" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Enemy</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Enemy Name</label>
                      <Input
                        value={currentEnemy.name || ""}
                        onChange={(e) => setCurrentEnemy({ ...currentEnemy, name: e.target.value })}
                        placeholder="Fire Dragon"
                        data-testid="input-enemy-name"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Enemy Image</label>
                      <div className="grid grid-cols-3 gap-4 mt-2">
                        {[
                          { id: "dragon", img: dragonImg, name: "Dragon" },
                          { id: "goblin", img: goblinImg, name: "Goblin Horde" },
                          { id: "wizard", img: wizardImg, name: "Dark Wizard" },
                        ].map((enemy) => (
                          <button
                            key={enemy.id}
                            type="button"
                            onClick={() => setCurrentEnemy({ ...currentEnemy, image: enemy.img })}
                            className={`p-2 border-2 rounded-md hover-elevate ${
                              currentEnemy.image === enemy.img ? "border-primary" : "border-border"
                            }`}
                            data-testid={`button-select-${enemy.id}`}
                          >
                            <img src={enemy.img} alt={enemy.name} className="w-full h-24 object-cover rounded" />
                            <p className="text-xs mt-1">{enemy.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Max Health: {currentEnemy.maxHealth}</label>
                      <Slider
                        value={[currentEnemy.maxHealth || 50]}
                        onValueChange={([value]) => setCurrentEnemy({ ...currentEnemy, maxHealth: value })}
                        min={10}
                        max={200}
                        step={10}
                        data-testid="slider-enemy-health"
                      />
                    </div>

                    <Button type="button" onClick={addEnemy} className="w-full" data-testid="button-add-enemy">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Enemy
                    </Button>
                  </CardContent>
                </Card>

                {enemies.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Enemies ({enemies.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {enemies.map((enemy, i) => (
                        <div key={enemy.id} className="flex items-center justify-between p-3 border border-border rounded-md" data-testid={`enemy-item-${i}`}>
                          <div className="flex items-center gap-3">
                            <img src={enemy.image} alt={enemy.name} className="w-12 h-12 object-cover rounded" />
                            <div>
                              <p className="font-medium">{enemy.name}</p>
                              <p className="text-sm text-muted-foreground">{enemy.maxHealth} HP</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const updated = enemies.filter((_, idx) => idx !== i);
                              setEnemies(updated);
                              form.setValue("enemies", updated);
                            }}
                            data-testid={`button-delete-enemy-${i}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="loot" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Loot Item</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Select Equipment</label>
                      <Select onValueChange={(value) => addLootItem(value)}>
                        <SelectTrigger data-testid="select-loot-item">
                          <SelectValue placeholder="Choose an item to add" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(EQUIPMENT_ITEMS)
                            .filter(item => !lootTable.some(l => l.itemId === item.id))
                            .map(item => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} ({item.rarity}) - {item.slot}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground mt-2">Students can choose ONE item from this loot table OR take XP instead</p>
                    </div>
                  </CardContent>
                </Card>

                {lootTable.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Loot Table ({lootTable.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {lootTable.map((loot, i) => {
                        const item = EQUIPMENT_ITEMS[loot.itemId];
                        if (!item) return null;
                        return (
                          <div key={i} className="flex items-center justify-between p-3 border border-border rounded-md" data-testid={`loot-item-${i}`}>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {item.rarity} | {item.slot} | 
                                {item.stats.hp ? ` +${item.stats.hp} HP` : ''}
                                {item.stats.attack ? ` +${item.stats.attack} ATK` : ''}
                                {item.stats.defense ? ` +${item.stats.defense} DEF` : ''}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLootItem(i)}
                              data-testid={`button-delete-loot-${i}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={createMutation.isPending}
              data-testid="button-create-fight-submit"
            >
              {createMutation.isPending ? "Creating..." : "Create Fight"}
            </Button>
          </form>
        </Form>
      </main>
    </div>
  );
}
