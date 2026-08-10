// Matches a person's free-text country (from the AI, e.g. "United States",
// "Russia", "the UK") against map country names (e.g. "United States of
// America", "Bosnia and Herz.") using normalization + alias tables.

const ALIASES: Record<string, string> = {
  "united states of america": "united states",
  usa: "united states",
  "u.s.": "united states",
  "u.s.a.": "united states",
  us: "united states",
  america: "united states",
  uk: "united kingdom",
  "u.k.": "united kingdom",
  britain: "united kingdom",
  "great britain": "united kingdom",
  england: "united kingdom",
  "russian federation": "russia",
  "south korea": "south korea",
  "republic of korea": "south korea",
  korea: "south korea",
  "north korea": "north korea",
  "democratic people's republic of korea": "north korea",
  dprk: "north korea",
  iran: "iran",
  "islamic republic of iran": "iran",
  syria: "syria",
  "syrian arab republic": "syria",
  venezuela: "venezuela",
  bolivia: "bolivia",
  tanzania: "tanzania",
  vietnam: "vietnam",
  "viet nam": "vietnam",
  laos: "laos",
  "lao pdr": "laos",
  moldova: "moldova",
  "republic of moldova": "moldova",
  "bosnia and herz.": "bosnia and herzegovina",
  "bosnia and herzegovina": "bosnia and herzegovina",
  bosnia: "bosnia and herzegovina",
  "czech republic": "czechia",
  czechia: "czechia",
  "dominican republic": "dominican rep.",
  "dem. rep. congo": "democratic republic of the congo",
  drc: "democratic republic of the congo",
  congo: "republic of the congo",
  "republic of the congo": "republic of the congo",
  "central african republic": "central african rep.",
  "equatorial guinea": "eq. guinea",
  "ivory coast": "côte d'ivoire",
  "east timor": "timor-leste",
  burma: "myanmar",
  "swaziland": "eswatini",
  "vatican city": "vatican",
  "palestinian territories": "palestine",
  "west bank": "palestine",
  gaza: "palestine",
  "u.a.e.": "united arab emirates",
  uae: "united arab emirates",
  "s. sudan": "south sudan",
  "n. cyprus": "northern cyprus",
  "falkland islands": "falkland is.",
  "solomon islands": "solomon is.",
  "western sahara": "w. sahara",
};

function normalize(s: string): string {
  let x = s.trim().toLowerCase();
  x = x.replace(/^(the)\s+/, "");
  x = x.replace(/\s+/g, " ");
  return ALIASES[x] ?? x;
}

/** True if a person's country string refers to the given map country name. */
export function countryMatches(personCountry: string, mapCountryName: string): boolean {
  if (!personCountry) return false;
  const a = normalize(personCountry);
  const b = normalize(mapCountryName);
  if (a === b) return true;
  // handle compound answers like "Russia / Soviet Union" or "United States, Russia"
  const parts = personCountry.split(/[,/;|]/).map((s) => normalize(s));
  return parts.includes(b);
}
