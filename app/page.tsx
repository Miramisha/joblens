import { getDb } from '@/db';
import Workspace from './workspace';
import { getUser } from './auth';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getUser();
  const profile = user
    ? await getDb()
        .prepare('SELECT skills FROM accounts WHERE owner_id=?')
        .bind(user.userId)
        .first<{ skills: string }>()
    : null;
  return <Workspace signedIn={!!user} initialSkills={profile?.skills ?? ''} />;
}
