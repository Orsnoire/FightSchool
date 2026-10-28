import type { TeacherRosterMember } from '@shared/contracts/guild-roster';
export function TeacherRosterStats({member}: {member: TeacherRosterMember}) {
  return <dl className="grid gap-3 sm:grid-cols-3 my-3 text-sm" data-testid={`roster-stats-${member.studentId}`}>
    <div><dt className="text-muted-foreground">Total AAs earned</dt><dd className="font-semibold tabular-nums">{member.totalAAsEarned.toLocaleString()}</dd></div>
    <div><dt className="text-muted-foreground">Active hours · last 7 days</dt>
      <dd className="font-semibold tabular-nums">{member.weeklyActiveHours == null ? 'Not recorded' : `${member.weeklyActiveHours.toFixed(2)} h`}</dd>
      {member.activityHistoryPartial && <dd className="text-xs text-muted-foreground">{member.activityTrackedSince == null ? 'Tracking starts on next visit' : `Partial history since ${new Date(member.activityTrackedSince).toLocaleDateString()}`}</dd>}
    </div>
    <div><dt className="text-muted-foreground">Accuracy · last 24 hours</dt>
      <dd className="font-semibold tabular-nums">{member.dailyAccuracy == null ? (member.dailyFights ? 'No recorded answers' : 'No fights') : `${member.dailyAccuracy.toFixed(1)}%`}</dd>
      {member.dailyAccuracy != null && <dd className="text-xs text-muted-foreground">{member.dailyCorrect}/{member.dailyAttempts} questions · {member.dailyFights} fight{member.dailyFights === 1 ? '' : 's'}</dd>}
      {member.dailyLegacyFights > 0 && <dd className="text-xs text-muted-foreground">Older results may omit unanswered questions</dd>}
    </div>
  </dl>;
}
