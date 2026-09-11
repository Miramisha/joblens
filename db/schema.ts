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

export const emailIdentities = sqliteTable('email_identities', {
  email: text('email').primaryKey(),
  ownerId: text('owner_id').notNull().unique(),
  verifiedAt: integer('verified_at').notNull(),
});
export const authSessions = sqliteTable(
  'auth_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    ownerId: text('owner_id').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('idx_auth_sessions_expiry').on(t.expiresAt)],
);
export const emailChallenges = sqliteTable('email_challenges', {
  email: text('email').primaryKey(),
  challengeHash: text('challenge_hash').notNull().unique(),
  codeHash: text('code_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  sentAt: integer('sent_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  consumed: integer('consumed').notNull().default(0),
});
export const authLimits = sqliteTable('auth_limits', {
  bucket: text('bucket').primaryKey(),
  count: integer('count').notNull(),
  resetsAt: integer('resets_at').notNull(),
});
