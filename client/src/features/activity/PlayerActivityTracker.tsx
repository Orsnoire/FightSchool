import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { ACTIVITY_SAMPLE_MS } from '@shared/contracts/player-activity';
import { ActivitySampler } from './sampler';

export function PlayerActivityTracker() {
  const [location] = useLocation();
  const studentId = localStorage.getItem('studentId');
  const enabled = location.startsWith('/student/') && location !== '/student/login' && !!studentId;
  useEffect(() => {
    if (!enabled || !studentId) return;
    const sampler = new ActivitySampler(performance.now(), document.visibilityState === 'visible');
    let stopped = false;
    let pending = false;
    const controller = new AbortController();
    const send = async (active: boolean) => {
      if (stopped || pending || localStorage.getItem('studentId') !== studentId) return;
      pending = true;
      try {
        const response = await fetch(`/api/student/${encodeURIComponent(studentId)}/activity`, {
          method: 'POST', credentials: 'include', signal: controller.signal,
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({active, pulseId: crypto.randomUUID()}),
        });
        if (response.status === 401 || response.status === 403) stopped = true;
      } catch { /* Activity collection must never interrupt gameplay; no offline replay. */ }
      finally { pending = false; }
    };
    const interact = () => sampler.interact(performance.now());
    const visibility = () => sampler.visibility(document.visibilityState === 'visible', performance.now());
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(event => window.addEventListener(event, interact, {passive: true}));
    document.addEventListener('visibilitychange', visibility);
    void send(false); // Establish availability without awarding time for opening a page.
    const timer = window.setInterval(() => {
      if (sampler.sample(performance.now())) void send(true);
    }, ACTIVITY_SAMPLE_MS);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
      events.forEach(event => window.removeEventListener(event, interact));
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled, studentId]);
  return null;
}
