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
