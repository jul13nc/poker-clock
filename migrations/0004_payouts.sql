-- Buy-in par défaut à 10 €, gains par table de pool, et suppression des antes.

UPDATE seasons SET default_buyin = 10 WHERE default_buyin = 20;

UPDATE seasons
SET payout_json = '{"50":{"1":30,"2":20},"60":{"1":40,"2":20},"70":{"1":40,"2":20,"3":10},"80":{"1":40,"2":30,"3":10},"90":{"1":50,"2":30,"3":10},"100":{"1":60,"2":30,"3":10},"110":{"1":70,"2":30,"3":10},"120":{"1":70,"2":40,"3":10},"130":{"1":80,"2":40,"3":10},"140":{"1":90,"2":40,"3":10}}'
WHERE payout_json LIKE '[%';

UPDATE blind_structures
SET levels_json = (
	SELECT json_group_array(json_set(value, '$.ante', 0))
	FROM json_each(blind_structures.levels_json)
)
WHERE levels_json LIKE '%"ante":%';

UPDATE tournaments
SET structure_json = (
	SELECT json_group_array(json_set(value, '$.ante', 0))
	FROM json_each(tournaments.structure_json)
)
WHERE structure_json LIKE '%"ante":%';
