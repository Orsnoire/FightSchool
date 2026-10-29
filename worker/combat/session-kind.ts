/** Campaign admission has always allocated CP + uppercase UUID hex; classroom codes have six characters. */
export function isCampaignSessionId(sessionId: string): boolean {
  return /^CP[0-9A-F]{32}$/.test(sessionId);
}

export function newCampaignSessionId(): string {
  return `CP${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`;
}
