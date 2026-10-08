import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  LIMIT_CAPS,
  QUEST_OBJECTIVES,
  rewardLabels,
  type ObjectiveType,
} from "@shared/quests";
import { JOB_TREE } from "@shared/jobSystem";
import {
  ALL_CHARACTER_CLASSES,
  EQUIPMENT_ITEMS,
  type CharacterClass,
  type Quest,
  type Guild,
  type EquipmentItemDb,
} from "@shared/schema";
import type { QuestView } from "./QuestBoard";
const inputClass = "block w-full rounded border bg-background p-2 mt-1";
const blank = () => ({
  title: "",
  description: "",
  audience: "guild",
  weekly: false,
  type: "manual" as ObjectiveType,
  fightId: "",
  targetJob: "warrior" as CharacterClass,
  targetLevel: 4,
  targetAmount: 3,
  accuracy: 80,
  percentage: 75,
  mode: "any",
  performanceType: "individual",
  gold: 0,
  guildXP: 0,
  unlockTier: 0,
  limitBreak: 0,
  unlockJob: "",
  equipmentItemId: "",
});
export function GuildAdministration({ guild }: { guild: Guild }) {
  const client = useQueryClient();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Quest | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [limits, setLimits] = useState(guild.limitTier);
  const [xp, setXp] = useState(guild.experience);
  const [shop, setShop] = useState(guild.unlockedTier);
  const [showCompleted, setShowCompleted] = useState(false);
  useEffect(() => {
    setLimits(guild.limitTier);
    setXp(guild.experience);
    setShop(guild.unlockedTier);
  }, [guild.limitTier, guild.experience, guild.unlockedTier]);
  const quests = useQuery<QuestView[]>({
    queryKey: [`/api/guilds/${guild.id}/quests`],
    refetchOnWindowFocus: "always",
  });
  const fights = useQuery<Array<{ id: string; title: string }>>({
    queryKey: [`/api/guilds/${guild.id}/fights`],
  });
  const members = useQuery<Array<{ studentId: string; nickname: string }>>({
    queryKey: [`/api/guilds/${guild.id}/members`],
  });
  const items = useQuery<EquipmentItemDb[]>({
    queryKey: [`/api/teacher/${guild.teacherId}/equipment-items`],
  });
  const set = (key: keyof ReturnType<typeof blank>, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));
  const mutate = async (method: string, path: string, body?: unknown) => {
    if (busy) return false;
    setBusy(true);
    setMessage("");
    try {
      await apiRequest(method, path, body);
      await Promise.all([
        client.invalidateQueries({ queryKey: [`/api/guilds/${guild.id}`] }),
        client.invalidateQueries({
          queryKey: [`/api/guilds/${guild.id}/quests`],
        }),
        client.invalidateQueries({
          queryKey: [`/api/guilds/${guild.id}/members`],
        }),
      ]);
      setMessage("Saved");
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    const personal = form.audience !== "guild";
    const criteria: any =
      editing &&
      !(form.type in QUEST_OBJECTIVES) &&
      form.type === editing.criteria.type
        ? { ...editing.criteria }
        : { type: form.type };
    if (
      [
        "fight_accuracy",
        "perfect_clear",
        "master_bank",
        "try_solo",
        "solo_fights",
      ].includes(form.type)
    ) {
      if (form.fightId) criteria.fightId = form.fightId;
      criteria.mode = form.mode;
      criteria.performanceType = form.performanceType;
    }
    if (["unlock_job", "unlock_license", "reach_job_level"].includes(form.type))
      criteria.targetJob = form.targetJob;
    if (form.type === "fight_accuracy") criteria.accuracy = form.accuracy;
    if (form.type === "class_at_cap") criteria.percentage = form.percentage;
    if (form.type === "reach_job_level")
      criteria.targetLevel = form.targetLevel;
    if (["solo_fights", "total_correct_answers"].includes(form.type))
      criteria.targetAmount = form.targetAmount;
    const rewards = Object.fromEntries(
      [
        "gold",
        "guildXP",
        "unlockTier",
        "equipmentItemId",
        "unlockJob",
        "limitBreak",
      ]
        .filter(
          (k) =>
            !!(form as any)[k] &&
            ((!personal && !form.weekly) || k !== "limitBreak"),
        )
        .map((k) => [k, (form as any)[k]]),
    );
    const data = {
      title: form.title,
      description: form.description,
      questType: editing
        ? editing.questType
        : personal
          ? "personal"
          : form.weekly
            ? "weekly"
            : "guild",
      studentId: personal && form.audience !== "all" ? form.audience : null,
      assignToAll: form.audience === "all",
      criteria,
      rewards,
    };
    if (
      await mutate(
        editing ? "PATCH" : "POST",
        `/api/guilds/${guild.id}/quests${editing ? "/" + editing.id : ""}`,
        data,
      )
    ) {
      setForm(blank());
      setEditing(null);
    }
  };
  const edit = (q: Quest) => {
    setEditing(q);
    setForm({
      ...blank(),
      ...q.criteria,
      ...q.rewards,
      type: q.criteria.type as ObjectiveType,
      title: q.title,
      description: q.description,
      audience: q.studentId || "guild",
      weekly: q.questType === "weekly",
      unlockJob: q.rewards?.unlockJob || "",
      equipmentItemId: q.rewards?.equipmentItemId || "",
    });
  };
  const number = (
    key:
      | "gold"
      | "guildXP"
      | "targetLevel"
      | "targetAmount"
      | "accuracy"
      | "percentage",
    label: string,
    min: number,
    max: number,
  ) => (
    <label className="text-sm">
      {label}
      <input
        className={inputClass}
        type="number"
        min={min}
        max={max}
        value={form[key]}
        onChange={(e) => set(key, Number(e.target.value))}
      />
    </label>
  );
  const jobOptions = ALL_CHARACTER_CLASSES.map((j) => (
    <option key={j} value={j}>
      {JOB_TREE[j].name}
    </option>
  ));
  return (
    <div className="space-y-5">
      <p role="status" className="text-sm">
        {message}
      </p>
      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-semibold">Guild limits & progression</h2>
        <p className="text-sm text-muted-foreground">
          Earned levels and AA are retained. Changing the active limit affects
          new encounters; fights already running keep their entry settings.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <label>
            Current limit tier
            <select
              className={inputClass}
              aria-label="Current limit tier"
              value={limits}
              onChange={(e) => setLimits(+e.target.value)}
            >
              {LIMIT_CAPS.map((cap, i) => (
                <option key={cap} value={i + 1}>
                  Tier {i + 1} · level {cap}
                </option>
              ))}
            </select>
          </label>
          <label>
            Total guild XP
            <input
              className={inputClass}
              type="number"
              min="0"
              max="10000000"
              value={xp}
              onChange={(e) => setXp(+e.target.value)}
            />
          </label>
          <label>
            Unlocked shop tier
            <input
              className={inputClass}
              type="number"
              min="1"
              max="10"
              value={shop}
              onChange={(e) => setShop(+e.target.value)}
            />
          </label>
        </div>
        <Button
          disabled={busy || guild.isArchived}
          onClick={() =>
            mutate("PATCH", `/api/guilds/${guild.id}/progression`, {
              limitTier: limits,
              experience: xp,
              unlockedTier: shop,
            })
          }
        >
          Save guild progression
        </Button>
      </Card>
      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-semibold">
          {editing ? "Edit quest" : "Create a quest"}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label>
            Title
            <input
              className={inputClass}
              value={form.title}
              maxLength={200}
              onChange={(e) => set("title", e.target.value)}
            />
          </label>
          <label>
            Assigned to
            <select
              className={inputClass}
              value={form.audience}
              disabled={!!editing}
              onChange={(e) => set("audience", e.target.value)}
            >
              <option value="guild">
                Guild · shared objective and rewards
              </option>
              <option value="all">Every member · individual progress</option>
              {members.data?.map((m) => (
                <option key={m.studentId} value={m.studentId}>
                  {m.nickname}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          Description
          <textarea
            className={inputClass}
            value={form.description}
            maxLength={5000}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label>
            Objective
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
            >
              {!(form.type in QUEST_OBJECTIVES) && (
                <option value={form.type}>
                  Existing objective (unchanged)
                </option>
              )}
              {Object.entries(QUEST_OBJECTIVES)
                .filter(
                  ([k]) => form.audience === "guild" || k !== "class_at_cap",
                )
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
          </label>
          {[
            "fight_accuracy",
            "perfect_clear",
            "master_bank",
            "try_solo",
            "solo_fights",
          ].includes(form.type) && (
            <label>
              Quiz fight
              <select
                className={inputClass}
                value={form.fightId}
                onChange={(e) => set("fightId", e.target.value)}
              >
                <option value="">
                  {["solo_fights", "perfect_clear"].includes(form.type)
                    ? "Any assigned fight"
                    : "Choose a fight"}
                </option>
                {fights.data?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {["unlock_job", "unlock_license", "reach_job_level"].includes(
            form.type,
          ) && (
            <label>
              Job
              <select
                className={inputClass}
                value={form.targetJob}
                onChange={(e) => set("targetJob", e.target.value)}
              >
                {jobOptions}
              </select>
            </label>
          )}
          {form.type === "fight_accuracy" &&
            number("accuracy", "Minimum accuracy (%)", 1, 100)}
          {form.type === "class_at_cap" &&
            number(
              "percentage",
              "Class members at the current cap (%)",
              1,
              100,
            )}
          {form.type === "reach_job_level" &&
            number("targetLevel", "Required level", 1, 15)}
          {["solo_fights", "total_correct_answers"].includes(form.type) &&
            number(
              "targetAmount",
              form.type === "solo_fights"
                ? "Solo victories required"
                : "Correct answers required",
              1,
              1000000,
            )}
          {["fight_accuracy", "perfect_clear", "master_bank"].includes(
            form.type,
          ) && (
            <label>
              Fight mode
              <select
                className={inputClass}
                value={form.mode}
                onChange={(e) => set("mode", e.target.value)}
              >
                <option value="any">Solo or hosted</option>
                <option value="solo">Solo</option>
                <option value="teacher">Hosted</option>
              </select>
            </label>
          )}
          {form.audience === "guild" &&
            ["fight_accuracy", "perfect_clear"].includes(form.type) && (
              <label>
                Accuracy measure
                <select
                  className={inputClass}
                  value={form.performanceType}
                  onChange={(e) => set("performanceType", e.target.value)}
                >
                  <option value="individual">
                    Any member's victorious clear
                  </option>
                  <option value="class_average">
                    Class average in one victorious fight
                  </option>
                </select>
              </label>
            )}
        </div>
        {form.type === "master_bank" && (
          <p className="text-sm text-muted-foreground">
            Every question must be answered correctly at least once. Repeated
            attempts count. Edited questions must be mastered again.{" "}
            {form.audience === "guild"
              ? "Guild progress combines members’ correct answers."
              : "Progress is tracked separately for each student."}
          </p>
        )}
        {form.type === "try_solo" && (
          <p className="text-sm text-muted-foreground">
            One resolved question counts as an attempt; victory is not required.
          </p>
        )}
        {form.audience === "guild" && (
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={form.weekly}
              disabled={!!editing}
              onChange={(e) => set("weekly", e.target.checked)}
            />
            Repeat weekly
          </label>
        )}
        <fieldset className="border rounded-lg p-4">
          <legend className="px-2 font-semibold">Rewards</legend>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {number(
              "gold",
              form.audience === "guild"
                ? "Gold per member"
                : "Gold per student",
              0,
              100000,
            )}
            {number("guildXP", "Guild XP", 0, 100000)}
            <label>
              Job unlock
              <select
                className={inputClass}
                value={form.unlockJob}
                onChange={(e) => set("unlockJob", e.target.value)}
              >
                <option value="">None</option>
                {jobOptions}
              </select>
              <span className="text-xs text-muted-foreground">
                Permanently waives normal job prerequisites.
              </span>
            </label>
            {form.audience === "guild" && !form.weekly && (
              <label>
                Limit-break reward
                <select
                  className={inputClass}
                  value={form.limitBreak}
                  onChange={(e) => set("limitBreak", +e.target.value)}
                >
                  <option value={0}>None</option>
                  {LIMIT_CAPS.slice(1).map((cap, i) => (
                    <option key={cap} value={i + 2}>
                      Unlock tier {i + 2} · level {cap}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Shop-tier unlock
              <select
                className={inputClass}
                value={form.unlockTier}
                onChange={(e) => set("unlockTier", +e.target.value)}
              >
                <option value={0}>None</option>
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    Tier {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Equipment
              <select
                className={inputClass}
                value={form.equipmentItemId}
                onChange={(e) => set("equipmentItemId", e.target.value)}
              >
                <option value="">None</option>
                {[...Object.values(EQUIPMENT_ITEMS), ...(items.data || [])].map(
                  (item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        </fieldset>
        <div className="flex gap-2">
          <Button
            disabled={
              busy ||
              guild.isArchived ||
              !form.title.trim() ||
              !form.description.trim()
            }
            onClick={submit}
          >
            {editing ? "Save quest" : "Create quest"}
          </Button>
          {editing && (
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setForm(blank());
              }}
            >
              Cancel edit
            </Button>
          )}
        </div>
      </Card>
      <div className="flex justify-between">
        <h2 className="text-xl font-semibold">Guild quests</h2>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Include completed
        </label>
      </div>
      {quests.isLoading && <p>Loading quests…</p>}
      {quests.isError && (
        <p role="alert">
          Could not load quests.{" "}
          <Button onClick={() => quests.refetch()}>Retry</Button>
        </p>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        {quests.data
          ?.filter((q) => !q.isArchived && (showCompleted || !q.isCompleted))
          .map((q) => (
            <Card key={q.id} className="p-4 space-y-2">
              <h3 className="font-semibold">{q.title}</h3>
              <p className="text-xs text-muted-foreground">
                {q.studentId
                  ? members.data?.find((m) => m.studentId === q.studentId)
                      ?.nickname || "Personal quest"
                  : "Shared guild quest"}
                {q.questType === "weekly" ? " · weekly" : ""}
              </p>
              <p className="text-sm">{q.description}</p>
              <p className="text-sm">
                {q.isCompleted
                  ? "Completed · rewards granted"
                  : `${q.progress?.label}: ${Math.round(q.progress?.current || 0)} / ${q.progress?.target || 1}`}
              </p>
              <p className="text-xs">{rewardLabels(q.rewards).join(" · ")}</p>
              {!guild.isArchived && (
                <div className="flex flex-wrap gap-2">
                  {!q.isCompleted && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => edit(q)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Complete “${q.title}” and grant the displayed rewards?`,
                            )
                          )
                            mutate(
                              "PATCH",
                              `/api/guilds/${guild.id}/quests/${q.id}`,
                              { isCompleted: true },
                            );
                        }}
                      >
                        Complete & reward
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Archive this quest? Earned rewards will be kept.",
                        )
                      )
                        mutate(
                          "DELETE",
                          `/api/guilds/${guild.id}/quests/${q.id}`,
                        );
                    }}
                  >
                    Archive
                  </Button>
                </div>
              )}
            </Card>
          ))}
      </div>
    </div>
  );
}
