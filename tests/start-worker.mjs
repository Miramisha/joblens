/** Fixed built Worker runtime: no development proxy, registry, or hot reload. */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
// Use the exact simulator shipped with our pinned Wrangler installation.
const require = createRequire(import.meta.url);
const { Miniflare } = createRequire(require.resolve('wrangler'))('miniflare');
const configPath = resolve('dist/server/wrangler.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const root = dirname(configPath);
const worker = new Miniflare({
  host: '127.0.0.1',
  port: 3001,
  cf: false,
  modules: [config.main, ...readdirSync(root, { recursive: true }).filter(path => /\.m?js$/.test(path) && path !== config.main)].map(path => ({ type: 'ESModule', path: resolve(root, path) })),
  modulesRoot: root,
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  bindings: JSON.parse(process.env.JOBLENS_TEST_VARS),
  d1Databases: Object.fromEntries(config.d1_databases.map(db => [db.binding, db.database_id])),
  d1Persist: join(process.env.JOBLENS_TEST_STATE, 'v3/d1'),
  assets: { directory: resolve(root, config.assets.directory), binding: 'ASSETS', routerConfig: { has_user_worker: true } },
});
await worker.ready;
console.log('Fixed test Worker ready.');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await worker.dispose();
  process.exit(0);
}
process.on('SIGTERM', () => { void stop(); });
process.on('SIGINT', () => { void stop(); });
