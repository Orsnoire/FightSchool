import type { GameDatabase } from "../db/database";
import type { IdentityRepository } from "../db/repository";
import type { GameAccess } from "../services/access";
import type { CampaignBetaPolicy } from "../campaign/beta";
export type GameRouteContext = GameAccess & {
  request: Request;
  url: URL;
  repository: IdentityRepository;
  db: GameDatabase;
  campaignBeta: CampaignBetaPolicy;
};
