import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { campaignAction, campaignCreate, campaignGateUpdate } from '../../shared/contracts/campaigns';
import { generateCampaignLayout, validateCampaignLayout } from '../../shared/campaign/generation';
import { applyCampaignAction, campaignShop } from '../campaign/actions';
import { campaignQuestionBanks } from '../campaign/question-banks';
import { campaignView, requireCampaign } from '../campaign/state';
import * as s from '../db/schema';
import { json } from '../http/game-response';
import { readJson } from '../http/json';
import { GameError } from '../services/errors';
import type { GameRouteContext } from './game-context';

export async function handleCampaigns(ctx: GameRouteContext): Promise<Response | null> {
  const { url, request, actor, teacher, db } = ctx;
  if (!url.pathname.startsWith('/api/campaigns')) return null;
  // Compute eligibility from server-owned guild identity and current membership.
  // This also protects direct API calls and students belonging to multiple guilds.
  const eligible = ctx.campaignBeta.preview ? null : ctx.campaignBeta.guildIds.length === 0 ? [] : teacher
    ? await db.select({ id: s.guilds.id }).from(s.guilds).where(and(inArray(s.guilds.id, ctx.campaignBeta.guildIds), eq(s.guilds.teacherId, actor.actorId), eq(s.guilds.isArchived, false)))
    : await db.select({ id: s.guilds.id }).from(s.guilds).innerJoin(s.guildMemberships, eq(s.guildMemberships.guildId, s.guilds.id)).where(and(inArray(s.guilds.id, ctx.campaignBeta.guildIds), eq(s.guildMemberships.studentId, actor.actorId), eq(s.guilds.isArchived, false)));
  const allowedIds = eligible?.map(g => g.id);
  const enabled = allowedIds === undefined || allowedIds.length > 0;
  if (url.pathname === '/api/campaigns/availability' && request.method === 'GET') return json({ enabled });
  if (!enabled) throw new GameError('Campaign beta is not enabled for your guild.', 403);
  const requireBetaGuild = (id: string) => {
    if (allowedIds && !allowedIds.includes(id)) throw new GameError('Campaign beta is not enabled for this guild.', 403);
  };
  if (url.pathname === '/api/campaigns/options' && request.method === 'GET') {
    ctx.requireTeacher();
    const guilds = await db.select({ id: s.guilds.id, name: s.guilds.name }).from(s.guilds).where(and(eq(s.guilds.teacherId, actor.actorId), eq(s.guilds.isArchived, false), allowedIds ? inArray(s.guilds.id, allowedIds) : undefined));
    const quizzes = await ctx.repository.listTeacherFightSummaries(actor.actorId);
    const assignments = await db.select({ guildId: s.guildFights.guildId, fightId: s.guildFights.fightId }).from(s.guildFights).innerJoin(s.guilds, eq(s.guildFights.guildId, s.guilds.id)).where(and(eq(s.guilds.teacherId, actor.actorId), eq(s.guilds.isArchived, false)));
    return json({ guilds, quizzes, assignments: assignments.filter(a => guilds.some(g => g.id === a.guildId)) });
  }
  if (url.pathname === '/api/campaigns') {
    if (request.method === 'GET') {
      const summary = { id: s.campaigns.id, name: s.campaigns.name, guildId: s.campaigns.guildId, guildName: s.guilds.name,
        dungeonName: s.campaigns.dungeonName, theme: s.campaigns.theme, gates: s.campaigns.gates, revision: s.campaigns.revision };
      const rows = teacher
        ? await db.select(summary).from(s.campaigns).innerJoin(s.guilds, eq(s.guilds.id, s.campaigns.guildId)).where(and(eq(s.campaigns.teacherId, actor.actorId), eq(s.guilds.isArchived, false), allowedIds ? inArray(s.campaigns.guildId, allowedIds) : undefined))
        : await db.select(summary).from(s.campaigns).innerJoin(s.guilds, eq(s.guilds.id, s.campaigns.guildId)).innerJoin(s.guildMemberships, eq(s.guildMemberships.guildId, s.guilds.id)).where(and(eq(s.guildMemberships.studentId, actor.actorId), eq(s.guilds.isArchived, false), allowedIds ? inArray(s.campaigns.guildId, allowedIds) : undefined));
      return json(rows);
    }
    if (request.method === 'POST') {
      ctx.requireTeacher();
      const input = campaignCreate.parse(await readJson(request));
      const guild = await ctx.guild(input.guildId, true);
      requireBetaGuild(guild.id);
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
  const match = url.pathname.match(/^\/api\/campaigns\/([^/]+)(?:\/(actions|gates|shop|question-banks))?$/);
  if (!match) return null;
  const campaign = await requireCampaign(db, z.string().uuid().parse(match[1]), actor);
  requireBetaGuild(campaign.guildId);
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
  if (match[2] === 'question-banks' && request.method === 'GET') return json(await campaignQuestionBanks(db, campaign));
  if (match[2] === 'shop' && request.method === 'GET') return json(await campaignShop(db, campaign));
  if (match[2] === 'actions' && request.method === 'POST') return json(await applyCampaignAction(db, campaign, student, campaignAction.parse(await readJson(request))));
  if (!match[2] && request.method === 'GET') return json(await campaignView(db, campaign, student));
  return json({ error: 'Method not allowed' }, 405);
}
