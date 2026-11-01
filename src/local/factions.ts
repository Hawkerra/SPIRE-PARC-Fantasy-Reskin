/**
 * In the Chub build, factions are distilled from random setting/organization cards found on Chub. SPIRE Local
 * has no catalogue to search, so it hands the same distillation a seed concept instead, and the AI builds the
 * faction from that. Seeds are deliberately varied, to keep factions from collapsing into generic guilds, and
 * their names avoid "The X of Y" patterns, which SPIRE's name matching treats as duplicates of each other.
 */
const FACTION_SEEDS: { name: string; concept: string }[] = [
    { name: 'Saltwake Consortium', concept: 'A river-and-sea trading consortium of barge families who control the only safe passages through the flooded lowlands, run by a council of matriarchs with long memories for debts.' },
    { name: 'Quiet Bell Order', concept: 'A mendicant order of plague-doctor monks who travel between stricken towns, part healers and part quarantine enforcers, feared and needed in equal measure.' },
    { name: 'Gilded Wyrm Company', concept: 'A professional dragon-hunting company that has grown rich, political and somewhat decadent now that dragons are rare, and quietly breeds trouble to stay in business.' },
    { name: 'Lantern Court', concept: 'A nocturnal fey court that trades in names, memories and favors, polite to the point of menace and bound by strange rules of hospitality.' },
    { name: 'Ashen Collegium', concept: 'A necromantic academy that treats death as an engineering problem, staffing its farms and mines with the willing dead and debating the ethics of it endlessly.' },
    { name: 'Free Skies Compact', concept: 'A loose fleet of airship crews and sky-pirates who have formed a reluctant government in the clouds, with a charter nobody fully obeys.' },
    { name: 'Thornwatch Wardens', concept: 'Wardens of a vast cursed forest who keep what lives inside from getting out, recruiting the desperate and the exiled for a duty that ages them fast.' },
    { name: 'Vehrish Glasswrights', concept: 'A desert city-state of artisans who craft enchanted glass, mirrors that remember and lenses that reveal, and guard their furnace secrets with assassins.' },
    { name: 'Hollow Crown Regency', concept: 'A kingdom whose monarch has been missing for eleven years, run by a regency of rival ministers each pretending to know where the ruler went.' },
    { name: 'Brine Sisters', concept: 'A matriarchal cult of sea-witches who bargain with drowned gods for calm waters, and collect their price from coastal villages in strange ways.' },
    { name: 'Clockwork Ministry', concept: 'A bureaucracy of artificers and their automaton clerks who catalogue, license and tax every use of magic within a sprawling capital.' },
    { name: 'Velvet Ledger', concept: 'An information broker network operating out of teahouses and brothels, selling secrets to every side and claiming neutrality with a straight face.' },
    { name: 'Stone Moot', concept: 'A confederation of mountain clans, dwarven and otherwise, who settle every dispute by debate-duel and never forget a grudge or a gift.' },
    { name: 'Sunken Choir', concept: 'Merfolk cantors who keep the history of the drowned cities in song and are slowly deciding whether the surface world deserves to hear it.' },
    { name: 'Rookery Couriers', concept: 'A guild of couriers, spies and cat burglars who use trained corvids and rooftop roads, priding themselves on never reading the letters they carry (mostly).' },
    { name: 'Pale Pilgrims', concept: 'Wandering zealots convinced the Spire is a holy relic, who alternately pray at its leyline, petition the Magus and plot to steal it.' },
    { name: 'Harvest Wardens', concept: 'A militia of farmers and hedge-druids protecting the breadbasket provinces, practical, suspicious of wizards and chronically short of hands at harvest.' },
    { name: 'Opaline Theatre', concept: 'A troupe of illusionist-actors whose performances are so real that they double as a diplomatic corps, an alibi service and occasionally a weapon.' },
    { name: 'Iron Hymnal', concept: 'A militant church of war-priests and battle-singers who fight for whichever cause their oracle names, and are rarely on the same side twice.' },
    { name: 'Moonwell Concordance', concept: 'A circle of lycanthropic families who have made peace with their curse and now run an isolated valley sanctuary with very particular visiting hours.' },
    { name: 'Cinder Exchange', concept: 'A volcanic trade city where fire-elementals are bound as laborers, built on a fragile and increasingly contested contract that is coming up for renewal.' },
    { name: 'Mapless Guild', concept: 'Explorers and cartographers who chart the shifting wilds and ruins around places like the Spire, paying handsomely for anyone who comes back with new maps.' },
    { name: 'Ivory Tribunal', concept: 'An itinerant court of judges and their oath-bound enforcers who claim jurisdiction over any crime involving magic, wherever it happens.' },
    { name: 'Gutter Princes', concept: 'A criminal syndicate of orphans-grown-up who run the underground canals of a great city with a strict code and an excellent pension plan.' },
];

// Seeds handed out this session. The AI may rename a faction, so existing names alone can't rule a seed out.
const seedsUsedThisSession = new Set<string>();

/** A seed for a new faction, avoiding ones already used in this save or this session where possible. */
export function pickFactionSeed(existingNames: string[]): { name: string; fullPath: string; personality: string } {
    const taken = new Set([...existingNames.map(n => n.toLowerCase()), ...seedsUsedThisSession]);
    const available = FACTION_SEEDS.filter(seed => !taken.has(seed.name.toLowerCase()));
    const pool = available.length > 0 ? available : FACTION_SEEDS;
    const seed = pool[Math.floor(Math.random() * pool.length)];
    seedsUsedThisSession.add(seed.name.toLowerCase());
    return {
        name: seed.name,
        fullPath: '',
        personality: `${seed.name}: ${seed.concept} Treat this as a starting concept and develop it freely; the name may be changed if a better one fits.`,
    };
}
