import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { campaignRequest } from '@/pages/Campaigns';
import type { CampaignView } from '@shared/campaign/model';

export function QuestionBankEntry({ view, busy, choose, resume }: {
  view: CampaignView; busy: boolean; choose: (fightId: string) => void; resume: () => void;
}) {
  const [fightId, setFightId] = useState('');
  const query = useQuery({ queryKey: ['/api/campaigns', view.id, 'question-banks'],
    queryFn: () => campaignRequest<Array<{ fightId: string; title: string; questionCount: number }>>(`/api/campaigns/${view.id}/question-banks`) });
  const active = !!view.progress.activeSessionId;
  return <section className="campaign-panel campaign-entry" aria-label="Choose your campaign question bank">
    <h2>Choose a fight to enter the beta</h2>
    <p>Pick a fight assigned to {view.guildName}. Its questions will supply your campaign encounters.</p>
    {view.progress.questionBankFightId && <p>Your previous choice is no longer available. Choose another assigned fight to continue from your saved position.</p>}
    {active && <p>Finish your current encounter before choosing. Your saved adventure will be waiting.</p>}
    {query.isLoading ? <p role="status">Loading assigned fights…</p> : query.error ? <><p role="alert">{query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Retry assigned fights</Button></> : query.data?.length ?
      <form onSubmit={event => { event.preventDefault(); if (fightId && !busy && !active) choose(fightId); }}>
        <label htmlFor="campaign-question-bank">Assigned fight</label>
        <select id="campaign-question-bank" value={fightId} required disabled={busy || active} onChange={event => setFightId(event.target.value)}>
          <option value="" disabled>Choose an assigned fight</option>
          {query.data.map(fight => <option key={fight.fightId} value={fight.fightId}>{fight.title} · {fight.questionCount} questions</option>)}
        </select>
        <Button type="submit" disabled={!fightId || busy || active}>{busy ? 'Saving choice…' : 'Enter campaign beta'}</Button>
      </form> : <p>No assigned fights with questions are available. Ask your teacher to assign a fight to this guild.</p>}
    {active && <Button onClick={resume}>Resume encounter</Button>}
    <p className="campaign-note">Your choice is saved for this adventure. Choosing a question bank keeps your map, equipment, resources and progress.</p>
  </section>;
}
