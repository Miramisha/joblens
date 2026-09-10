import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    payload: text('payload').notNull(),
    revision: integer('revision').notNull().default(1),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_jobs_owner_updated').on(table.ownerId, table.updatedAt),
  ],
);

export const accounts = sqliteTable('accounts', {
  ownerId: text('owner_id').primaryKey(),
  displayName: text('display_name').notNull(),
  hhAttempt: text('hh_attempt'),
  createdAt: text('created_at').notNull(),
});
export const hhConnections = sqliteTable('hh_connections', {
  ownerId: text('owner_id').primaryKey(),
  hhUserId: text('hh_user_id').notNull().unique(),
  displayName: text('display_name').notNull(),
  encryptedTokens: text('encrypted_tokens').notNull(),
  expiresAt: integer('expires_at').notNull(),
  connectedAt: text('connected_at').notNull(),
});
export const hhOauthStates = sqliteTable('hh_oauth_states', {
  ownerId: text('owner_id').primaryKey(),
  stateHash: text('state_hash').notNull().unique(),
  encryptedVerifier: text('encrypted_verifier').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
