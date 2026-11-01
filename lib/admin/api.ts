import { NextResponse } from 'next/server';
export const apiError = (error: string, status = 500) => NextResponse.json({ error }, { status });
export function validUploadPath(path: unknown): path is string {
  return typeof path === 'string' && /^(uploads|special)\/[a-zA-Z0-9/_.-]+\.jpg$/.test(path) && !path.includes('..');
}
export function rpcError(error: { code?: string } | null) {
  return apiError('Не удалось сохранить изменения. Проверьте места, ребаи и состав игры.', ['22023', '22P02', 'P0002'].includes(error?.code ?? '') ? 400 : 500);
}
