export class CatalogQueryError extends Error {}

function positiveInteger(params, name, fallback, max) {
  const values = params.getAll(name);
  if (!values.length) return fallback;
  const value = values[0];
  if (values.length !== 1 || !/^[1-9]\d*$/.test(value)) {
    throw new CatalogQueryError(`${name}: требуется положительное целое число`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max) {
    throw new CatalogQueryError(`${name}: максимальное значение ${max}`);
  }
  return number;
}

export function parseCatalogQuery(params) {
  const page = positiveInteger(params, "page", 1, 1000000);
  const limit = positiveInteger(params, "limit", 20, 100);
  const searches = params.getAll("search");
  const search = (searches[0] ?? "").trim();
  if (searches.length > 1 || search.length > 200) {
    throw new CatalogQueryError("search: укажите одну строку длиной до 200 символов");
  }
  return { page, limit, search, offset: (page - 1) * limit };
}

// Treat SQL LIKE metacharacters as literal characters in the search string.
export function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function parseCatalogFilters(params) {
  const result = {};
  for (const name of ["genre", "platform"]) {
    const values = params.getAll(name);
    const value = (values[0] ?? "").trim();
    if (values.length > 1 || (values.length && !value) || value.length > 200) {
      throw new CatalogQueryError(`${name}: укажите одно название длиной до 200 символов`);
    }
    result[name] = value;
  }
  const sorts = params.getAll("sort");
  const sort = sorts[0] ?? "title";
  if (sorts.length > 1 || !["title", "rating", "release-date"].includes(sort)) {
    throw new CatalogQueryError("sort: допустимы title, rating, release-date");
  }
  return { ...result, sort };
}
