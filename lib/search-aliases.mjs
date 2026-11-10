// Catalog titles are the original English ones. People type the Russian names they know,
// so a search also tries the English spelling of well-known Russian titles and nicknames.
const ALIASES = {
  "ведьмак": "witcher", "скайрим": "skyrim", "гта": "grand theft auto", "киберпанк": "cyberpunk",
  "контра": "counter-strike", "кс": "counter-strike", "дота": "dota", "портал": "portal", "фоллаут": "fallout",
  "фолыч": "fallout", "сталкер": "s.t.a.l.k.e.r.", "метро": "metro", "майнкрафт": "minecraft", "террария": "terraria",
  "халф лайф": "half-life", "халфа": "half-life", "халф-лайф": "half-life", "одни из нас": "last of us",
  "бог войны": "god of war", "мафия": "mafia", "хитман": "hitman", "ассасин": "assassin", "дум": "doom",
  "резидент": "resident evil", "обитель зла": "resident evil", "дарк соулс": "dark souls", "элден ринг": "elden ring",
  "хадес": "hades", "аид": "hades", "цивилизация": "civilization", "цива": "civilization", "симс": "sims",
  "героев": "heroes of might", "герои": "heroes of might", "ворлд оф": "world of", "танки": "world of tanks",
  "батла": "battlefield", "батлфилд": "battlefield", "колда": "call of duty", "фар край": "far cry",
  "томб райдер": "tomb raider", "лара крофт": "tomb raider", "бэтмен": "batman", "человек-паук": "spider-man",
  "человек паук": "spider-man", "ред дед": "red dead", "рдр": "red dead", "детройт": "detroit", "балдурс": "baldur",
  "балдур": "baldur", "врата балдура": "baldur", "старкрафт": "starcraft", "варкрафт": "warcraft", "диабло": "diablo",
  "овервотч": "overwatch", "раст": "rust", "арк": "ark", "варфрейм": "warframe", "апекс": "apex", "пабг": "pubg",
  "фортнайт": "fortnite", "стардью": "stardew", "долина стардью": "stardew", "селеста": "celeste",
  "полый рыцарь": "hollow knight", "холлоу найт": "hollow knight", "андертейл": "undertale", "капхед": "cuphead",
  "биошок": "bioshock", "дизонорд": "dishonored", "бордерлендс": "borderlands", "масс эффект": "mass effect",
  "драгон эйдж": "dragon age", "ведьмы": "witch", "ниер": "nier", "персона": "persona", "финалка": "final fantasy",
  "финал фэнтези": "final fantasy", "сайлент хилл": "silent hill", "аутласт": "outlast", "фазмофобия": "phasmophobia",
  "амонг ас": "among us", "среди нас": "among us", "фолл гайс": "fall guys", "рокет лига": "rocket league",
  "евро трак": "euro truck", "дальнобойщики": "truck simulator", "сабнавтика": "subnautica", "но мэнс скай": "no man's sky",
  "вальхейм": "valheim", "лефт фо дед": "left 4 dead", "тим фортресс": "team fortress", "пейдей": "payday",
  "жизнь странная": "life is strange", "дэд спейс": "dead space", "крайзис": "crysis", "кризис": "crysis",
  "макс пейн": "max payne", "принц персии": "prince of persia", "готика": "gothic", "кингдом кам": "kingdom come",
  "хогвартс": "hogwarts", "гарри поттер": "hogwarts", "чёрный миф": "black myth", "черный миф": "black myth",
  "вуконг": "wukong", "хеллдайверс": "helldivers", "диско элизиум": "disco elysium", "слей зе спайр": "slay the spire",
  "мёртвые клетки": "dead cells", "мертвые клетки": "dead cells", "фактория": "factorio", "факторио": "factorio",
  "сатисфактори": "satisfactory", "римворлд": "rimworld", "города": "cities", "паладины": "paladins",
};

// Returns the search strings to try: the original first, then its English spelling when one is known.
export function expandSearch(search) {
  const text = typeof search === "string" ? search.trim() : "";
  if (!text) return [];
  const terms = [text];
  const lower = text.toLowerCase().replace(/ё/g, "е");
  if (!/[а-я]/.test(lower)) return terms;
  // The longest alias wins, so "халф лайф 2" becomes "half-life 2" and not a partial match.
  const alias = Object.keys(ALIASES).map((key) => key.replace(/ё/g, "е"))
    .filter((key) => lower.includes(key)).sort((a, b) => b.length - a.length)[0];
  if (alias) {
    const original = Object.keys(ALIASES).find((key) => key.replace(/ё/g, "е") === alias);
    const translated = lower.replace(alias, ALIASES[original]).replace(/[а-я]+/g, " ").replace(/\s+/g, " ").trim();
    if (translated && translated !== lower) terms.push(translated);
  }
  return terms;
}
