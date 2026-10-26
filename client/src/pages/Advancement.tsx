import { abilityHealing } from '@shared/combat/abilityValues';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStudentLoadout } from '@/hooks/useStudentLoadout';
import { useToast } from '@/hooks/use-toast';
import { useLobbyEquipment } from '@/features/lobby/useLobbyEquipment';
import { createLobbyPreview } from '@/features/lobby/preview';
import { RecustomizationDialog } from '@/features/advancement/RecustomizationDialog';
import { apiRequest } from '@/lib/queryClient';
import { refreshStudentLoadout } from '@/lib/studentLoadout';
import { aaRankTier, aaRelevant, effectiveAARank, ownedAARank, type AAUpgrade } from '@shared/aa';
import type { AACustomizationInput, AAPurchaseInput, AAPurchaseReceipt, AASummary } from '@shared/contracts/advancement';
import { calculatePlayerBaseDamage, type Guild } from '@shared/schema';
import { EQUIPMENT_ITEMS } from '@shared/schema';

const categories = ['All categories', 'Primary stats', 'Combat', 'Weapons', 'Armor proficiencies', 'Utility'];
const stats = ['str', 'int', 'agi', 'mnd', 'vit', 'atk', 'mat', 'rtk', 'def', 'maxHp', 'maxMp', 'maxComboPoints'] as const;
const statLabels: Record<string, string> = { maxHp: 'Max HP', maxMp: 'Max MP', maxComboPoints: 'Max CP' };

export default function Advancement() {
  const studentId = localStorage.getItem('studentId');
  const client = useQueryClient(), { toast } = useToast();
  const { student, jobLevels, isLoading, isError } = useStudentLoadout(studentId);
  const { equippedItems, equipmentFetching, equipmentError } = useLobbyEquipment(student);
  const key = `/api/student/${studentId}/advancement`;
  const summary = useQuery<AASummary>({ queryKey: [key], enabled: !!studentId, staleTime: 0 });
  const { data: guilds = [] } = useQuery<Guild[]>({ queryKey: [`/api/student/${studentId}/guilds`], enabled: !!studentId });
  const [context, setContext] = useState('current'), [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories'), [status, setStatus] = useState('all');
  const [affordable, setAffordable] = useState(false), [relevant, setRelevant] = useState(false);
  const [details, setDetails] = useState<string | null>(null);
  const [customize, setCustomize] = useState(() => new URLSearchParams(window.location.search).get('customize') === '1');
  const requestIds = useRef(new Map<string, string>());
  const refresh = async () => {
    await client.cancelQueries({ queryKey: [key], exact: true });
    await Promise.all([client.invalidateQueries({ queryKey: [key], exact: true }),
      client.invalidateQueries({ queryKey: [`/api/student/${studentId}/avatar`] }), refreshStudentLoadout(client, studentId!)]);
  };
  const purchase = useMutation({
    mutationFn: async (input: AAPurchaseInput) => (await apiRequest('POST', `${key}/purchase`, input)).json() as Promise<AAPurchaseReceipt>,
    onSuccess: async receipt => { await refresh(); toast({ title: 'Advancement purchased', description: `Rank ${receipt.rank} saved · ${receipt.cost} AA spent. New effects apply in your next encounter.` }); },
    onError: async error => { await refresh(); toast({ title: 'Purchase could not be completed', description: error.message, variant: 'destructive' }); },
  });
  if (!studentId) return <main className="p-6"><Link href="/student/login">Sign in to view advancement</Link></main>;
  if (isLoading || summary.isLoading) return <main className="p-6" role="status">Loading advancement…</main>;
  if (isError || summary.isError || !student || !summary.data) return <main className="p-6 space-y-3"><p role="alert">Advancement could not load.</p><Button onClick={() => { void refresh(); }}>Try again</Button><p><Link href="/student/lobby">Back to lobby</Link></p></main>;
  const data = summary.data;
  const guild = guilds.find(g => g.id === student.guildId) || guilds[0];
  const previewGuild = context.startsWith('guild:') ? guilds.find(g => g.id === context.slice(6)) : guild;
  const tier = context.startsWith('tier:') ? Number(context.slice(5)) : previewGuild?.limitTier || 1;
  const weapon = equippedItems.find(item => item.id === student.weapon) || EQUIPMENT_ITEMS[student.weapon || ''];
  const ready = student.characterClass && student.gender ? { ...student, characterClass: student.characterClass, gender: student.gender, aaRanks: data.ranks } : null;
  const currentPreview = ready && !equipmentFetching && !equipmentError ? createLobbyPreview(ready, jobLevels, equippedItems, tier) : null;
  const selected = data.catalog.find(upgrade => upgrade.id === details);
  const rankOf = (upgrade: AAUpgrade) => ownedAARank(data.ranks, upgrade);
  const costOf = (upgrade: AAUpgrade) => upgrade.costs[rankOf(upgrade)];
  const buy = (upgrade: AAUpgrade) => {
    const rank = rankOf(upgrade) + 1;
    const requestKey = `${upgrade.id}:${rank}:${data.catalogVersion}`;
    if (!requestIds.current.has(requestKey)) requestIds.current.set(requestKey, crypto.randomUUID());
    purchase.mutate({ upgradeId: upgrade.id, rank, requestId: requestIds.current.get(requestKey)!, catalogVersion: data.catalogVersion as 1 });
  };
  const shown = data.catalog.filter(upgrade => {
    const owned = rankOf(upgrade), active = effectiveAARank(data.ranks, upgrade, tier), maxed = owned === upgrade.costs.length;
    return (category === 'All categories' || upgrade.category === category) &&
      `${upgrade.name} ${upgrade.description}`.toLowerCase().includes(search.toLowerCase()) &&
      (!affordable || (!maxed && costOf(upgrade) <= data.wallet.available)) &&
      (!relevant || aaRelevant(upgrade, student.characterClass || 'warrior', weapon?.weaponType)) &&
      (status === 'all' || status === 'owned' && owned > 0 || status === 'unowned' && owned === 0 || status === 'maxed' && maxed ||
        status === 'active' && active > 0 || status === 'restricted' && owned > active);
  });
  const saveCustomization = async (input: AACustomizationInput, initial: boolean) => {
    if (initial) await apiRequest('POST', `/api/student/${studentId}/avatar`, input.appearance);
    else { try { await apiRequest('POST', `${key}/customize`, input); } catch (error) { await refresh(); throw error; } }
    await refresh(); toast({ title: initial ? 'Initial appearance saved' : 'Character recustomized' });
  };
  const nextPreview = ready && selected && rankOf(selected) < selected.costs.length && currentPreview
    ? createLobbyPreview({ ...ready, aaRanks: { ...data.ranks, [selected.id]: rankOf(selected) + 1 } }, jobLevels, equippedItems, tier) : null;
  return <main className="min-h-screen bg-background p-4 sm:p-6">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><Link href="/student/lobby" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"><ArrowLeft size={15} />Back to lobby</Link>
          <h1 className="mt-3 text-3xl font-serif font-bold">Alternate Advancement</h1>
          <p className="mt-2 text-sm text-muted-foreground">Keep growing when your class reaches the encounter's level cap.</p></div>
        <Link href="/student/equipment"><Button variant="outline">Equipment & cross-class slots</Button></Link>
      </header>
      <section aria-label="AA points" className="rounded-xl border bg-card p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {[['Available AA', data.wallet.available], ['Total earned AA', data.wallet.total], ['Spent AA', data.wallet.spent]].map(([label, value]) =>
            <div key={label}><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-1 text-3xl font-bold ${label === 'Available AA' ? 'text-primary' : ''}`}>{value}</p></div>)}
          <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Next AA point</p><p className="mt-1 text-lg font-semibold">{data.wallet.xpTowardNext} / {data.wallet.xpPerPoint} XP</p>
            <progress aria-label="EXP toward next AA point" value={data.wallet.xpTowardNext} max={data.wallet.xpPerPoint} className="mt-2 h-2 w-full accent-primary" /></div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Every {data.wallet.xpPerPoint} eligible EXP above your encounter's class cap earns 1 AA. Points and purchased ranks stay with your character across classes. Higher ranks become inactive in lower-tier fights.</p>
      </section>
      <section className="rounded-lg border bg-card p-4 space-y-4" aria-label="Advancement filters">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-sm">Power preview<select aria-label="Power preview" value={context} onChange={e => setContext(e.target.value)} className="mt-1 w-full rounded border bg-background p-2">
            <option value="current">{guild ? `${guild.name} · Tier ${guild.limitTier}` : 'No guild · Tier 1'}</option>
            {guilds.filter(g => g.id !== guild?.id).map(g => <option key={g.id} value={`guild:${g.id}`}>{g.name} · Tier {g.limitTier}</option>)}
            {[1, 2, 3, 4].map(value => <option key={value} value={`tier:${value}`}>Preview Tier {value}</option>)}
          </select></label>
          <label className="text-sm">Category<select aria-label="AA category" value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full rounded border bg-background p-2">{categories.map(name => <option key={name}>{name}</option>)}</select></label>
          <label className="text-sm">Show<select aria-label="AA status" value={status} onChange={e => setStatus(e.target.value)} className="mt-1 w-full rounded border bg-background p-2">
            {Object.entries({ all: 'All upgrades', owned: 'Owned', unowned: 'Unpurchased', maxed: 'Maxed', active: 'Active here', restricted: 'Restricted by tier' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label className="text-sm">Search<input aria-label="Search advancements" placeholder="Name, weapon, or effect" value={search} onChange={e => setSearch(e.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex gap-2 items-center"><input type="checkbox" checked={affordable} onChange={e => setAffordable(e.target.checked)} />Affordable</label>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={relevant} onChange={e => setRelevant(e.target.checked)} />Relevant to current build</label>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setCategory('All categories'); setStatus('all'); setAffordable(false); setRelevant(false); }}>Clear filters</Button>
          <span className="text-muted-foreground" aria-live="polite">{shown.length} upgrades</span>
        </div>
        <p className="text-xs text-muted-foreground">Tier {tier} preview only. Each fight uses its hosting guild or campaign power limit. Purchases apply to later encounters; they never refill an active fight's resources.</p>
      </section>
      {!shown.length && <p className="rounded-lg border p-6 text-center text-muted-foreground">No upgrades match these filters. Clear filters to see all ranks.</p>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.map(upgrade => {
          const owned = rankOf(upgrade), active = effectiveAARank(data.ranks, upgrade, tier), maxed = owned === upgrade.costs.length, cost = costOf(upgrade);
          const cosmetic = upgrade.kind === 'cosmetic';
          return <Card key={upgrade.id} data-testid={`aa-${upgrade.id}`} className="flex flex-col">
            <CardHeader className="pb-3"><p className="text-xs text-muted-foreground">{upgrade.category}</p><CardTitle className="text-lg">{upgrade.name}</CardTitle></CardHeader>
            <CardContent className="flex flex-col flex-1 gap-3">
              <p className="text-sm text-muted-foreground">{upgrade.description}</p>
              {!cosmetic && <><p className="text-sm"><strong>Owned {owned}/{upgrade.costs.length}</strong> · Active {active}/{upgrade.costs.length} at Tier {tier}</p>
                <div className="flex flex-wrap gap-1" aria-label={`${upgrade.name} ranks`}>{upgrade.costs.map((_, index) => <span key={index} title={`Rank ${index + 1} · Tier ${aaRankTier(index + 1)} · ${index < active ? 'active' : index < owned ? 'owned, inactive' : 'unpurchased'}`}
                  className={`flex h-6 w-6 items-center justify-center rounded border text-xs ${index < active ? 'bg-primary text-primary-foreground' : index < owned ? 'bg-muted font-bold border-dashed' : ''}`}>{index + 1}</span>)}</div>
                {owned > active && <p className="text-xs font-medium">{owned - active} purchased {owned - active === 1 ? 'rank is' : 'ranks are'} inactive here.</p>}
                {!maxed && <p className="text-xs">Next: +{upgrade.values[owned]} {upgrade.unit} total · Tier {aaRankTier(owned + 1)}{aaRankTier(owned + 1) > tier ? ' · Inactive in this preview' : ''}</p>}
              </>}
              <div className="mt-auto space-y-2 pt-2">
                {cosmetic ? <Button variant="outline" className="w-full" onClick={() => setCustomize(true)}>Preview changes · {upgrade.costs[0]} AA</Button>
                  : <Button className="w-full" disabled={maxed || cost > data.wallet.available || purchase.isPending || data.catalogVersion !== 1} onClick={() => buy(upgrade)}>
                    {purchase.isPending && purchase.variables?.upgradeId === upgrade.id ? 'Purchasing…' : maxed ? 'All ranks owned' : `Buy rank ${owned + 1} — ${cost} AA`}</Button>}
                {!maxed && !cosmetic && <p className="text-xs text-muted-foreground">{cost <= data.wallet.available ? `${data.wallet.available - cost} AA available after purchase.` : `Need ${cost - data.wallet.available} more AA.`}</p>}
                {!cosmetic && <button className="text-sm underline underline-offset-2" onClick={() => setDetails(upgrade.id)}>All ranks & effects</button>}
              </div>
            </CardContent>
          </Card>;
        })}
      </div>
      <p className="text-xs text-muted-foreground">Light armor is already available on every class. Proficiencies do not grant items or bypass level and hand-compatibility rules. AA does not replace bonuses earned by leveling other classes.</p>
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setDetails(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto">
        {selected && <><DialogHeader><DialogTitle>{selected.name}</DialogTitle><DialogDescription>{selected.description}</DialogDescription></DialogHeader>
          <table className="w-full text-sm"><caption className="text-left pb-2">Each price buys that rank; ranks must be purchased in order.</caption><thead><tr><th className="text-left">Rank</th><th>Cost</th><th>Effect total</th><th>Tier</th><th>State</th></tr></thead>
            <tbody>{selected.costs.map((cost, index) => <tr key={index} className="border-t"><td className="py-2">{index + 1}</td><td className="text-center">{cost} AA</td><td className="text-center">{selected.values[index]} {selected.unit}</td><td className="text-center">{aaRankTier(index + 1)}</td><td className="text-center">{index < effectiveAARank(data.ranks, selected, tier) ? 'Active' : index < rankOf(selected) ? 'Owned · inactive' : 'Unpurchased'}</td></tr>)}</tbody></table>
          {equipmentError ? <p role="alert">Equipment could not load; stat preview is unavailable.</p> : equipmentFetching ? <p>Loading equipped stats…</p> : currentPreview && nextPreview && <div className="rounded border p-3 text-sm space-y-1">
            <p className="font-semibold">Next rank · {student.characterClass?.replaceAll('_', ' ')} · Tier {tier}</p>
            {stats.filter(stat => currentPreview.previewStats[stat] !== nextPreview.previewStats[stat]).map(stat => <p key={stat}>{statLabels[stat] || stat.toUpperCase()}: {currentPreview.previewStats[stat]} → {nextPreview.previewStats[stat]}</p>)}
            <p>{student.characterClass === 'priest' ? 'First Aid healing' : 'Basic damage'}: {(student.characterClass === 'priest' ? abilityHealing(currentPreview.previewPlayer, 'first_aid') : calculatePlayerBaseDamage(currentPreview.previewStats, ready!.characterClass))} → {(student.characterClass === 'priest' ? abilityHealing(nextPreview.previewPlayer, 'first_aid') : calculatePlayerBaseDamage(nextPreview.previewStats, ready!.characterClass))}</p>
            <p className="text-xs text-muted-foreground">Only effects usable in this context appear here. A proficiency may require equipping different gear; slots and preservation have no direct stat increase.</p>
          </div>}
        </>}
      </DialogContent></Dialog>
      {customize && <RecustomizationDialog open={customize} onOpenChange={setCustomize} student={student} summary={data} onSave={saveCustomization} />}
    </div>
  </main>;
}
