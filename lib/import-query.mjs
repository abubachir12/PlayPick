export function createImportQuery(sql, records) {
  return sql`
    INSERT INTO games (igdb_id, slug, title, description, cover_url, developer, publisher)
    SELECT "igdbId", slug, title, description, "coverUrl", developer, publisher
    FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb)
      AS source("igdbId" integer, slug text, title text, description text,
        "coverUrl" text, developer text, publisher text)
    ON CONFLICT (igdb_id) DO UPDATE SET
      title = EXCLUDED.title,
      description = COALESCE(EXCLUDED.description, games.description),
      cover_url = COALESCE(EXCLUDED.cover_url, games.cover_url),
      developer = COALESCE(EXCLUDED.developer, games.developer),
      publisher = COALESCE(EXCLUDED.publisher, games.publisher),
      updated_at = now()
    RETURNING id
  `;
}
