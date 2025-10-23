import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, PlusCircle, Trash2, Upload } from "lucide-react";
import { insertFightSchema, type InsertFight, type Question, type Enemy, type LootItem, type EquipmentItemDb, type Fight } from "@shared/schema";
import dragonImg from "@assets/generated_images/Dragon_enemy_illustration_328d8dbc.png";
import goblinImg from "@assets/generated_images/Goblin_horde_enemy_illustration_550e1cc2.png";
import wizardImg from "@assets/generated_images/Dark_wizard_enemy_illustration_a897a309.png";
import spiderImg from "@assets/generated_images/Giant_spider_RPG_enemy_b9948cc9.png";
import batImg from "@assets/generated_images/Vampire_bat_RPG_enemy_434d2140.png";
import ratImg from "@assets/generated_images/Plague_rat_RPG_enemy_1f15cd5e.png";
import ghostImg from "@assets/generated_images/Ghost_RPG_enemy_6ed440bf.png";
import zombieImg from "@assets/generated_images/Zombie_RPG_enemy_fd15b6dd.png";
import skeletonWarriorImg from "@assets/generated_images/Skeleton_warrior_RPG_enemy_ab3d69f2.png";
import skeletonMageImg from "@assets/generated_images/Skeleton_mage_RPG_enemy_b8e4e1b3.png";
import ghostWizardImg from "@assets/generated_images/Ghost_wizard_RPG_enemy_8ba6ece7.png";
import jackOLanternImg from "@assets/generated_images/Jack-o-lantern_RPG_enemy_b82c40f0.png";
import scarecrowImg from "@assets/generated_images/Scarecrow_pumpkin_head_RPG_4daac721.png";
import samhainImg from "@assets/generated_images/Samhain_lord_RPG_boss_1875c391.png";
import vampireImg from "@assets/generated_images/Vampire_RPG_enemy_b9b1629c.png";
import wraithImg from "@assets/generated_images/Wraith_RPG_enemy_d768c073.png";
import bansheeImg from "@assets/generated_images/Banshee_RPG_enemy_f5abf8e7.png";
import necromancerImg from "@assets/generated_images/Necromancer_RPG_enemy_0104df7f.png";
import lichImg from "@assets/generated_images/Lich_RPG_boss_enemy_e9dfa246.png";
import mummyImg from "@assets/generated_images/Mummy_RPG_enemy_789d75d9.png";
import headlessHorsemanImg from "@assets/generated_images/Headless_horseman_RPG_boss_398e4f17.png";
import werewolfImg from "@assets/generated_images/Werewolf_RPG_enemy_576e9732.png";
import goblinSwarmImg from "@assets/generated_images/Goblin_swarm_RPG_enemy_68c45c1e.png";
import Papa from "papaparse";

export default function CreateFight() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/teacher/edit/:id");
  const { toast } = useToast();
  const fightId = params?.id;
  const isEditMode = !!fightId;
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [lootTable, setLootTable] = useState<LootItem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    type: "multiple_choice",
    timeLimit: 30,
    options: ["", "", "", ""],
  });
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [currentEnemy, setCurrentEnemy] = useState<Partial<Enemy>>({
    image: dragonImg,
    maxHealth: 50,
  });
  const csvInputRef = useRef<HTMLInputElement>(null);

  const teacherId = localStorage.getItem("teacherId") || "";

  // Redirect to login if no teacher ID
  useEffect(() => {
    if (!teacherId) {
      toast({ title: "Please log in first", variant: "destructive" });
      navigate("/teacher/login");
    }
  }, [teacherId, navigate, toast]);

  // Load existing fight data in edit mode
  const { data: existingFight, isLoading: fightLoading } = useQuery<Fight>({
    queryKey: [`/api/fights/${fightId}`],
    enabled: isEditMode && !!fightId,
  });

  const { data: teacherEquipment = [], isLoading: equipmentLoading } = useQuery<EquipmentItemDb[]>({
    queryKey: [`/api/teacher/${teacherId}/equipment-items`],
    enabled: !!teacherId,
  });

  const form = useForm<InsertFight>({
    resolver: zodResolver(insertFightSchema),
    defaultValues: {
      teacherId,
      title: "",
      guildCode: "",
      questions: [],
      enemies: [],
      baseXP: 10,
      baseEnemyDamage: 1,
      enemyDisplayMode: "consecutive",
      lootTable: [],
      randomizeQuestions: false,
      shuffleOptions: true,
    },
  });

  // Populate form with existing fight data in edit mode
  useEffect(() => {
    if (existingFight && isEditMode) {
      form.reset({
        teacherId: existingFight.teacherId,
        title: existingFight.title,
        guildCode: existingFight.guildCode,
        questions: existingFight.questions,
        enemies: existingFight.enemies,
        baseXP: existingFight.baseXP,
        baseEnemyDamage: existingFight.baseEnemyDamage,
        enemyDisplayMode: existingFight.enemyDisplayMode,
        lootTable: existingFight.lootTable,
        randomizeQuestions: existingFight.randomizeQuestions,
        shuffleOptions: existingFight.shuffleOptions,
      });
      setQuestions(existingFight.questions);
      setEnemies(existingFight.enemies);
      setLootTable(existingFight.lootTable || []);
    }
  }, [existingFight, isEditMode, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: InsertFight) => {
      const method = isEditMode ? "PATCH" : "POST";
      const url = isEditMode ? `/api/fights/${fightId}` : "/api/fights";
      const response = await apiRequest(method, url, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teacher/${teacherId}/fights`] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: [`/api/fights/${fightId}`] });
      }
      toast({ title: isEditMode ? "Fight updated successfully!" : "Fight created successfully!" });
      navigate("/teacher");
    },
    onError: (error) => {
      toast({ 
        title: isEditMode ? "Failed to update fight" : "Failed to create fight", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    },
  });

  const addQuestion = () => {
    let correctAnswer = currentQuestion.correctAnswer;
    
    if (currentQuestion.type === "multiple_choice") {
      if (selectedOptionIndex === null || !currentQuestion.options?.[selectedOptionIndex]) {
        toast({ title: "Please select a correct answer option", variant: "destructive" });
        return;
      }
      correctAnswer = currentQuestion.options[selectedOptionIndex];
    }
    
    if (!currentQuestion.question || !correctAnswer) {
      toast({ title: "Please fill in question and correct answer", variant: "destructive" });
      return;
    }
    
    const newQuestion: Question = {
      id: Date.now().toString(),
      type: currentQuestion.type as any,
      question: currentQuestion.question,
      options: currentQuestion.options,
      correctAnswer: correctAnswer,
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
    setSelectedOptionIndex(null);
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
    saveMutation.mutate({ ...data, teacherId, questions, enemies, lootTable });
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

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsedQuestions: Question[] = [];
          
          for (const row of results.data as any[]) {
            const questionText = row["question text"]?.trim();
            const questionType = row["question type"]?.trim().toLowerCase();
            const answer1 = row["answer1"]?.trim();
            const answer2 = row["answer2"]?.trim();
            const answer3 = row["answer3"]?.trim();
            const answer4 = row["answer4"]?.trim();
            
            if (!questionText || !questionType || !answer1) {
              continue;
            }
            
            const newQuestion: Question = {
              id: Date.now().toString() + Math.random(),
              question: questionText,
              type: questionType === "true/false" || questionType === "true_false" ? "true_false" : 
                    questionType === "short answer" || questionType === "short_answer" ? "short_answer" : 
                    "multiple_choice",
              correctAnswer: answer1,
              timeLimit: 30,
            };
            
            if (newQuestion.type === "multiple_choice") {
              const options = [answer1, answer2, answer3, answer4].filter(a => a);
              if (options.length < 2) {
                continue;
              }
              newQuestion.options = options;
            }
            
            parsedQuestions.push(newQuestion);
          }
          
          if (parsedQuestions.length === 0) {
            toast({ 
              title: "No valid questions found", 
              description: "Please check your CSV format",
              variant: "destructive" 
            });
            return;
          }
          
          const updatedQuestions = [...questions, ...parsedQuestions];
          setQuestions(updatedQuestions);
          form.setValue("questions", updatedQuestions);
          
          toast({ 
            title: `Successfully imported ${parsedQuestions.length} questions`,
            variant: "default"
          });
          
          if (csvInputRef.current) {
            csvInputRef.current.value = "";
          }
        } catch (error) {
          toast({ 
            title: "Failed to parse CSV", 
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive" 
          });
        }
      },
      error: (error) => {
        toast({ 
          title: "Failed to read CSV file", 
          description: error.message,
          variant: "destructive" 
        });
      }
    });
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
          {isEditMode ? "Edit Fight" : "Create New Fight"}
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
                  name="guildCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guild Code (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="GUILD101" {...field} value={field.value || ""} data-testid="input-guildcode" />
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
                <FormField
                  control={form.control}
                  name="randomizeQuestions"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-randomize-questions"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Randomize Question Order
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Present questions in random order each time the fight is hosted (prevents memorization)
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shuffleOptions"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-shuffle-options"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Shuffle Answer Options
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Randomize the order of multiple choice and true/false options when displayed to students
                        </p>
                      </div>
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
                    <div className="flex items-center justify-between">
                      <CardTitle>Add Question</CardTitle>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          ref={csvInputRef}
                          accept=".csv"
                          onChange={handleCSVUpload}
                          className="hidden"
                          data-testid="input-csv-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => csvInputRef.current?.click()}
                          data-testid="button-upload-csv"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Import CSV
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      CSV format: "question text", "question type", "answer1", "answer2", "answer3", "answer4" (answer1 is the correct answer)
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Question Type</label>
                      <Select
                        value={currentQuestion.type}
                        onValueChange={(value: any) => {
                          setCurrentQuestion({ ...currentQuestion, type: value, correctAnswer: "" });
                          setSelectedOptionIndex(null);
                        }}
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
                        placeholder="Enter your question text"
                        data-testid="input-question"
                      />
                    </div>

                    {currentQuestion.type === "multiple_choice" && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Options (select the correct answer)</label>
                        <RadioGroup
                          value={selectedOptionIndex !== null ? String(selectedOptionIndex) : ""}
                          onValueChange={(value) => {
                            const index = parseInt(value);
                            setSelectedOptionIndex(index);
                          }}
                        >
                          {currentQuestion.options?.map((opt, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <RadioGroupItem
                                value={String(i)}
                                id={`option-${i}`}
                                data-testid={`radio-option-${i}`}
                                disabled={!opt}
                              />
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  setCurrentQuestion((prev) => {
                                    const newOpts = [...(prev.options || [])];
                                    newOpts[i] = e.target.value;
                                    return { ...prev, options: newOpts };
                                  });
                                  if (selectedOptionIndex === i && !e.target.value) {
                                    setSelectedOptionIndex(null);
                                    toast({ 
                                      title: "Selection cleared", 
                                      description: "Please select a valid answer option",
                                      variant: "default"
                                    });
                                  }
                                }}
                                placeholder={`Option ${i + 1}`}
                                data-testid={`input-option-${i}`}
                                className="flex-1"
                              />
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    )}

                    {currentQuestion.type === "true_false" && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Correct Answer</label>
                        <RadioGroup
                          value={currentQuestion.correctAnswer || ""}
                          onValueChange={(value) => setCurrentQuestion({ ...currentQuestion, correctAnswer: value })}
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="true" id="true" data-testid="radio-true" />
                            <Label htmlFor="true">True</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="false" id="false" data-testid="radio-false" />
                            <Label htmlFor="false">False</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}

                    {currentQuestion.type === "short_answer" && (
                      <div>
                        <label className="text-sm font-medium">Correct Answer</label>
                        <Input
                          value={currentQuestion.correctAnswer || ""}
                          onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: e.target.value })}
                          placeholder="Enter the correct answer"
                          data-testid="input-correct-answer"
                        />
                      </div>
                    )}

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
                      <div className="grid grid-cols-5 gap-3 mt-2 max-h-96 overflow-y-auto pr-2">
                        {[
                          { id: "spider", img: spiderImg, name: "Giant Spider" },
                          { id: "bat", img: batImg, name: "Vampire Bat" },
                          { id: "rat", img: ratImg, name: "Plague Rat" },
                          { id: "goblin", img: goblinImg, name: "Goblin Horde" },
                          { id: "goblin-swarm", img: goblinSwarmImg, name: "Goblin Swarm" },
                          { id: "dragon", img: dragonImg, name: "Dragon" },
                          { id: "wizard", img: wizardImg, name: "Dark Wizard" },
                          { id: "ghost", img: ghostImg, name: "Ghost" },
                          { id: "zombie", img: zombieImg, name: "Zombie" },
                          { id: "skeleton-warrior", img: skeletonWarriorImg, name: "Skeleton Warrior" },
                          { id: "skeleton-mage", img: skeletonMageImg, name: "Skeleton Mage" },
                          { id: "ghost-wizard", img: ghostWizardImg, name: "Ghost Wizard" },
                          { id: "necromancer", img: necromancerImg, name: "Necromancer" },
                          { id: "lich", img: lichImg, name: "Lich" },
                          { id: "werewolf", img: werewolfImg, name: "Werewolf" },
                          { id: "vampire", img: vampireImg, name: "Vampire" },
                          { id: "mummy", img: mummyImg, name: "Mummy" },
                          { id: "wraith", img: wraithImg, name: "Wraith" },
                          { id: "banshee", img: bansheeImg, name: "Banshee" },
                          { id: "jack-o-lantern", img: jackOLanternImg, name: "Jack-o-Lantern" },
                          { id: "scarecrow", img: scarecrowImg, name: "Scarecrow" },
                          { id: "headless-horseman", img: headlessHorsemanImg, name: "Headless Horseman" },
                          { id: "samhain", img: samhainImg, name: "Samhain" },
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
                            <img src={enemy.img} alt={enemy.name} className="w-full h-20 object-cover rounded" />
                            <p className="text-xs mt-1 truncate">{enemy.name}</p>
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
                      {equipmentLoading ? (
                        <p className="text-sm text-muted-foreground">Loading equipment...</p>
                      ) : teacherEquipment.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No equipment items found. Create items in the Item Management page first.</p>
                      ) : (
                        <Select onValueChange={(value) => addLootItem(value)}>
                          <SelectTrigger data-testid="select-loot-item">
                            <SelectValue placeholder="Choose an item to add" />
                          </SelectTrigger>
                          <SelectContent>
                            {teacherEquipment
                              .filter(item => !lootTable.some(l => l.itemId === item.id))
                              .map(item => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name} ({item.quality}) - {item.slot}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
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
                        const item = teacherEquipment.find(eq => eq.id === loot.itemId);
                        if (!item) return null;
                        return (
                          <div key={i} className="flex items-center justify-between p-3 border border-border rounded-md" data-testid={`loot-item-${i}`}>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {item.quality} | {item.slot} | 
                                {item.hpBonus ? ` +${item.hpBonus} HP` : ''}
                                {item.attackBonus ? ` +${item.attackBonus} ATK` : ''}
                                {item.defenseBonus ? ` +${item.defenseBonus} DEF` : ''}
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
              disabled={saveMutation.isPending}
              data-testid="button-create-fight-submit"
            >
              {saveMutation.isPending 
                ? (isEditMode ? "Updating..." : "Creating...") 
                : (isEditMode ? "Update Fight" : "Create Fight")}
            </Button>
          </form>
        </Form>
      </main>
    </div>
  );
}
