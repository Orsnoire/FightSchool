import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl,FormField,FormItem,FormLabel,FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ENCOUNTER_TIERS } from "@shared/encounter-tiers";
import { type InsertFight } from "@shared/schema";


import type { UseFormReturn } from "react-hook-form";

export function FightSettings({ form, encounterTier, changeTier }: {
  form: UseFormReturn<InsertFight>;
  encounterTier: number | null | undefined;
  changeTier: (tier: number) => void;
}) {
  return (
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

  );
}
