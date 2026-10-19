function optionalText(value, field, max = 10000) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > max) {
    throw new Error(`${field}: требуется строка длиной до ${max} символов`);
  }
  return value.trim() || null;
}

export function validateGameImport(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 100) {
    throw new Error("Файл должен содержать массив из 1–100 игр");
  }
  const ids = new Set();
  const slugs = new Set();
  let provider;
  return input.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Игра ${index + 1}: требуется объект`);
    }
    const externalIds = ["rawgId", "igdbId"].filter((key) => item[key] != null);
    if (externalIds.length !== 1) throw new Error("Нужен ровно один внешний ID: rawgId или igdbId");
    const key = externalIds[0];
    if (!Number.isInteger(item[key]) || item[key] < 1 || item[key] > 2147483647) {
      throw new Error(`Игра ${index + 1}: некорректный ${key}`);
    }
    if (provider && provider !== key) throw new Error("Одна партия должна содержать игры одного источника");
    provider = key;
    const slug = optionalText(item.slug, "slug", 200);
    const title = optionalText(item.title, "title", 300);
    if (!slug || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(slug) || !title) {
      throw new Error(`Игра ${index + 1}: нужны title и slug (например elden-ring)`);
    }
    if (ids.has(item[key]) || slugs.has(slug)) {
      throw new Error(`Игра ${index + 1}: повторяющийся внешний ID или slug`);
    }
    ids.add(item[key]);
    slugs.add(slug);
    const coverUrl = optionalText(item.coverUrl, "coverUrl", 2048);
    if (coverUrl) {
      const url = new URL(coverUrl);
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("coverUrl: требуется HTTPS URL без учётных данных");
      }
    }
    return {
      [key]: item[key], slug, title, coverUrl,
      description: optionalText(item.description, "description"),
      developer: optionalText(item.developer, "developer", 300),
      publisher: optionalText(item.publisher, "publisher", 300),
      releaseDate: optionalDate(item.releaseDate),
      genres: names(item.genres, "genres"),
      platforms: names(item.platforms, "platforms"),
      tags: names(item.tags, "tags"),
      rating: optionalNumber(item.rating, "rating", 5),
      metacritic: optionalNumber(item.metacritic, "metacritic", 100, true),
      playtime: optionalNumber(item.playtime, "playtime", 2147483647, true),
    };
  });
}

function optionalDate(value) {
  if (value == null) return null;
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error("releaseDate: требуется существующая дата YYYY-MM-DD");
  }
  return value;
}

function names(value, field) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length > 100
    || value.some((name) => typeof name !== "string" || !name.trim() || name.length > 200)) {
    throw new Error(`${field}: требуется массив до 100 непустых строк длиной до 200 символов`);
  }
  return [...new Set(value.map((name) => name.trim()))];
}

function optionalNumber(value, field, max, integer = false) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max
    || (integer && !Number.isInteger(value))) throw new Error(`${field}: некорректное число`);
  return value;
}
