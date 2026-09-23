import { parseBackup, BACKUP_LIMIT } from './account-backup.ts';
export type ReadSequence = { current: number };
/** Superseded reads (including errors) never replace the current selection. */
export async function readBackupFile(
  file: Pick<File, 'size' | 'text'> | undefined,
  email: string,
  sequence: ReadSequence,
) {
  const version = ++sequence.current;
  if (!file) return { status: 'empty' } as const;
  try {
    if (file.size > BACKUP_LIMIT) throw Error('Файл больше 5 МБ.');
    const text = await file.text();
    if (version !== sequence.current) return { status: 'stale' } as const;
    const backup = parseBackup(JSON.parse(text), email);
    return { status: 'ready', text, count: backup.jobs.length } as const;
  } catch (error) {
    if (version !== sequence.current) return { status: 'stale' } as const;
    return {
      status: 'error',
      error:
        error instanceof Error ? error.message : 'Не удалось прочитать файл.',
    } as const;
  }
}
