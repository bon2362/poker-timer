export async function adminFetch(url: string, method: string, body?: unknown) {
  let response: Response;
  try { response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch { throw new Error('Не удалось соединиться с сервером. Проверьте соединение и повторите попытку.'); }
  if (response.status === 401) throw new Error('Вход истёк. Откройте /admin/login, войдите и повторите действие.');
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? 'Не удалось сохранить изменения. Попробуйте ещё раз.');
  return data;
}
