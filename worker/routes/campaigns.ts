import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { campaignAction, campaignCreate, campaignGateUpdate } from '../../shared/contracts/campaigns';
import { generateCampaignLayout, validateCampaignLayout } from '../../shared/campaign/generation';
import { applyCampaignAction, campaignShop } from '../campaign/actions';
import { campaignView, requireCampaign } from '../campaign/state';
import * as s from '../db/schema';
import { json } from '../http/game-response';
import { readJson } from '../http/json';
import { GameError } from '../services/errors';
import type { GameRouteContext } from './game-context';

export async function handleCampaigns(ctx: GameRouteContext): Promise<Response | null> {
  const { url, request, actor, teacher, db } = ctx;
  if (!url.pathname.startsWith('/api/campaigns')) return null;
  if (url.pathname === '/api/campaigns/options' && request.method === 'GET') {
    ctx.requireTeacher();
    const guilds = await db.select({ id: s.guilds.id, name: s.guilds.name }).from(s.guilds).where(and(eq(s.guilds.teacherId, actor.actorId), eq(s.guilds.isArchived, false)));
    const quizzes = await ctx.repository.listTeacherFightSummaries(actor.actorId);
    const assignments = await db.select({ guildId: s.guildFights.guildId, fightId: s.guildFights.fightId }).from(s.guildFights).innerJoin(s.guilds, eq(s.guildFights.guildId, s.guilds.id)).where(and(eq(s.guilds.teacherId, actor.actorId), eq(s.guilds.isArchived, false)));
    return json({ guilds, quizzes, assignments });
  }
  if (url.pathname === '/api/campaigns') {
    if (request.method === 'GET') {
      const rows = teacher
        ? await db.select({ campaign: s.campaigns, guildName: s.guilds.name }).from(s.campaigns).innerJoin(s.guilds, eq(s.guilds.id, s.campaigns.guildId)).where(and(eq(s.campaigns.teacherId, actor.actorId), eq(s.guilds.isArchived, false)))
        : await db.select({ campaign: s.campaigns, guildName: s.guilds.name }).from(s.campaigns).innerJoin(s.guilds, eq(s.guilds.id, s.campaigns.guildId)).innerJoin(s.guildMemberships, eq(s.guildMemberships.guildId, s.guilds.id)).where(and(eq(s.guildMemberships.studentId, actor.actorId), eq(s.guilds.isArchived, false)));
      return json(rows.map(({ campaign: c, guildName }) => ({ id: c.id, name: c.name, guildId: c.guildId, guildName, dungeonName: c.dungeonName, theme: c.theme, gates: c.gates, revision: c.revision })));
    }
    if (request.method === 'POST') {
      ctx.requireTeacher();
      const input = campaignCreate.parse(await readJson(request));
      const guild = await ctx.guild(input.guildId, true);
      if (guild.isArchived) throw new GameError('Guild is archived.');
      const fight = await ctx.repository.findFightById(input.fightId);
      if (!fight || fight.teacherId !== actor.actorId || !fight.questions.length) throw new GameError('Choose an owned quiz with questions.');
      const id = crypto.randomUUID();
      const gates = input.gates.map(g => ({ ...g, id: crypto.randomUUID() }));
      const layout = generateCampaignLayout(id, gates);
      validateCampaignLayout(layout);
      await db.insert(s.campaigns).values({ id, teacherId: actor.actorId, guildId: guild.id, fightId: fight.id, name: input.name, dungeonName: input.dungeonName,
        gates, layout, fightSnapshot: fight });
      return json({ id }, 201);
    }
  }
  const match = url.pathname.match(/^\/api\/campaigns\/([^/]+)(?:\/(actions|gates|shop))?$/);
  if (!match) return null;
  const campaign = await requireCampaign(db, z.string().uuid().parse(match[1]), actor);
  if (match[2] === 'gates' && request.method === 'PUT') {
    ctx.requireTeacher();
    const input = campaignGateUpdate.parse(await readJson(request));
    if (input.gates.length !== campaign.gates.length || new Set(input.gates.map(g => g.id)).size !== input.gates.length || input.gates.some(g => !campaign.gates.some(old => old.id === g.id))) throw new GameError('Unknown campaign gate.');
    const gates = campaign.gates.map(g => ({ ...g, open: input.gates.find(v => v.id === g.id)!.open }));
    const result = await db.update(s.campaigns).set({ gates, revision: sql`${s.campaigns.revision}+1` }).where(and(eq(s.campaigns.id, campaign.id), eq(s.campaigns.revision, input.revision))).returning({ id: s.campaigns.id });
    if (!result.length) throw new GameError('Campaign changed. Refresh and try again.', 409);
    return json({ ok: true });
  }
  if (teacher) throw new GameError('Enter the adventure as a student.', 403);
  const [student] = await db.select().from(s.students).where(eq(s.students.id, actor.actorId));
  if (!student?.characterClass) throw new GameError('Choose a character first.');
  if (match[2] === 'shop' && request.method === 'GET') return json(await campaignShop(db, campaign));
  if (match[2] === 'actions' && request.method === 'POST') return json(await applyCampaignAction(db, campaign, student, campaignAction.parse(await readJson(request))));
  if (!match[2] && request.method === 'GET') return json(await campaignView(db, campaign, student));
  return json({ error: 'Method not allowed' }, 405);
}
