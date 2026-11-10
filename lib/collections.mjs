// Ready-made collections: each is a plain rule over catalog fields, so it stays current as the catalog grows.
// Rules: tagsAny (any of these tags), tagsNone (none of these), free, deal (discounted now), maxPrice (minor units), playtime [min, max] hours,
// releasedBefore (YYYY-MM-DD), minRating; sort is a catalog sort name.

export const COLLECTIONS = [
  { id: "playing-now", title: "Сейчас играют", text: "Игры с самым большим онлайном в Steam прямо сейчас.",
    rule: { playing: true }, sort: "popular" },
  { id: "deals", title: "Сейчас со скидкой", text: "Цены в российском Steam, обновляются раз в день.",
    rule: { deal: true }, sort: "discount" },
  { id: "under-500", title: "До 500 ₽", text: "Хорошие игры по цене обеда.",
    rule: { maxPrice: 50000, minRating: 3.8 }, sort: "rating" },
  { id: "free", title: "Лучшие бесплатные", text: "Можно начать сегодня и не платить.",
    rule: { free: true }, sort: "rating" },
  { id: "coop", title: "Кооператив с друзьями", text: "Проходить вместе — по сети или на одном диване.",
    rule: { tagsAny: ["Co-op", "Online Co-Op", "Local Co-Op", "cooperative", "Split Screen"] }, sort: "rating" },
  { id: "one-evening", title: "Пройти за вечер", text: "Короткие игры: в среднем до шести часов.",
    // Average playtime is low for huge games people only sample, so open worlds and online games are left out.
    rule: { playtime: [1, 6], minRating: 3.7, tagsNone: ["Open World", "Multiplayer", "MMO", "Sandbox"] }, sort: "rating" },
  { id: "story", title: "Сильный сюжет", text: "Истории, которые хочется дослушать до конца.",
    rule: { tagsAny: ["Story Rich", "Choices Matter", "Narration"], minRating: 4 }, sort: "rating" },
  { id: "cozy", title: "Уютные и спокойные", text: "Без спешки, таймеров и поражений.",
    rule: { tagsAny: ["Relaxing", "Cozy", "Cute", "Farming Sim", "Wholesome"] }, sort: "rating" },
  { id: "hardcore", title: "Для тех, кто любит посложнее", text: "Souls-like, рогалики и всё, где ошибки дорого стоят.",
    rule: { tagsAny: ["Souls-like", "Difficult", "Roguelike", "Rogue-lite", "Perma Death"] }, sort: "rating" },
  { id: "horror", title: "Пощекотать нервы", text: "Хорроры — лучше в наушниках и с выключенным светом.",
    rule: { tagsAny: ["Horror", "Survival Horror", "Psychological Horror"] }, sort: "rating" },
  { id: "open-world", title: "Большие открытые миры", text: "Идти куда глаза глядят и не упираться в стены.",
    rule: { tagsAny: ["Open World", "Sandbox", "Exploration"], minRating: 4 }, sort: "rating" },
  { id: "classics", title: "Классика, проверенная временем", text: "Вышли до 2012 года и до сих пор держат высокую оценку.",
    rule: { releasedBefore: "2012-01-01", minRating: 4.1 }, sort: "rating" },
];

export const COLLECTION_IDS = COLLECTIONS.map((collection) => collection.id);

export function findCollection(id) {
  return COLLECTIONS.find((collection) => collection.id === id) ?? null;
}

const lower = (list) => (Array.isArray(list) ? list : []).map((name) => String(name).toLowerCase());

// The same rule in plain JavaScript: used by tests and anywhere the catalog is already in memory.
export function matchesCollection(game, collection) {
  const { rule } = collection;
  const tags = lower(game.tags);
  if (rule.tagsAny && !rule.tagsAny.some((tag) => tags.includes(tag.toLowerCase()))) return false;
  if (rule.tagsNone && rule.tagsNone.some((tag) => tags.includes(tag.toLowerCase()))) return false;
  // The store's own "free" flag wins; the community tag is used only for games the store knows nothing about.
  if (rule.free && !(game.isFree === true || (game.isFree == null && tags.includes("free to play")))) return false;
  if (rule.deal && !(game.discountPercent > 0)) return false;
  if (rule.playing && !(game.playersNow > 0)) return false;
  if (rule.maxPrice != null && !(game.priceFinal > 0 && game.priceFinal <= rule.maxPrice)) return false;
  if (rule.playtime && !(game.playtime >= rule.playtime[0] && game.playtime <= rule.playtime[1])) return false;
  if (rule.releasedBefore && !(typeof game.releaseDate === "string" && game.releaseDate < rule.releasedBefore)) return false;
  if (rule.minRating != null && !(game.rating >= rule.minRating)) return false;
  return true;
}
