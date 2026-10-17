import {
  questProgress,
  type QuestContext,
  type QuestProgress,
} from "../../shared/quests";
import { questionKey } from "./question-key";
import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { GameDatabase } from "../db/game-repository.ts";
import * as s from "../db/schema.ts";
import { JOB_TREE } from "../../shared/jobSystem.ts";
import {
  ALL_CHARACTER_CLASSES,
  getGuildLevelFromXP,
  type CharacterClass,
  type QuestCriteria,
} from "../../shared/schema.ts";
import { questData, WEEK_MS, EVIDENCE_TYPES, LEVEL_TYPES, TOTAL_TYPES } from "./quest-data.ts";

async function seed(
  db: GameDatabase,
  values: (typeof s.quests.$inferInsert)[],
) {
  if (values.length)
    await db.insert(s.quests).values(values).onConflictDoNothing();
}
export async function seedGuildQuests(db: GameDatabase, guildId: string) {
  await seed(db, [
    ...Array.from({ length: 9 }, (_, i) => ({
      guildId,
      title: `Shop tier ${i + 2}`,
      description: `Answer ${(i + 1) * 100} questions correctly together.`,
      questType: "guild" as const,
      criteria: {
        type: "total_correct_answers" as const,
        targetAmount: (i + 1) * 100,
      },
      rewards: { unlockTier: i + 2, guildXP: 25 * (i + 1) },
      isSeeded: true,
    })),
    {
      guildId,
      title: "Weekly accuracy",
      description:
        "Complete a group fight with at least 70% accuracy this week.",
      questType: "weekly",
      criteria: {
        type: "custom",
        criteria1: {
          mode: "teacher",
          accuracy: 70,
          performanceType: "class_average",
        },
      },
      rewards: { guildXP: 100 },
      isSeeded: true,
    },
    {
      guildId,
      title: "Weekly teamwork",
      description:
        "Complete a group fight with everyone answering correctly this week.",
      questType: "weekly",
      criteria: {
        type: "custom",
        criteria1: {
          mode: "teacher",
          accuracy: 100,
          performanceType: "class_average",
        },
      },
      rewards: { guildXP: 150 },
      isSeeded: true,
    },
  ]);
}
export async function seedPersonalQuests(
  db: GameDatabase,
  studentId: string,
  guildId: string,
) {
  await seed(
    db,
    ALL_CHARACTER_CLASSES.flatMap((job) => [
      ...(JOB_TREE[job].unlockRequirements
        ? [
            {
              guildId,
              studentId,
              questType: "personal" as const,
              title: `Unlock ${JOB_TREE[job].name}`,
              description: `Meet the requirements to unlock ${JOB_TREE[job].name}.`,
              criteria: { type: "unlock_job" as const, targetJob: job },
              rewards: { gold: 100 },
              isSeeded: true,
            },
          ]
        : []),
      {
        guildId,
        studentId,
        questType: "personal" as const,
        title: `${JOB_TREE[job].name} cross-class license`,
        description: `Unlock the first cross-class ability from ${JOB_TREE[job].name}.`,
        criteria: { type: "unlock_license" as const, targetJob: job },
        rewards: { gold: 100 },
        isSeeded: true,
      },
      ...[4, 8, 10].map((level) => ({
        guildId,
        studentId,
        questType: "personal" as const,
        title: `${JOB_TREE[job].name} level ${level}`,
        description: `Reach level ${level} as ${JOB_TREE[job].name}.`,
        criteria: {
          type: "reach_job_level" as const,
          targetJob: job,
          targetLevel: level,
        },
        rewards: { gold: level * 50 },
        isSeeded: true,
      })),
      {
        guildId,
        studentId,
        questType: "personal" as const,
        title: `${JOB_TREE[job].name} ultimate`,
        description: `Reach level 15 as ${JOB_TREE[job].name} and discover your ultimate.`,
        criteria: {
          type: "unlock_ultimate" as const,
          targetJob: job,
          targetLevel: 15,
        },
        rewards: { gold: 1500 },
        isSeeded: true,
      },
    ]),
  );
}
export function criterionSatisfied(
  c: QuestCriteria,
  levels: Partial<Record<CharacterClass, number>>,
  totals: QuestContext["totals"],
  guildLevel: number,
): boolean {
  return questProgress(c, {
    levels,
    totals,
    guildLevel,
    limitTier: 4,
    members: [],
    unlockedJobs: [],
    evidence: [],
  }).complete;
}
export type QuestView = typeof s.quests.$inferSelect & {
  progress: QuestProgress;
};
export type QuestEvent =
  | { kind: "evidence" | "results"; studentIds: string[]; fightId: string }
  | { kind: "levels"; studentIds: string[] }
  | { kind: "membership"; studentIds: string[] }
  | { kind: "quests"; questIds: string[] }
  | { kind: "bank"; fightId: string }
  | { kind: "guild" }
  | { kind: "reconcile" };

function affected(event:QuestEvent):SQL|undefined {
  if(event.kind==='reconcile')return undefined;
  if(event.kind==='quests')return inArray(s.quests.id,event.questIds);
  const type=sql`${s.quests.criteria}->>'type'`;
  if(event.kind==='bank')return and(sql`${type}='master_bank'`,sql`${s.quests.criteria}->>'fightId'=${event.fightId}`);
  if(event.kind==='guild')return inArray(type,['guild_level','class_at_cap']);
  const audience=or(isNull(s.quests.studentId),inArray(s.quests.studentId,event.studentIds));
  if(event.kind==='membership')return audience;
  if(event.kind==='levels')return and(audience,inArray(type,LEVEL_TYPES));
  const fightMatch=sql`(${type}='custom' OR ${s.quests.criteria}->>'fightId' IS NULL OR ${s.quests.criteria}->>'fightId'=${event.fightId})`;
  const evidenceMatch=and(inArray(type,EVIDENCE_TYPES),fightMatch,sql`(
    ${type}<>'custom' OR EXISTS(SELECT 1 FROM jsonb_array_elements(jsonb_build_array(
      ${s.quests.criteria}->'criteria1',${s.quests.criteria}->'criteria2',${s.quests.criteria}->'criteria3')) c
      WHERE c <> 'null'::jsonb AND (c->>'fightId' IS NULL OR c->>'fightId'=${event.fightId})))`);
  return and(audience,event.kind==='evidence'?evidenceMatch:or(evidenceMatch,inArray(type,TOTAL_TYPES)));
}

/** Read-only projection, scoped before querying history. Student views never load peers' quests. */
export async function readQuestViews(db:GameDatabase,guildId:string,studentId?:string):Promise<QuestView[]> {
  return projectQuests(db,guildId,{studentId});
}

async function projectQuests(db:GameDatabase,guildId:string,options:{studentId?:string;event?:QuestEvent;manualQuestId?:string;effects?:{guild:boolean;students:Set<string>}}={}):Promise<QuestView[]> {
  const [guild]=await db.select().from(s.guilds).where(eq(s.guilds.id,guildId));
  if(!guild)return [];
  const week=Math.floor(Date.now()/WEEK_MS);
  const quests=await db.select().from(s.quests).where(and(eq(s.quests.guildId,guildId),
    options.studentId?or(isNull(s.quests.studentId),eq(s.quests.studentId,options.studentId)):undefined,
    options.event?and(eq(s.quests.isArchived,false),affected(options.event),
      options.event.kind==='reconcile'?undefined:sql`(NOT ${s.quests.isCompleted}
        OR (${s.quests.questType}='weekly' AND ${s.quests.completedWeek} IS DISTINCT FROM ${week})
        OR EXISTS(SELECT 1 FROM guild_memberships m WHERE m.guild_id=${guildId}::uuid
          AND (${s.quests.studentId} IS NULL OR m.student_id=${s.quests.studentId})
          AND NOT EXISTS(SELECT 1 FROM quest_completions c WHERE c.quest_id=${s.quests.id} AND c.student_id=m.student_id
            AND c.period=CASE WHEN ${s.quests.questType}='weekly' THEN ${String(week)} ELSE 'once' END)))`):undefined));
  if(!quests.length)return [];
  const members=await db.select({studentId:s.guildMemberships.studentId,grantedJobs:s.students.grantedJobs})
    .from(s.guildMemberships).innerJoin(s.students,eq(s.students.id,s.guildMemberships.studentId)).where(eq(s.guildMemberships.guildId,guildId));
  const ids=members.map(m=>m.studentId), activeIds=new Set(ids);
  const jobs=ids.length?await db.select({studentId:s.studentJobLevels.studentId,job:s.studentJobLevels.jobClass,level:s.studentJobLevels.level})
    .from(s.studentJobLevels).where(inArray(s.studentJobLevels.studentId,ids)):[];
  const levels=new Map<string,Partial<Record<CharacterClass,number>>>();
  for(const j of jobs){if(!levels.has(j.studentId))levels.set(j.studentId,{});levels.get(j.studentId)![j.job]=j.level;}
  const grants=new Map(members.map(m=>[m.studentId,m.grantedJobs]));
  const memberLevels=ids.map(id=>({levels:levels.get(id)||{}}));
  const totals=new Map<string,QuestContext['totals']>();
  if(quests.some(q=>TOTAL_TYPES.includes(q.criteria.type))){
    // At most two rows per student, regardless of history size. Historical guild
    // totals include departed members just as before; current membership gates awards.
    const result=await db.execute(sql`SELECT student_id,
      (completed_at>=${week*WEEK_MS} AND completed_at<${(week+1)*WEEK_MS}) AS this_week,
      COALESCE(sum((totals->>'questionsCorrect')::double precision),0) AS correct,
      COALESCE(sum((totals->>'damageDealt')::double precision),0) AS damage,
      COALESCE(sum((totals->>'healingDone')::double precision),0) AS healing
      FROM combat_results WHERE guild_id=${guildId}::uuid
      GROUP BY student_id,this_week`);
    const add=(key:string,r:any)=>{const t=totals.get(key)||{correct:0,damage:0,healing:0};for(const k of ['correct','damage','healing'] as const)t[k]+=Number(r[k]);totals.set(key,t);};
    for(const r of result.rows as any[]){add(r.student_id,r);add('guild',r);if(r.this_week){add(r.student_id+':week',r);add('guild:week',r);}}
  }
  const bankIds=[...new Set(quests.filter(q=>q.criteria.type==='master_bank'&&q.criteria.fightId).map(q=>q.criteria.fightId!))];
  const fights=bankIds.length?await db.select({id:s.fights.id,questions:s.fights.questions}).from(s.fights)
    .where(and(eq(s.fights.teacherId,guild.teacherId),inArray(s.fights.id,bankIds))):[];
  const banks=new Map(fights.map(f=>[f.id,f.questions.map(questionKey)]));
  const progress=questData(db,guildId,week);
  const views:QuestView[]=[], awards:Array<{id:string;period:string;recipients:string[]}>=[];
  for(const q of quests){
    const context:QuestContext={levels:levels.get(q.studentId||'')||{},unlockedJobs:grants.get(q.studentId||'')||[],
      members:memberLevels,limitTier:guild.limitTier,guildLevel:guild.level,
      totals:totals.get((q.studentId||'guild')+(q.questType==='weekly'?':week':''))||{correct:0,damage:0,healing:0},
      evidence:[],bankKeys:q.criteria.fightId?banks.get(q.criteria.fightId):undefined};
    let p=await progress(q.criteria,context,q.studentId,q.questType==='weekly');
    if(!q.studentId&&LEVEL_TYPES.includes(q.criteria.type)&&q.criteria.type!=='class_at_cap'){
      for(const id of ids){const candidate=questProgress(q.criteria,{...context,levels:levels.get(id)||{},unlockedJobs:grants.get(id)||[]});if(candidate.current>p.current)p=candidate;}
    }
    const already=q.isCompleted&&(q.questType!=='weekly'||q.completedWeek===week);
    const complete=already||p.complete||q.id===options.manualQuestId;
    const eligible=!guild.isArchived&&!q.isArchived&&(!q.studentId||activeIds.has(q.studentId));
    // A read reports earned state but never creates a reward. Explicit events and
    // reconciliation retain receipt-based catch-up for members joining later.
    if(options.event&&complete&&eligible){
      const recipients=q.studentId?[q.studentId]:ids;
      awards.push({id:q.id,period:q.questType==='weekly'?String(week):'once',recipients});
      if(options.effects){
        if(!already&&(q.rewards?.guildXP||q.rewards?.limitBreak))options.effects.guild=true;
        if(q.rewards?.unlockJob)for(const id of recipients)if(!grants.get(id)?.includes(q.rewards.unlockJob))options.effects.students.add(id);
      }
    }
    views.push({...q,isCompleted:already||!!options.event&&eligible&&complete,progress:{...p,complete:already||p.complete}});
  }
  if(awards.length){
    await db.execute(sql`SELECT award_quest_batch(${guildId}::uuid,${JSON.stringify(awards)}::jsonb)`);
    const [updated]=await db.select({experience:s.guilds.experience}).from(s.guilds).where(eq(s.guilds.id,guildId));
    // Optimistic guard prevents a slower room from replacing a newer derived level.
    await db.update(s.guilds).set({level:getGuildLevelFromXP(updated.experience)})
      .where(and(eq(s.guilds.id,guildId),eq(s.guilds.experience,updated.experience)));
  }
  return views;
}

/** Explicit reconciliation remains available for legacy imports and teacher edits. */
export async function evaluateQuests(db:GameDatabase,guildId:string,manualQuestId?:string,event:QuestEvent={kind:'reconcile'}):Promise<QuestView[]> {
  const effects={guild:false,students:new Set<string>()};
  const views=await projectQuests(db,guildId,{event,manualQuestId,effects});
  // Only reward dependencies are revisited, after their atomic write, until no
  // newly earned grant/tier/XP can unlock another objective. Receipts terminate retries.
  if(effects.students.size)await evaluateStudentLevels(db,[...effects.students]);
  if(effects.guild)await evaluateQuests(db,guildId,undefined,{kind:'guild'});
  return views;
}

export async function evaluateStudentLevels(db:GameDatabase,studentIds:string[]) {
  if(!studentIds.length)return;
  const memberships=await db.select({guildId:s.guildMemberships.guildId,studentId:s.guildMemberships.studentId}).from(s.guildMemberships)
    .where(inArray(s.guildMemberships.studentId,studentIds));
  const guilds=new Map<string,string[]>();
  for(const m of memberships){if(!guilds.has(m.guildId))guilds.set(m.guildId,[]);guilds.get(m.guildId)!.push(m.studentId);}
  for(const [guildId,ids] of guilds)await evaluateQuests(db,guildId,undefined,{kind:'levels',studentIds:ids});
}

export async function evaluateFightQuests(db:GameDatabase,fightId:string,teacherId:string) {
  const rows=await db.selectDistinct({guildId:s.quests.guildId}).from(s.quests).innerJoin(s.guilds,eq(s.guilds.id,s.quests.guildId))
    .where(and(eq(s.guilds.teacherId,teacherId),sql`${s.quests.criteria}->>'type'='master_bank'`,sql`${s.quests.criteria}->>'fightId'=${fightId}`));
  for(const r of rows)await evaluateQuests(db,r.guildId!,undefined,{kind:'bank',fightId});
}
