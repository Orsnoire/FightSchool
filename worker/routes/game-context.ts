import type { GameDatabase } from "../db/game-repository";
import type { IdentityRepository } from "../db/repository";
import type { GameAccess } from "../services/access";

export type GameRouteContext = GameAccess & {
  request: Request;
  url: URL;
  repository: IdentityRepository;
  db: GameDatabase;
};
