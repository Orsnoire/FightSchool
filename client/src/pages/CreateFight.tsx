import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Tabs,TabsList,TabsTrigger } from "@/components/ui/tabs";
import { EnemiesPanel } from "@/features/fight-authoring/EnemiesPanel";
import { FightSettings } from "@/features/fight-authoring/FightSettings";
import { LootPanel } from "@/features/fight-authoring/LootPanel";
import { QuestionsPanel } from "@/features/fight-authoring/QuestionsPanel";
import { useEnemyAuthoring } from "@/features/fight-authoring/useEnemyAuthoring";
import { useQuestionAuthoring } from "@/features/fight-authoring/useQuestionAuthoring";
import { useToast } from "@/hooks/use-toast";
import { useTeacherAuth } from "@/hooks/useTeacherAuth";
import { apiRequest,queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { enemyImage,GOBLIN_IMAGE } from "@shared/combat/encounters";
import { inferEnemyType } from "@shared/combat/enemy-ai";
import { enemyTuning,inferEnemyRole } from "@shared/encounter-tiers";
import { insertFightSchema,type Enemy,type EquipmentItemDb,type Fight,type InsertFight,type LootItem,type Question } from "@shared/schema";
import { useMutation,useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useEffect,useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation,useRoute } from "wouter";


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
  const changeQuestions = (next: Question[]) => { setQuestions(next); form.setValue('questions', next); };
  const changeEnemies = (next: Enemy[]) => { setEnemies(next); form.setValue('enemies', next); };
  const changeLoot = (next: LootItem[]) => { setLootTable(next); form.setValue('lootTable', next); };
  const questionEditor = useQuestionAuthoring(questions, changeQuestions);
  const enemyEditor = useEnemyAuthoring(enemies, changeEnemies, encounterTier);
  const changeTier=(tier:number)=>{
    form.setValue('encounterTier',tier);form.setValue('baseEnemyDamage',enemyTuning(tier,'normal').baseEnemyDamage);
    const next=enemies.map((e,i)=>({...e,quantity:e.quantity||1,wave:e.wave||i+1,species:e.species||(enemyImage(e)===GOBLIN_IMAGE?'goblin':'other'),role:e.role||inferEnemyRole(e.difficultyMultiplier),difficultyMultiplier:enemyTuning(tier,e.role||inferEnemyRole(e.difficultyMultiplier)).difficultyMultiplier}));
    setEnemies(next);form.setValue('enemies',next);
    enemyEditor.setCurrentEnemy(e=>({...e,role:e.role||inferEnemyRole(e.difficultyMultiplier||10),difficultyMultiplier:enemyTuning(tier,e.role||inferEnemyRole(e.difficultyMultiplier||10)).difficultyMultiplier}));
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

  const onSubmit = (data: InsertFight) => {
    if(questionEditor.editingQuestionId){toast({title:"Save or cancel your question changes before saving the fight",variant:"destructive"});return;}
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
            <FightSettings form={form} encounterTier={encounterTier} changeTier={changeTier} />

            <Tabs defaultValue="questions" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="questions" data-testid="tab-questions">Questions ({questions.length})</TabsTrigger>
                <TabsTrigger value="enemies" data-testid="tab-enemies">Enemies ({enemies.length})</TabsTrigger>
                <TabsTrigger value="loot" data-testid="tab-loot">Loot ({lootTable.length})</TabsTrigger>
              </TabsList>

              <QuestionsPanel questions={questions} onChange={changeQuestions} editor={questionEditor} />
              <EnemiesPanel enemies={enemies} onChange={changeEnemies} encounterTier={encounterTier}
                enemyDisplayMode={form.watch('enemyDisplayMode')} changeTier={changeTier} editor={enemyEditor} />
              <LootPanel lootTable={lootTable} teacherEquipment={teacherEquipment} equipmentLoading={equipmentLoading} onChange={changeLoot} />
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
