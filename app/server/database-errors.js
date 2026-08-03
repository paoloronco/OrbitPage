const DATABASE_OPERATIONS = new Set(['read', 'query', 'write']);

/**
 * Database statements and bound parameters may contain password hashes,
 * tokens, API keys or private page content. Keep operational logs useful
 * without serializing any part of the rejected query or driver error.
 */
export function logDatabaseError(operation) {
  const safeOperation = DATABASE_OPERATIONS.has(operation) ? operation : 'operation';
  console.error(`Database ${safeOperation} failed.`);
}
