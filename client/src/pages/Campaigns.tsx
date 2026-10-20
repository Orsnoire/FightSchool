import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import type { CampaignSummary } from '@shared/campaign/model';
import './campaign.css';

export async function campaignRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load the campaign.');
  return data;
}
type Options = { guilds: { id: string; name: string }[]; quizzes: { id: string; title: string; questionCount: number }[]; assignments: { guildId: string; fightId: string }[] };

export default function Campaigns() {
  const [location] = useLocation();
  return location.startsWith('/teacher') ? <TeacherCampaigns /> : <CampaignList teacher={false} />;
}
function TeacherCampaigns() {
  const { isAuthenticated, isChecking } = useTeacherAuth();
  return isChecking ? <p className="p-6">Checking your session…</p> : isAuthenticated ? <CampaignList teacher /> : null;
}
function CampaignList({ teacher }: { teacher: boolean }) {
  const client = useQueryClient();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [name, setName] = useState('Hearthlight Expedition'), [dungeonName, setDungeonName] = useState('Echo Cave');
  const [guildId, setGuildId] = useState(''), [fightId, setFightId] = useState('');
  const [search, setSearch] = useState(''), [guildFilter, setGuildFilter] = useState(''), [keys, setKeys] = useState('Cave Key');
  const query = useQuery({ queryKey: ['/api/campaigns', teacher], queryFn: () => campaignRequest<CampaignSummary[]>('/api/campaigns'), staleTime: 0 });
  const options = useQuery({ queryKey: ['/api/campaigns/options'], queryFn: () => campaignRequest<Options>('/api/campaigns/options'), enabled: teacher });
  const quizzes = options.data?.quizzes.filter(q => q.title.toLowerCase().includes(search.toLowerCase()) && (!guildFilter || options.data.assignments.some(a => a.guildId === guildFilter && a.fightId === q.id))) || [];
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await campaignRequest('/api/campaigns', 'POST', { name, dungeonName, guildId, fightId, gates: keys.split('\n').map(k => k.trim()).filter(Boolean).map(name => ({ name, open: false })) });
      await client.invalidateQueries({ queryKey: ['/api/campaigns'] });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function toggle(campaign: CampaignSummary, gateId: string) {
    setBusy(true); setError('');
    try {
      await campaignRequest(`/api/campaigns/${campaign.id}/gates`, 'PUT', { revision: campaign.revision, gates: campaign.gates.map(g => ({ id: g.id, open: g.id === gateId ? !g.open : g.open })) });
      await query.refetch();
    } catch (e) { setError((e as Error).message); await query.refetch(); } finally { setBusy(false); }
  }
  return <main className="campaign-shell">
    <Link href={teacher ? '/teacher' : '/student/lobby'} className="campaign-back">← Back to {teacher ? 'dashboard' : 'lobby'}</Link>
    <header className="campaign-heading"><span className="campaign-eyebrow">Adventures · solo pilot</span><h1>Campaigns</h1><p>A town to return to. A cave to explore. Every encounter leaves its mark.</p></header>
    {(error || query.error || options.error) && <p role="alert" className="campaign-error">{error || (query.error || options.error)?.message}</p>}
    {teacher && <form className="campaign-panel campaign-create" onSubmit={create}>
      <h2>Create a test campaign</h2><p>One saved overworld, one normal cave, and a snapshot of your selected quiz. Tier 1 encounters; job levels capped at 4. No students or questions are created automatically.</p>
      <div className="campaign-form-grid">
        <label>Campaign name<input aria-label="Campaign name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Dungeon name<input aria-label="Dungeon name" required maxLength={100} value={dungeonName} onChange={e => setDungeonName(e.target.value)} /></label>
        <label>Campaign guild<select aria-label="Campaign guild" required value={guildId} onChange={e => setGuildId(e.target.value)}><option value="">Choose a guild</option>{options.data?.guilds.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
        <label>Filter quizzes by guild<select aria-label="Filter quizzes by guild" value={guildFilter} onChange={e => { setGuildFilter(e.target.value); setFightId(''); }}><option value="">All owned quizzes</option>{options.data?.guilds.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
        <label>Search quiz names<input aria-label="Search quiz names" value={search} onChange={e => { setSearch(e.target.value); setFightId(''); }} placeholder="Search your authored quizzes" /></label>
        <label>Dungeon quiz<select aria-label="Dungeon quiz" required value={fightId} onChange={e => setFightId(e.target.value)}><option value="">Choose a quiz</option>{quizzes.filter(q => q.questionCount > 0).map(q => <option key={q.id} value={q.id}>{q.title} · {q.questionCount} questions</option>)}</select></label>
      </div>
      <label>Required keys — one per line, up to three<textarea aria-label="Required keys" value={keys} onChange={e => setKeys(e.target.value)} rows={3} placeholder="Leave blank for an open dungeon" /></label>
      <p className="campaign-note">Each key has a quest giver. Open its gate below when the class is ready; students then collect the key in town. Clearing a dungeon is not required to include its unlocked questions in overworld encounters.</p>
      <Button disabled={busy || !options.data?.guilds.length}>{busy ? 'Saving…' : 'Generate campaign'}</Button>
    </form>}
    <section className="campaign-cards" aria-label="Available campaigns">
      {query.isLoading && <p>Loading campaigns…</p>}
      {query.data?.length === 0 && <p>{teacher ? 'Create your first campaign above.' : 'Your teacher has not created a campaign for your guilds yet.'}</p>}
      {query.data?.map(c => <article className="campaign-panel" key={c.id}>
        <span className="campaign-eyebrow">{c.guildName}</span><h2>{c.name}</h2><p>{c.dungeonName} · Normal cave</p>
        {c.gates.length ? <ul className="campaign-gate-list">{c.gates.map(g => <li key={g.id}><span>{g.name} · {g.open ? 'Available' : 'Teacher locked'}</span>{teacher && <Button variant="outline" disabled={busy} onClick={() => toggle(c, g.id)}>{g.open ? 'Close gate' : 'Open gate'}</Button>}</li>)}</ul> : <p>No keys required.</p>}
        {!teacher && <Link href={`/student/campaign/${c.id}`}><Button>Enter adventure</Button></Link>}
      </article>)}
    </section>
  </main>;
}
