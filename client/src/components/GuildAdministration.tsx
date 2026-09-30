import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import type { Quest, Guild } from "@shared/schema";
export function GuildAdministration({ guild }: { guild: Guild }) {
  const { data: quests = [] } = useQuery<Quest[]>({
    queryKey: [`/api/guilds/${guild.id}/quests`],
  });
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [gold, setGold] = useState(0),
    [xp, setXp] = useState(guild.experience),
    [tier, setTier] = useState(guild.unlockedTier),
    [message, setMessage] = useState("");
  const mutate = async (method: string, path: string, body: unknown) => {
    try {
      await apiRequest(method, path, body);
      setMessage("Saved");
      await queryClient.invalidateQueries({
        queryKey: [`/api/guilds/${guild.id}`],
      });
      await queryClient.invalidateQueries({
        queryKey: [`/api/guilds/${guild.id}/quests`],
      });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save");
    }
  };
  return (
    <div className="space-y-5">
      <p role="status">{message}</p>
      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-semibold">Guild progression</h2>
        <div className="flex flex-wrap gap-4">
          <label>
            Total guild XP
            <input
              aria-label="Total guild XP"
              className="block border rounded bg-background p-2"
              type="number"
              min={0}
              value={xp}
              onChange={(e) => setXp(+e.target.value)}
            />
          </label>
          <label>
            Highest shop tier
            <input
              aria-label="Highest shop tier"
              className="block border rounded bg-background p-2"
              type="number"
              min={1}
              max={10}
              value={tier}
              onChange={(e) => setTier(+e.target.value)}
            />
          </label>
        </div>
        <Button
          onClick={() =>
            mutate("PATCH", `/api/guilds/${guild.id}/progression`, {
              experience: xp,
              unlockedTier: tier,
            })
          }
        >
          Save progression
        </Button>
      </Card>
      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-semibold">Create a teacher quest</h2>
        <p>
          Complete this quest manually when the class meets your learning
          objective.
        </p>
        <label className="block">
          Title
          <input
            className="block border rounded bg-background p-2 w-full"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block">
          Objective
          <textarea
            className="block border rounded bg-background p-2 w-full"
            value={description}
            maxLength={5000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block">
          Gold reward per member
          <input
            className="block border rounded bg-background p-2"
            type="number"
            min={0}
            max={100000}
            value={gold}
            onChange={(e) => setGold(+e.target.value)}
          />
        </label>
        <Button
          disabled={!title.trim() || !description.trim()}
          onClick={() =>
            mutate("POST", `/api/guilds/${guild.id}/quests`, {
              title,
              description,
              questType: "teacher_custom",
              criteria: { type: "custom", customDescription: description },
              rewards: { gold },
            })
          }
        >
          Create quest
        </Button>
      </Card>
      <div className="grid gap-3">
        {quests
          .filter((q) => !q.studentId)
          .map((q) => (
            <Card key={q.id} className="p-4">
              <h3 className="font-semibold">{q.title}</h3>
              <p className="text-sm my-2">{q.description}</p>
              <p>{q.isCompleted ? "Completed" : "In progress"}</p>
              {!q.isCompleted && (
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() =>
                    mutate("PATCH", `/api/guilds/${guild.id}/quests/${q.id}`, {
                      isCompleted: true,
                    })
                  }
                >
                  Mark complete and grant rewards
                </Button>
              )}
            </Card>
          ))}
      </div>
    </div>
  );
}
