export type TeamRecord = {
  aliases?: string[];
  name: string;
  sport: string;
};

export const majorTeams: TeamRecord[] = [
  { name: "Atlanta Hawks", sport: "Basketball" },
  { name: "Boston Celtics", sport: "Basketball" },
  { name: "Brooklyn Nets", sport: "Basketball" },
  { name: "Charlotte Hornets", sport: "Basketball" },
  { name: "Chicago Bulls", sport: "Basketball" },
  { name: "Cleveland Cavaliers", sport: "Basketball" },
  { name: "Dallas Mavericks", sport: "Basketball", aliases: ["Mavs"] },
  { name: "Denver Nuggets", sport: "Basketball" },
  { name: "Detroit Pistons", sport: "Basketball" },
  { name: "Golden State Warriors", sport: "Basketball", aliases: ["Warriors"] },
  { name: "Houston Rockets", sport: "Basketball" },
  { name: "Indiana Pacers", sport: "Basketball" },
  { name: "Los Angeles Clippers", sport: "Basketball", aliases: ["Clippers"] },
  { name: "Los Angeles Lakers", sport: "Basketball", aliases: ["Lakers"] },
  { name: "Memphis Grizzlies", sport: "Basketball", aliases: ["Grizzlies"] },
  { name: "Miami Heat", sport: "Basketball" },
  { name: "Milwaukee Bucks", sport: "Basketball" },
  { name: "Minnesota Timberwolves", sport: "Basketball", aliases: ["Wolves"] },
  { name: "New Orleans Pelicans", sport: "Basketball", aliases: ["Pelicans"] },
  { name: "New York Knicks", sport: "Basketball", aliases: ["Knicks"] },
  { name: "Oklahoma City Thunder", sport: "Basketball", aliases: ["Thunder"] },
  { name: "Orlando Magic", sport: "Basketball" },
  { name: "Philadelphia 76ers", sport: "Basketball", aliases: ["Sixers"] },
  { name: "Phoenix Suns", sport: "Basketball" },
  { name: "Portland Trail Blazers", sport: "Basketball", aliases: ["Blazers"] },
  { name: "Sacramento Kings", sport: "Basketball" },
  { name: "San Antonio Spurs", sport: "Basketball", aliases: ["Spurs"] },
  { name: "Toronto Raptors", sport: "Basketball", aliases: ["Raptors"] },
  { name: "Utah Jazz", sport: "Basketball" },
  { name: "Washington Wizards", sport: "Basketball", aliases: ["Wizards"] },

  { name: "Arizona Diamondbacks", sport: "Baseball", aliases: ["Diamondbacks", "Dbacks"] },
  { name: "Atlanta Braves", sport: "Baseball", aliases: ["Braves"] },
  { name: "Baltimore Orioles", sport: "Baseball", aliases: ["Orioles"] },
  { name: "Boston Red Sox", sport: "Baseball", aliases: ["Red Sox"] },
  { name: "Chicago Cubs", sport: "Baseball", aliases: ["Cubs"] },
  { name: "Chicago White Sox", sport: "Baseball", aliases: ["White Sox"] },
  { name: "Cincinnati Reds", sport: "Baseball", aliases: ["Reds"] },
  { name: "Cleveland Guardians", sport: "Baseball", aliases: ["Guardians", "Indians"] },
  { name: "Colorado Rockies", sport: "Baseball", aliases: ["Rockies"] },
  { name: "Detroit Tigers", sport: "Baseball", aliases: ["Tigers"] },
  { name: "Houston Astros", sport: "Baseball", aliases: ["Astros"] },
  { name: "Kansas City Royals", sport: "Baseball", aliases: ["Royals"] },
  { name: "Los Angeles Angels", sport: "Baseball", aliases: ["Angels"] },
  { name: "Los Angeles Dodgers", sport: "Baseball", aliases: ["Dodgers"] },
  { name: "Miami Marlins", sport: "Baseball", aliases: ["Marlins"] },
  { name: "Milwaukee Brewers", sport: "Baseball", aliases: ["Brewers"] },
  { name: "Minnesota Twins", sport: "Baseball", aliases: ["Twins"] },
  { name: "New York Mets", sport: "Baseball", aliases: ["Mets"] },
  { name: "New York Yankees", sport: "Baseball", aliases: ["Yankees"] },
  { name: "Oakland Athletics", sport: "Baseball", aliases: ["Athletics", "A's"] },
  { name: "Philadelphia Phillies", sport: "Baseball", aliases: ["Phillies"] },
  { name: "Pittsburgh Pirates", sport: "Baseball", aliases: ["Pirates"] },
  { name: "San Diego Padres", sport: "Baseball", aliases: ["Padres"] },
  { name: "San Francisco Giants", sport: "Baseball", aliases: ["Giants"] },
  { name: "Seattle Mariners", sport: "Baseball", aliases: ["Mariners"] },
  { name: "St. Louis Cardinals", sport: "Baseball", aliases: ["Cardinals"] },
  { name: "Tampa Bay Rays", sport: "Baseball", aliases: ["Rays"] },
  { name: "Texas Rangers", sport: "Baseball", aliases: ["Rangers"] },
  { name: "Toronto Blue Jays", sport: "Baseball", aliases: ["Blue Jays", "Jays"] },
  { name: "Washington Nationals", sport: "Baseball", aliases: ["Nationals"] },

  { name: "Arizona Cardinals", sport: "Football" },
  { name: "Atlanta Falcons", sport: "Football" },
  { name: "Baltimore Ravens", sport: "Football" },
  { name: "Buffalo Bills", sport: "Football" },
  { name: "Carolina Panthers", sport: "Football" },
  { name: "Chicago Bears", sport: "Football" },
  { name: "Cincinnati Bengals", sport: "Football" },
  { name: "Cleveland Browns", sport: "Football" },
  { name: "Dallas Cowboys", sport: "Football" },
  { name: "Denver Broncos", sport: "Football" },
  { name: "Detroit Lions", sport: "Football" },
  { name: "Green Bay Packers", sport: "Football" },
  { name: "Houston Texans", sport: "Football" },
  { name: "Indianapolis Colts", sport: "Football" },
  { name: "Jacksonville Jaguars", sport: "Football" },
  { name: "Kansas City Chiefs", sport: "Football" },
  { name: "Las Vegas Raiders", sport: "Football", aliases: ["Raiders"] },
  { name: "Los Angeles Chargers", sport: "Football", aliases: ["Chargers"] },
  { name: "Los Angeles Rams", sport: "Football", aliases: ["Rams"] },
  { name: "Miami Dolphins", sport: "Football" },
  { name: "Minnesota Vikings", sport: "Football" },
  { name: "New England Patriots", sport: "Football", aliases: ["Patriots"] },
  { name: "New Orleans Saints", sport: "Football", aliases: ["Saints"] },
  { name: "New York Giants", sport: "Football" },
  { name: "New York Jets", sport: "Football" },
  { name: "Philadelphia Eagles", sport: "Football" },
  { name: "Pittsburgh Steelers", sport: "Football" },
  { name: "San Francisco 49ers", sport: "Football", aliases: ["49ers", "Niners"] },
  { name: "Seattle Seahawks", sport: "Football" },
  { name: "Tampa Bay Buccaneers", sport: "Football", aliases: ["Buccaneers", "Bucs"] },
  { name: "Tennessee Titans", sport: "Football" },
  { name: "Washington Commanders", sport: "Football", aliases: ["Commanders"] },

  { name: "Anaheim Ducks", sport: "Hockey" },
  { name: "Boston Bruins", sport: "Hockey" },
  { name: "Buffalo Sabres", sport: "Hockey" },
  { name: "Calgary Flames", sport: "Hockey" },
  { name: "Carolina Hurricanes", sport: "Hockey" },
  { name: "Chicago Blackhawks", sport: "Hockey" },
  { name: "Colorado Avalanche", sport: "Hockey", aliases: ["Avs"] },
  { name: "Columbus Blue Jackets", sport: "Hockey", aliases: ["Blue Jackets"] },
  { name: "Dallas Stars", sport: "Hockey" },
  { name: "Detroit Red Wings", sport: "Hockey", aliases: ["Red Wings"] },
  { name: "Edmonton Oilers", sport: "Hockey", aliases: ["Oilers"] },
  { name: "Florida Panthers", sport: "Hockey" },
  { name: "Los Angeles Kings", sport: "Hockey" },
  { name: "Minnesota Wild", sport: "Hockey" },
  { name: "Montreal Canadiens", sport: "Hockey", aliases: ["Canadiens", "Habs"] },
  { name: "Nashville Predators", sport: "Hockey", aliases: ["Predators"] },
  { name: "New Jersey Devils", sport: "Hockey", aliases: ["Devils"] },
  { name: "New York Islanders", sport: "Hockey", aliases: ["Islanders"] },
  { name: "New York Rangers", sport: "Hockey", aliases: ["Rangers"] },
  { name: "Ottawa Senators", sport: "Hockey", aliases: ["Senators"] },
  { name: "Philadelphia Flyers", sport: "Hockey", aliases: ["Flyers"] },
  { name: "Pittsburgh Penguins", sport: "Hockey", aliases: ["Penguins"] },
  { name: "San Jose Sharks", sport: "Hockey", aliases: ["Sharks"] },
  { name: "Seattle Kraken", sport: "Hockey", aliases: ["Kraken"] },
  { name: "St. Louis Blues", sport: "Hockey", aliases: ["Blues"] },
  { name: "Tampa Bay Lightning", sport: "Hockey", aliases: ["Lightning"] },
  { name: "Toronto Maple Leafs", sport: "Hockey", aliases: ["Maple Leafs", "Leafs"] },
  { name: "Vancouver Canucks", sport: "Hockey", aliases: ["Canucks"] },
  { name: "Vegas Golden Knights", sport: "Hockey", aliases: ["Golden Knights"] },
  { name: "Washington Capitals", sport: "Hockey", aliases: ["Capitals"] },
  { name: "Winnipeg Jets", sport: "Hockey" },
];

export function teamFromText(value: string) {
  const lower = value.toLowerCase();
  if (/\breal madrid\b/.test(lower)) return "Real Madrid";
  if (/\bteam japan\b/.test(lower)) return "Team Japan";

  const match = majorTeams.find((team) =>
    [team.name, ...(team.aliases ?? [])].some((name) =>
      lower.includes(name.toLowerCase()),
    ),
  );

  return match?.name ?? "";
}

export function sportFromText(value: string) {
  const lower = value.toLowerCase();
  const team = majorTeams.find((item) =>
    [item.name, ...(item.aliases ?? [])].some((name) =>
      lower.includes(name.toLowerCase()),
    ),
  );

  if (team) return team.sport;
  if (/\b(ufc|mma|ultimate fighting|flyweight|bantamweight|featherweight|lightweight|welterweight|middleweight|light heavyweight|heavyweight|strawweight)\b/.test(lower)) {
    return "MMA";
  }
  if (/\b(f1|formula 1|formula one|grand prix|motorsport|racing)\b/.test(lower)) return "F1";
  if (/(nba|basketball)\b/.test(lower)) return "Basketball";
  if (/(mlb|baseball)\b/.test(lower)) return "Baseball";
  if (/(nfl|football)\b/.test(lower)) return "Football";
  if (/(nhl|hockey)\b/.test(lower)) return "Hockey";
  if (/(soccer|fifa|uefa|premier league|football club)\b/.test(lower)) return "Soccer";
  if (/\breal madrid\b|\bclub world cup\b/.test(lower)) return "Soccer";
  if (/(pokemon|pok[eé]mon|tcg|charizard|pikachu)\b/.test(lower)) return "Pokemon";
  if (/(magic the gathering|mtg|planeswalker)\b/.test(lower)) return "Magic";

  return "";
}
