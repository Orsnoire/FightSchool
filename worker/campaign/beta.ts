export type CampaignBetaPolicy = { preview: boolean; guildIds: string[] };

// Main-site beta is opt-in by guild. Never infer permission from a URL, client
// flag, teacher name or fixture account. Missing/invalid configuration is closed.
export function campaignBetaPolicy(environment?: string, guildIds = ''): CampaignBetaPolicy {
  const values = guildIds.split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  const valid = values.every(value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value));
  return { preview: environment === 'campaign-preview', guildIds: valid ? [...new Set(values)] : [] };
}
