import { afterEach, describe, expect, it, vi } from 'vitest';
import { logDatabaseError } from './database-errors.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('database error logging', () => {
  it('does not serialize SQL, parameters, driver messages or stacks', () => {
    const secret = 'op_secret_that_must_not_reach_logs';
    const error = new Error(`SQLITE_CONSTRAINT near ${secret}`);
    error.stack = `database stack containing ${secret}`;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    logDatabaseError('write', {
      sql: 'UPDATE users SET api_token = ?',
      params: [secret],
      error,
    });

    expect(consoleError).toHaveBeenCalledWith('Database write failed.');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(secret);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('UPDATE users');
  });

  it('does not allow an untrusted operation label into logs', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    logDatabaseError('write secret-value');

    expect(consoleError).toHaveBeenCalledWith('Database operation failed.');
  });
});
