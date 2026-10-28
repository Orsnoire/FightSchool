import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function useCampaignBeta(identity: string) {
  return useQuery({ queryKey: ['/api/campaigns/availability', identity], retry: false, staleTime: 0,
    queryFn: async () => {
      const response = await fetch('/api/campaigns/availability', { credentials: 'include' });
      if (!response.ok) return { enabled: false };
      return await response.json() as { enabled: boolean };
    } });
}

export function CampaignBetaLink({ teacher = false }: { teacher?: boolean }) {
  const identity = `${teacher ? 'teacher' : 'student'}:${localStorage.getItem(teacher ? 'teacherId' : 'studentId') || ''}`;
  const beta = useCampaignBeta(identity);
  return beta.data?.enabled ? <Link href={teacher ? '/teacher/campaigns' : '/student/campaigns'}><Button variant="outline">Campaigns · Beta</Button></Link> : null;
}

export function BetaNotice() {
  return <aside className="campaign-beta" aria-label="Campaign beta">
    <div><strong>Campaign Beta</strong><p>Help us test the adventure and tell us what needs fixing.</p></div>
    <Dialog>
      <DialogTrigger asChild><Button variant="outline">Report a bug</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Report a campaign bug</DialogTitle><DialogDescription>What happened, what did you expect, and how can we try it again?</DialogDescription></DialogHeader>
        <p className="text-sm">Reports open on GitHub and are public. Leave out student names, quiz answers, passwords, and screenshots containing personal information. Students can ask their teacher to submit a report.</p>
        <a className={buttonVariants()} href="https://github.com/Orsnoire/FightSchool/issues/new?template=campaign-beta-bug.yml" target="_blank" rel="noopener noreferrer">Open bug report on GitHub</a>
      </DialogContent>
    </Dialog>
  </aside>;
}
