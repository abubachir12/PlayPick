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
  return input.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Игра ${index + 1}: требуется объект`);
    }
    if (!Number.isInteger(item.igdbId) || item.igdbId < 1 || item.igdbId > 2147483647) {
      throw new Error(`Игра ${index + 1}: некорректный igdbId`);
    }
    const slug = optionalText(item.slug, "slug", 200);
    const title = optionalText(item.title, "title", 300);
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !title) {
      throw new Error(`Игра ${index + 1}: нужны title и slug (например elden-ring)`);
    }
    if (ids.has(item.igdbId) || slugs.has(slug)) {
      throw new Error(`Игра ${index + 1}: повторяющийся igdbId или slug`);
    }
    ids.add(item.igdbId);
    slugs.add(slug);
    const coverUrl = optionalText(item.coverUrl, "coverUrl", 2048);
    if (coverUrl) {
      const url = new URL(coverUrl);
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("coverUrl: требуется HTTPS URL без учётных данных");
      }
    }
    return {
      igdbId: item.igdbId, slug, title, coverUrl,
      description: optionalText(item.description, "description"),
      developer: optionalText(item.developer, "developer", 300),
      publisher: optionalText(item.publisher, "publisher", 300),
    };
  });
}
