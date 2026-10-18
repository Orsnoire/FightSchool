import { useCombatCountdown } from '@/hooks/useCombatCountdown';
export function CombatCountdown({deadline,clockOffset=0,variant='overlay'}:{deadline:number|null|undefined;clockOffset?:number;variant?:'overlay'|'host'|'waiting'}) {
  const seconds=useCombatCountdown(deadline,clockOffset);
  if(!deadline)return null;
  if(variant==='waiting')return <time aria-label={`${seconds} seconds remaining`}>{seconds}s</time>;
  const className=variant==='host'
    ? `rounded-lg px-3 py-1 text-xl font-bold tabular-nums ${seconds<=5?'bg-red-100 text-red-800':'bg-[#e5e9d8]'}`
    : 'shrink-0 rounded-full bg-muted px-3 py-1 font-bold tabular-nums';
  return <span aria-label={`${seconds} seconds remaining`} className={className}>{seconds}s</span>;
}
