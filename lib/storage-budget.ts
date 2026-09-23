export const STORAGE_LIMIT_MESSAGE =
  'Превышен объём хранилища: до 4 МБ на доску и 1 МБ на карточку с историей. Скачайте копию данных и освободите место. Изменения не сохранены.';
export function storageLimit(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('joblens_storage_limit') ||
    (error.cause !== error && storageLimit(error.cause))
  );
}
