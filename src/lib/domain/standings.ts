export function rankStandings<T extends { id: string; name: string; points: number; wins: number }>(rows: T[]): (T & { rank: number })[] {
	const sorted = [...rows].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name, 'fr') || a.id.localeCompare(b.id));
	let rank = 0;
	return sorted.map((row, index) => {
		if (index === 0 || row.points !== sorted[index - 1].points) rank = index + 1;
		return { ...row, rank };
	});
}
