import { authenticateSession, type SessionConfig } from '../auth/session.ts';
import type { IdentityRepository } from '../db/repository.ts';
import type { GameDatabase } from '../db/game-repository.ts';
import { getStudentAvatar, createStudentAvatar, saveStudentAvatarColors } from '../db/avatar-repository.ts';
import { validAppearance } from '../../shared/avatar/appearance.ts';

const json = (body: unknown, status=200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function appearance(value: Awaited<ReturnType<typeof getStudentAvatar>>) {
  if (!value) return null;
  const { modelId, hairColorId, eyeColorId, skinColorId } = value;
  return { modelId, hairColorId, eyeColorId, skinColorId };
}

export async function handleAvatar(request:Request, url:URL, repository:IdentityRepository, config:SessionConfig, db:GameDatabase):Promise<Response|null> {
  const match=url.pathname.match(/^\/api\/student\/([^/]+)\/avatar$/);
  if (!match) return null;
  const actor=await authenticateSession(request,repository,config,'student');
  if (!actor) return json({error:'Student authentication required'},401);
  if (actor.actorId!==match[1]) return json({error:'Forbidden'},403);
  if (request.method==='GET') return json(appearance(await getStudentAvatar(db,actor.actorId)));
  if (!['POST','PUT'].includes(request.method)) return json({error:'Method not allowed'},405);
  let value:unknown;
  try { value=await request.json(); } catch { return json({error:'Invalid JSON'},400); }
  if (!validAppearance(value)) return json({error:'Invalid avatar selection'},400);
  if (request.method==='POST') return json(appearance(await createStudentAvatar(db,actor.actorId,value.modelId,value)));
  const existing=await getStudentAvatar(db,actor.actorId);
  if (!existing) return json({error:'Create your avatar first'},409);
  if (value.modelId!==existing.modelId) return json({error:'The saved body model cannot be changed'},409);
  return json(appearance(await saveStudentAvatarColors(db,actor.actorId,value)));
}
