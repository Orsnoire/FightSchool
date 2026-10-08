import { ENEMY_CATALOG } from "@shared/combat/enemy-catalog";
import { ENEMY_TYPES } from "@shared/combat/enemy-ai";
import { EnemyAIEditor } from "@/components/EnemyAIEditor";
import { inferEnemyType, enemyAISchema } from "@shared/combat/enemy-ai";
import { GOBLIN_IMAGE, enemyImage, ROLE_SHARES } from "@shared/combat/encounters";
import { ENCOUNTER_TIERS, ENEMY_ROLES, ENEMY_ROLE_LABELS, enemyTuning, inferEnemyRole, type EnemyRole } from "@shared/encounter-tiers";
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
import { useTeacherAuth } from "@/hooks/useTeacherAuth";
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
import { QuestionPreview } from "@/components/QuestionPreview";
import { uploadImageToStorage } from "@/lib/imageUpload";

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
        <img src={enemyImage(enemy)} alt={enemy.name} className="w-12 h-12 object-cover rounded" />
        <div>
          <p className="font-medium">{enemy.name} × {enemy.quantity||1} · Wave {enemy.wave||index+1}</p>
          <p className="text-sm text-muted-foreground">
            {enemy.role ? ENEMY_ROLE_LABELS[enemy.role] : `Legacy difficulty ${enemy.difficultyMultiplier}`}
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
  const { isAuthenticated, isChecking } = useTeacherAuth();
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
    image: ENEMY_CATALOG.zombie.image,
    difficultyMultiplier: 10,
    role:"normal",
  });
  const [editingEnemyIndex, setEditingEnemyIndex] = useState<number | null>(null);
  const [uploadedEnemyImage, setUploadedEnemyImage] = useState<string | null>(null);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const enemyImageInputRef = useRef<HTMLInputElement>(null);

  const teacherId = localStorage.getItem("teacherId") || "";

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
      encounterTier:1,
      baseXP: 10,
      baseEnemyDamage: 1,
      enemyDisplayMode: "consecutive",
      lootTable: [],
      randomizeQuestions: false,
      shuffleOptions: true,
    },
  });

  const encounterTier=form.watch('encounterTier');
  const changeTier=(tier:number)=>{
    form.setValue('encounterTier',tier);form.setValue('baseEnemyDamage',enemyTuning(tier,'normal').baseEnemyDamage);
    const next=enemies.map((e,i)=>({...e,quantity:e.quantity||1,wave:e.wave||i+1,species:e.species||(enemyImage(e)===GOBLIN_IMAGE?'goblin':'other'),role:e.role||inferEnemyRole(e.difficultyMultiplier),difficultyMultiplier:enemyTuning(tier,e.role||inferEnemyRole(e.difficultyMultiplier)).difficultyMultiplier}));
    setEnemies(next);form.setValue('enemies',next);
    setCurrentEnemy(e=>({...e,role:e.role||inferEnemyRole(e.difficultyMultiplier||10),difficultyMultiplier:enemyTuning(tier,e.role||inferEnemyRole(e.difficultyMultiplier||10)).difficultyMultiplier}));
  };
  // Populate form with existing fight data in edit mode
  useEffect(() => {
    if (existingFight && isEditMode) {
      form.reset({
        teacherId: existingFight.teacherId,
        encounterTier:existingFight.encounterTier||null,
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
      setCurrentEnemy({ ...currentEnemy, image: imageUrl, species:"other" });
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

    const type = currentEnemy.enemyType || inferEnemyType(currentEnemy.image);
    if (type === "basic") { toast({ title: "Choose a supported enemy type", variant: "destructive" }); return; }
    if (enemies.reduce((n, e, i) => n + (i === editingEnemyIndex ? 0 : e.quantity || 1), 0) + Math.max(ENEMY_CATALOG[type].minimumQuantity, currentEnemy.quantity || 1) > 120) {
      toast({ title: "Use at most 120 individual enemies per fight", variant: "destructive" }); return;
    }
    if (editingEnemyIndex !== null) {
      // Update existing enemy
      const updatedEnemies = [...enemies];
      updatedEnemies[editingEnemyIndex] = {
        id: enemies[editingEnemyIndex].id,
        quantity:Math.max(ENEMY_CATALOG[type].minimumQuantity,currentEnemy.quantity||1), wave:currentEnemy.wave||1, species:type==="goblin"?"goblin":"other",
        name: currentEnemy.name,
        image: currentEnemy.image || ENEMY_CATALOG.zombie.image,
        enemyType: type,
        ai: enemyAISchema.parse(currentEnemy.ai || {}),
        difficultyMultiplier: encounterTier ? enemyTuning(encounterTier,currentEnemy.role||"normal").difficultyMultiplier : currentEnemy.difficultyMultiplier,
        ...(encounterTier?{role:currentEnemy.role||"normal"}:{}),
      };
      setEnemies(updatedEnemies);
      form.setValue("enemies", updatedEnemies);
      setEditingEnemyIndex(null);
    } else {
      // Add new enemy
      const newEnemy: Enemy = {
        id: Date.now().toString(),
        quantity:Math.max(ENEMY_CATALOG[type].minimumQuantity,currentEnemy.quantity||1), wave:currentEnemy.wave||1, species:type==="goblin"?"goblin":"other",
        name: currentEnemy.name,
        image: currentEnemy.image || ENEMY_CATALOG.zombie.image,
        enemyType: type,
        ai: enemyAISchema.parse(currentEnemy.ai || {}),
        difficultyMultiplier: encounterTier ? enemyTuning(encounterTier,currentEnemy.role||"normal").difficultyMultiplier : currentEnemy.difficultyMultiplier,
        ...(encounterTier?{role:currentEnemy.role||"normal"}:{}),
      };
      const updatedEnemies = [...enemies, newEnemy];
      setEnemies(updatedEnemies);
      form.setValue("enemies", updatedEnemies);
    }
    
    setCurrentEnemy({ image: ENEMY_CATALOG.zombie.image, difficultyMultiplier: 10, role:"normal", quantity:1, wave:currentEnemy.wave||1 });
    setUploadedEnemyImage(null);
  };

  const editEnemy = (index: number) => {
    const enemy = enemies[index];
    const type = enemy.enemyType || inferEnemyType(enemy.image);
    setCurrentEnemy({
      quantity:enemy.quantity||1,wave:enemy.wave||index+1,species:enemy.species||(enemyImage(enemy)===GOBLIN_IMAGE?"goblin":"other"),
      name: enemy.name,
      image: enemy.image,
      difficultyMultiplier: enemy.difficultyMultiplier,
      role:enemy.role,
      enemyType: type === "basic" ? undefined : type,
      ai: enemy.ai,
    });
    setEditingEnemyIndex(index);
    // Check if this is an uploaded image (starts with http)
    if (enemy.image.startsWith('http')) {
      setUploadedEnemyImage(enemy.image);
    }
  };

  const onSubmit = (data: InsertFight) => {
    if (enemies.some(e => (e.enemyType || inferEnemyType(e.image)) === "basic")) {
      toast({ title: "Choose a supported type for each retired enemy before saving", variant: "destructive" }); return;
    }
    if (questions.length === 0) {
      toast({ title: "Add at least one question", variant: "destructive" });
      return;
    }
    if (enemies.reduce((n, e) => n + (e.quantity || 1), 0) > 120) {
      toast({ title: "Use at most 120 enemies across all waves", variant: "destructive" });
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

    setIsUploadingCSV(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsedQuestions: Question[] = [];
          
          for (const row of results.data as any[]) {
            // Case-insensitive field lookup helper
            const getField = (fieldName: string) => {
              const keys = Object.keys(row);
              const matchingKey = keys.find(k => k.toLowerCase() === fieldName.toLowerCase());
              return matchingKey ? row[matchingKey] : undefined;
            };
            
            const questionText = getField("question text")?.trim();
            const questionType = getField("question type")?.trim().toLowerCase();
            const timerValue = getField("timer") || getField("time limit") || getField("timelimit");
            const answer1 = getField("answer1")?.trim();
            const answer2 = getField("answer2")?.trim();
            const answer3 = getField("answer3")?.trim();
            const answer4 = getField("answer4")?.trim();
            
            if (!questionText || !questionType || !answer1) {
              continue;
            }
            
            // Parse timer value, default to 30 if invalid
            let timeLimit = 30;
            if (timerValue) {
              const parsed = parseInt(String(timerValue).trim());
              if (!isNaN(parsed) && parsed >= 5 && parsed <= 120) {
                timeLimit = parsed;
              }
            }
            
            const newQuestion: Question = {
              id: Date.now().toString() + Math.random(),
              question: questionText,
              type: questionType === "true/false" || questionType === "true_false" || questionType === "tf" ? "true_false" : 
                    questionType === "short answer" || questionType === "short_answer" || questionType === "sa" ? "short_answer" : 
                    "multiple_choice",
              correctAnswer: answer1,
              timeLimit: timeLimit,
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
            setIsUploadingCSV(false);
            toast({ 
              title: "No valid questions found", 
              description: "Please check your CSV format",
              variant: "destructive" 
            });
            return;
          }
          
          // Use setTimeout to allow the browser to process the parsed questions
          // This prevents blocking the main thread with large CSV files
          setTimeout(() => {
            try {
              const updatedQuestions = [...questions, ...parsedQuestions];
              setQuestions(updatedQuestions);
              form.setValue("questions", updatedQuestions);
              
              setIsUploadingCSV(false);
              toast({ 
                title: `Successfully imported ${parsedQuestions.length} questions`,
                variant: "default"
              });
              
              if (csvInputRef.current) {
                csvInputRef.current.value = "";
              }
            } catch (error) {
              setIsUploadingCSV(false);
              toast({ 
                title: "Failed to add questions", 
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive" 
              });
            }
          }, 0);
        } catch (error) {
          setIsUploadingCSV(false);
          toast({ 
            title: "Failed to parse CSV", 
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive" 
          });
        }
      },
      error: (error) => {
        setIsUploadingCSV(false);
        toast({ 
          title: "Failed to read CSV file", 
          description: error.message,
          variant: "destructive" 
        });
      }
    });
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-950 flex items-center justify-center">
        <div className="text-white text-xl">Verifying session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

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
                        <Input placeholder="The Goblin Ambush" {...field} data-testid="input-title" />
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
                <div className="space-y-3"><Label>Fight tier: {encounterTier||'Legacy tuning'}</Label>
                  {encounterTier?<><input className="w-full" aria-label="Fight tier" type="range" min="1" max="4" step="1" value={encounterTier} onChange={e=>changeTier(+e.target.value)}/><div className="flex justify-between text-xs">{ENCOUNTER_TIERS.map(t=><span key={t.label}>{t.label} · up to Lv {t.level}</span>)}</div><p className="text-sm text-muted-foreground">Choose the intended progression tier. Enemy roles set the challenge within it; HP uses the tier reference party and quiz length; solo/duo fights use their entry loadouts.</p></>:<><p className="text-sm text-muted-foreground">This fight retains its existing tuning. Switch explicitly to use tier and role presets.</p><Button type="button" variant="outline" onClick={()=>changeTier(1)}>Use tier presets</Button></>}
                </div>
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
                          <SelectItem value="consecutive">Consecutive waves</SelectItem>
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
                          Shuffle questions at the start and each time a wave-based fight repeats its question bank.
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
                          disabled={isUploadingCSV}
                          data-testid="button-upload-csv"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {isUploadingCSV ? "Importing..." : "Import CSV"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      CSV format: "question text", "question type", "timer", "answer1", "answer2", "answer3", "answer4"<br />
                      Question types: multiple_choice/MC, true_false/TF, short_answer/SA (case-insensitive)<br />
                      Timer: seconds (5-120), defaults to 30 if omitted
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

                    {currentQuestion.question?.trim() && (
                      <section aria-label="Student preview" className="space-y-2">
                        <h3 className="text-sm font-medium">Student preview</h3>
                        <QuestionPreview question={currentQuestion} />
                      </section>
                    )}

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
                        <div key={q.id} className="flex items-start gap-3 p-3 border border-border rounded-md" data-testid={`question-item-${i}`}>
                          <div className="min-w-0 flex-1 space-y-3">
                            <p className="font-medium">Question {i + 1} <span className="text-sm font-normal text-muted-foreground">• {q.timeLimit}s</span></p>
                            <QuestionPreview question={q} />
                            <details className="text-sm">
                              <summary className="cursor-pointer text-muted-foreground">View source</summary>
                              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3">{q.question}</pre>
                            </details>
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
                        placeholder="Frost Zombie"
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
                      <p className="text-xs text-muted-foreground mb-2">Choose one creature sprite; quantity controls how many appear. Custom images are resized to 120×120px.</p>
                      <div className="grid grid-cols-5 gap-3 mt-2 max-h-96 overflow-y-auto pr-2">
                        {uploadedEnemyImage && (
                          <button
                            type="button"
                            onClick={() => setCurrentEnemy({ ...currentEnemy, image: uploadedEnemyImage, species:"other" })}
                            className={`p-2 border-2 rounded-md hover-elevate ${
                              currentEnemy.image === uploadedEnemyImage ? "border-primary" : "border-border"
                            }`}
                            data-testid="button-select-uploaded"
                          >
                            <img src={uploadedEnemyImage} alt="Custom Upload" className="w-full h-20 object-cover rounded" />
                            <p className="text-xs mt-1 truncate">Custom</p>
                          </button>
                        )}
                        {ENEMY_TYPES.map(id => ({ id, img: ENEMY_CATALOG[id].image, name: ENEMY_CATALOG[id].name })).map((enemy) => (
                          <button
                            key={enemy.id}
                            type="button"
                            onClick={() => setCurrentEnemy({ ...currentEnemy, image: enemy.img, enemyType: enemy.id,
                              species: enemy.id === "goblin" ? "goblin" : "other", name: currentEnemy.name || enemy.name,
                              quantity: Math.max(ENEMY_CATALOG[enemy.id].minimumQuantity, currentEnemy.quantity || 1), ai: undefined })}
                            className={`p-2 border-2 rounded-md hover-elevate ${
                              currentEnemy.image === enemy.img ? "border-primary" : "border-border"
                            }`}
                            data-testid={`button-select-${enemy.id}`}
                          >
                            <img src={enemy.img} alt={enemy.name} className="w-full h-20 object-contain rounded" />
                            <p className="text-xs mt-1 truncate">{enemy.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <label>Quantity<input aria-label="Enemy quantity" type="number" min={currentEnemy.enemyType === "goblin" ? 5 : 1} max="60" value={currentEnemy.quantity||1} onChange={e=>setCurrentEnemy({...currentEnemy,quantity:Math.max(currentEnemy.enemyType === "goblin" ? 5 : 1,Math.min(60,+e.target.value))})} className="block w-full p-2 border rounded bg-background"/></label>
                      {form.watch('enemyDisplayMode')==='consecutive'&&<label>Wave<input aria-label="Enemy wave" type="number" min="1" max="20" value={currentEnemy.wave||1} onChange={e=>setCurrentEnemy({...currentEnemy,wave:Math.max(1,Math.min(20,+e.target.value))})} className="block w-full p-2 border rounded bg-background"/></label>}
                    </div>
                    <p className="text-xs text-muted-foreground">Enemies assigned to the same wave fight together. Hosted fights pause between waves; HP and MP carry forward.</p>
                    <fieldset className="space-y-3 border rounded-lg p-4"><legend className="px-2 font-medium">Enemy role</legend>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{ENEMY_ROLES.map(role=><label key={role} className={`flex items-center gap-2 rounded border p-3 cursor-pointer ${currentEnemy.role===role?'border-primary bg-primary/10':''}`}><input type="radio" name="enemy-role" value={role} checked={currentEnemy.role===role} onChange={()=>{if(!encounterTier)changeTier(1);setCurrentEnemy(e=>({...e,role,difficultyMultiplier:enemyTuning(encounterTier||1,role).difficultyMultiplier}));}}/>{ENEMY_ROLE_LABELS[role]}</label>)}</div>
                      <p className="text-sm text-muted-foreground">{Math.round(ROLE_SHARES[currentEnemy.role||'normal']*100)}% of the full fight HP budget is shared by all enemies of this role across every wave. Missing roles leave their allocation unused. Goblin trash gets +1% of its allocation per three goblins.</p>
                    </fieldset>

                    <EnemyAIEditor enemy={currentEnemy} onChange={setCurrentEnemy} />
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
                          setCurrentEnemy({ image: ENEMY_CATALOG.zombie.image, difficultyMultiplier: 10, role:"normal", quantity:1, wave:currentEnemy.wave||1 });
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
                      <CardTitle>Enemies ({enemies.reduce((n,e)=>n+(e.quantity||1),0)}) · {enemies.length} groups</CardTitle>
                      <p className="text-sm text-muted-foreground">Drag to set target-bounce order within each wave. Edit a group to change its quantity or wave.</p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {enemies.every(e => e.quantity === undefined) && <Button type="button" variant="outline" onClick={() => changeTier(encounterTier || 1)}>Convert to individual enemies and wave budgets</Button>}
                      {form.watch('enemyDisplayMode') === 'consecutive' && enemies.some(e => e.quantity !== undefined) && <div className="grid gap-2 sm:grid-cols-2">{[...new Set(enemies.map((e,i) => e.wave || i+1))].sort((a,b) => a-b).map(wave => <div key={wave} className="rounded border p-2 text-sm"><strong>Wave {wave}</strong><p>{enemies.filter((e,i) => (e.wave || i+1) === wave).map(e => `${e.name} × ${e.quantity || 1}`).join(', ')}</p></div>)}</div>}
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
                                {item.stats.vit ? ` +${item.stats.vit} HP` : ''}
                                {item.stats.atk ? ` +${item.stats.atk} ATK` : ''}
                                {item.stats.def ? ` +${item.stats.def} DEF` : ''}
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
