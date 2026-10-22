import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import type { ActiveGuildSession } from '@shared/contracts/guilds';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function GuildSessionList({ guildId }: { guildId: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [joining, setJoining] = useState<string | null>(null);
  const sessions = useQuery<ActiveGuildSession[]>({
    queryKey: [`/api/guilds/${guildId}/active-sessions`], enabled: !!guildId, refetchInterval: 5000,
  });
  const join = async (sessionId: string) => {
    setJoining(sessionId);
    try {
      await apiRequest('GET', `/api/sessions/${sessionId}`);
      localStorage.setItem('sessionId', sessionId);
      navigate('/student/combat');
    } catch (error) {
      toast({ title: 'Unable to join battle', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
      void sessions.refetch();
    } finally { setJoining(null); }
  };
  return <Card id="current-battles" className="mb-4" data-testid="current-battles">
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Current battles</CardTitle>
        <Button variant="outline" size="sm" onClick={() => void sessions.refetch()} disabled={sessions.isFetching}>Refresh battles</Button>
      </div>
      <CardDescription>Join a guildmate’s solo battle or a teacher-hosted session. This list updates automatically.</CardDescription>
    </CardHeader>
    <CardContent>
      {sessions.isPending ? <p role="status">Loading battles…</p> : sessions.isError ?
        <p role="alert">Could not load current battles. <Button variant="outline" onClick={() => void sessions.refetch()}>Retry battles</Button></p> :
        sessions.data?.length ? <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sessions.data.map(session => <li key={session.sessionId} className="rounded-lg border p-4 space-y-3" data-testid={`session-card-${session.sessionId}`}>
            <div><h3 className="font-semibold break-words">{session.title}</h3>
              <p className="text-sm text-muted-foreground">{session.soloMode ? `Started by ${session.isHost ? 'you' : session.hostNickname || 'a guildmate'}` : 'Teacher hosted'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{session.status === 'waiting' ? 'Waiting' : 'In progress'}</Badge><span className="font-mono text-sm">{session.sessionId}</span></div>
            <Button className="w-full" disabled={!!joining} onClick={() => void join(session.sessionId)} data-testid={`button-join-${session.sessionId}`}>
              {joining === session.sessionId ? 'Joining…' : session.isHost ? 'Rejoin battle' : 'Join battle'}
            </Button>
          </li>)}
        </ul> : <p>No current battles. <Link className="underline" href={`/student/guilds/${guildId}/fights`}>Start a solo battle from the Fight Library</Link>.</p>}
    </CardContent>
  </Card>;
}
