/** Run the built Worker without development reloads interrupting POST requests. */
import { unstable_startWorker } from 'wrangler';
const vars = JSON.parse(process.env.JOBLENS_TEST_VARS);
const worker = await unstable_startWorker({
  config: 'dist/server/wrangler.json',
  envFiles: [],
  sendMetrics: false,
  bindings: Object.fromEntries(Object.entries(vars).map(([key, value]) => [key, { type: 'plain_text', value }])),
  dev: {
    remote: false,
    watch: false,
    liveReload: false,
    inspector: false,
    persist: process.env.JOBLENS_TEST_STATE,
    server: { hostname: '127.0.0.1', port: 3001 },
  },
});
await worker.ready;
console.log('Test Worker ready without source watching.');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await worker.dispose();
  process.exit(0);
}
process.on('SIGTERM', () => { void stop(); });
process.on('SIGINT', () => { void stop(); });
