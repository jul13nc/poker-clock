export type CommandMeta = { commandId: string; expectedRevision: number };
type PlayerAction = 'rebuy' | 'unrebuy' | 'eliminate' | 'hand72_add' | 'hand72_remove';
type SimpleAction = 'start' | 'pause' | 'resume' | 'next' | 'prev' | 'cancel_elimination' | 'draw_seats';
export type TournamentCommand = CommandMeta & (
	{ action: PlayerAction; playerId: string } |
	{ action: SimpleAction } |
	{ action: 'add_time' | 'set_rebuy_duration'; minutes: number }
);

export function parseCommand(value: unknown): TournamentCommand | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const body = value as Record<string, unknown>;
	if (typeof body.commandId !== 'string' || !/^[\w-]{16,100}$/.test(body.commandId) ||
		!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) return null;
	const meta = { commandId: body.commandId, expectedRevision: Number(body.expectedRevision) };
	const action = body.action;
	if (action === 'rebuy' || action === 'unrebuy' || action === 'eliminate' || action === 'hand72_add' || action === 'hand72_remove') {
		if (typeof body.playerId !== 'string' || !body.playerId || body.playerId.length > 100) return null;
		return { ...meta, action, playerId: body.playerId };
	}
	if (action === 'add_time' || action === 'set_rebuy_duration') {
		if (typeof body.minutes !== 'number' || !Number.isSafeInteger(body.minutes)) return null;
		if (action === 'add_time' ? body.minutes === 0 || Math.abs(body.minutes) > 60 : body.minutes < 0 || body.minutes > 10080) return null;
		return { ...meta, action, minutes: body.minutes };
	}
	if (action === 'start' || action === 'pause' || action === 'resume' || action === 'next' || action === 'prev' || action === 'cancel_elimination' || action === 'draw_seats') return { ...meta, action };
	return null;
}
