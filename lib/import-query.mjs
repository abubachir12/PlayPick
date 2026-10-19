export function createImportQuery(sql, records) {
  // Identifiers come only from this allowlist. Imported values are bound parameters.
  const rawg = records[0]?.rawgId != null;
  const column = rawg ? "rawg_id" : "igdb_id";
  const key = rawg ? "rawgId" : "igdbId";
  return sql.query(`
    INSERT INTO games (${column}, slug, title, description, cover_url, developer, publisher,
      release_date, genres, platforms, tags, rating, metacritic, playtime)
    SELECT "${key}", slug, title, description, "coverUrl", developer, publisher,
      "releaseDate", genres, platforms, tags, rating, metacritic, playtime
    FROM jsonb_to_recordset($1::jsonb)
      AS source("${key}" integer, slug text, title text, description text,
        "coverUrl" text, developer text, publisher text, "releaseDate" date,
        genres jsonb, platforms jsonb, tags jsonb, rating real, metacritic integer, playtime integer)
    ON CONFLICT (${column}) DO UPDATE SET
      title = EXCLUDED.title,
      description = COALESCE(EXCLUDED.description, games.description),
      cover_url = COALESCE(EXCLUDED.cover_url, games.cover_url),
      developer = COALESCE(EXCLUDED.developer, games.developer),
      publisher = COALESCE(EXCLUDED.publisher, games.publisher),
      release_date = COALESCE(EXCLUDED.release_date, games.release_date),
      genres = COALESCE(EXCLUDED.genres, games.genres),
      platforms = COALESCE(EXCLUDED.platforms, games.platforms),
      tags = COALESCE(EXCLUDED.tags, games.tags),
      rating = COALESCE(EXCLUDED.rating, games.rating),
      metacritic = COALESCE(EXCLUDED.metacritic, games.metacritic),
      playtime = COALESCE(EXCLUDED.playtime, games.playtime),
      updated_at = now()
    RETURNING id
  `, [JSON.stringify(records)]);
}
