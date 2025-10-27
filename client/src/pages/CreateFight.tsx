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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, PlusCircle, Trash2, Upload, Edit, Image as ImageIcon, GripVertical } from "lucide-react";
import { insertFightSchema, type InsertFight, type Question, type Enemy, type LootItem, type EquipmentItemDb, type Fight } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// import { RichTextEditor } from "@/components/RichTextEditor"; // Disabled for now - using basic text input
import { uploadImageToStorage } from "@/lib/imageUpload";
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

interface SortableEnemyItemProps {
  enemy: Enemy;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableEnemyItem({ enemy, index, onEdit, onDelete }: SortableEnemyItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: enemy.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 border border-border rounded-md bg-card"
      data-testid={`enemy-item-${index}`}
    >
      <div className="flex items-center gap-3 flex-1">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
          data-testid={`button-drag-enemy-${index}`}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
        <img src={enemy.image} alt={enemy.name} className="w-12 h-12 object-cover rounded" />
        <div>
          <p className="font-medium">{enemy.name}</p>
          <p className="text-sm text-muted-foreground">
            Difficulty: {enemy.difficultyMultiplier}
            {enemy.difficultyMultiplier <= 10 && " (Trash Pack)"}
            {enemy.difficultyMultiplier > 10 && enemy.difficultyMultiplier <= 30 && " (Elite)"}
            {enemy.difficultyMultiplier > 30 && enemy.difficultyMultiplier <= 60 && " (Boss)"}
            {enemy.difficultyMultiplier > 60 && " (Epic Boss)"}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onEdit}
          data-testid={`button-edit-enemy-${index}`}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          data-testid={`button-delete-enemy-${index}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

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
    difficultyMultiplier: 10,
  });
  const [editingEnemyIndex, setEditingEnemyIndex] = useState<number | null>(null);
  const [uploadedEnemyImage, setUploadedEnemyImage] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const enemyImageInputRef = useRef<HTMLInputElement>(null);

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
      soloModeEnabled: true, // Default to true - controlled per-guild in guild settings
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
        soloModeEnabled: true, // Always true - controlled per-guild in guild settings
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

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 120;
          canvas.height = 120;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, 120, 120);
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }
            const resizedFile = new File([blob], file.name, { type: 'image/png' });
            uploadImageToStorage(resizedFile).then(resolve).catch(reject);
          }, 'image/png');
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleEnemyImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    try {
      toast({ title: "Uploading image..." });
      const imageUrl = await resizeImage(file);
      setUploadedEnemyImage(imageUrl);
      setCurrentEnemy({ ...currentEnemy, image: imageUrl });
      toast({ title: "Image uploaded successfully (resized to 120x120px)" });
    } catch (error) {
      toast({ 
        title: "Failed to upload image", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    }
  };

  const addEnemy = () => {
    if (!currentEnemy.name || !currentEnemy.difficultyMultiplier) {
      toast({ title: "Please fill in enemy name and difficulty", variant: "destructive" });
      return;
    }

    if (editingEnemyIndex !== null) {
      // Update existing enemy
      const updatedEnemies = [...enemies];
      updatedEnemies[editingEnemyIndex] = {
        id: enemies[editingEnemyIndex].id,
        name: currentEnemy.name,
        image: currentEnemy.image || dragonImg,
        difficultyMultiplier: currentEnemy.difficultyMultiplier,
      };
      setEnemies(updatedEnemies);
      form.setValue("enemies", updatedEnemies);
      setEditingEnemyIndex(null);
    } else {
      // Add new enemy
      const newEnemy: Enemy = {
        id: Date.now().toString(),
        name: currentEnemy.name,
        image: currentEnemy.image || dragonImg,
        difficultyMultiplier: currentEnemy.difficultyMultiplier,
      };
      const updatedEnemies = [...enemies, newEnemy];
      setEnemies(updatedEnemies);
      form.setValue("enemies", updatedEnemies);
    }
    
    setCurrentEnemy({ image: dragonImg, difficultyMultiplier: 10 });
    setUploadedEnemyImage(null);
  };

  const editEnemy = (index: number) => {
    const enemy = enemies[index];
    setCurrentEnemy({
      name: enemy.name,
      image: enemy.image,
      difficultyMultiplier: enemy.difficultyMultiplier,
    });
    setEditingEnemyIndex(index);
    // Check if this is an uploaded image (starts with http)
    if (enemy.image.startsWith('http')) {
      setUploadedEnemyImage(enemy.image);
    }
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = enemies.findIndex((e) => e.id === active.id);
      const newIndex = enemies.findIndex((e) => e.id === over.id);

      const reorderedEnemies = arrayMove(enemies, oldIndex, newIndex);
      setEnemies(reorderedEnemies);
      form.setValue("enemies", reorderedEnemies);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-950">
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
{/* Solo mode is now controlled per-guild in guild settings */}
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
                      <Textarea
                        value={currentQuestion.question || ""}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                        placeholder="Enter your question text"
                        className="min-h-[100px]"
                        data-testid="textarea-question"
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
                            <div key={i} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <RadioGroupItem
                                  value={String(i)}
                                  id={`option-${i}`}
                                  data-testid={`radio-option-${i}`}
                                  disabled={!opt}
                                />
                                <Label htmlFor={`option-${i}`} className="text-sm">Option {i + 1} (Click to mark as correct)</Label>
                              </div>
                              <Textarea
                                value={opt}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setCurrentQuestion((prev) => {
                                    const newOpts = [...(prev.options || [])];
                                    newOpts[i] = value;
                                    return { ...prev, options: newOpts };
                                  });
                                  if (selectedOptionIndex === i && !value) {
                                    setSelectedOptionIndex(null);
                                    toast({ 
                                      title: "Selection cleared", 
                                      description: "Please select a valid answer option",
                                      variant: "default"
                                    });
                                  }
                                }}
                                placeholder={`Enter option ${i + 1} text`}
                                className="min-h-[60px]"
                                data-testid={`textarea-option-${i}`}
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
                    <CardTitle>{editingEnemyIndex !== null ? 'Edit Enemy' : 'Add Enemy'}</CardTitle>
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
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Enemy Image</label>
                        <div>
                          <input
                            ref={enemyImageInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleEnemyImageUpload}
                            className="hidden"
                            data-testid="input-enemy-image-upload"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => enemyImageInputRef.current?.click()}
                            data-testid="button-upload-enemy-image"
                          >
                            <ImageIcon className="h-4 w-4 mr-2" />
                            Upload Custom Image
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">Choose from pre-defined sprites or upload your own (will be resized to 120x120px)</p>
                      <div className="grid grid-cols-5 gap-3 mt-2 max-h-96 overflow-y-auto pr-2">
                        {uploadedEnemyImage && (
                          <button
                            type="button"
                            onClick={() => setCurrentEnemy({ ...currentEnemy, image: uploadedEnemyImage })}
                            className={`p-2 border-2 rounded-md hover-elevate ${
                              currentEnemy.image === uploadedEnemyImage ? "border-primary" : "border-border"
                            }`}
                            data-testid="button-select-uploaded"
                          >
                            <img src={uploadedEnemyImage} alt="Custom Upload" className="w-full h-20 object-cover rounded" />
                            <p className="text-xs mt-1 truncate">Custom</p>
                          </button>
                        )}
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

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Difficulty: {currentEnemy.difficultyMultiplier || 10}
                        {(currentEnemy.difficultyMultiplier || 10) <= 10 && " (Trash Pack)"}
                        {(currentEnemy.difficultyMultiplier || 10) > 10 && (currentEnemy.difficultyMultiplier || 10) <= 30 && " (Elite)"}
                        {(currentEnemy.difficultyMultiplier || 10) > 30 && (currentEnemy.difficultyMultiplier || 10) <= 60 && " (Boss)"}
                        {(currentEnemy.difficultyMultiplier || 10) > 60 && " (Epic Boss)"}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        HP scales with questions × player levels. Low values = quick fights, high values = epic battles.
                      </p>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[currentEnemy.difficultyMultiplier || 10]}
                          onValueChange={([value]) => setCurrentEnemy({ ...currentEnemy, difficultyMultiplier: value })}
                          min={1}
                          max={100}
                          step={1}
                          className="flex-1"
                          data-testid="slider-enemy-difficulty"
                        />
                        <Input
                          type="number"
                          value={currentEnemy.difficultyMultiplier || 10}
                          onChange={(e) => {
                            const value = Math.max(1, Math.min(100, parseInt(e.target.value) || 10));
                            setCurrentEnemy({ ...currentEnemy, difficultyMultiplier: value });
                          }}
                          min={1}
                          max={100}
                          step={1}
                          className="w-24"
                          data-testid="input-enemy-difficulty"
                        />
                      </div>
                    </div>

                    <Button type="button" onClick={addEnemy} className="w-full" data-testid={editingEnemyIndex !== null ? "button-update-enemy" : "button-add-enemy"}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {editingEnemyIndex !== null ? 'Update Enemy' : 'Add Enemy'}
                    </Button>
                    {editingEnemyIndex !== null && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setEditingEnemyIndex(null);
                          setCurrentEnemy({ image: dragonImg, difficultyMultiplier: 10 });
                          setUploadedEnemyImage(null);
                        }}
                        className="w-full"
                        data-testid="button-cancel-edit-enemy"
                      >
                        Cancel Edit
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {enemies.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Enemies ({enemies.length})</CardTitle>
                      <p className="text-sm text-muted-foreground">Drag to reorder • Enemies appear in this order during combat</p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={enemies.map(e => e.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {enemies.map((enemy, i) => (
                            <SortableEnemyItem
                              key={enemy.id}
                              enemy={enemy}
                              index={i}
                              onEdit={() => editEnemy(i)}
                              onDelete={() => {
                                const updated = enemies.filter((_, idx) => idx !== i);
                                setEnemies(updated);
                                form.setValue("enemies", updated);
                              }}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
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
