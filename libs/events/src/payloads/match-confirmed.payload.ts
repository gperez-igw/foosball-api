export interface MatchConfirmedPayload {
  matchId: number;
  winnerTeam: 'A' | 'B' | 'draw';
  scoreA: number;
  scoreB: number;
  confirmedAt: string;
}
