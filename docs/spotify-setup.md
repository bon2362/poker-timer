# Как подключить Spotify к таймеру

Делается один раз. Нужен аккаунт Spotify Premium.

1. Откройте https://developer.spotify.com/dashboard и войдите своим аккаунтом Spotify. Если попросят, примите условия для разработчиков.
2. Нажмите **Create app** и заполните:
   - **App name:** Poker Timer
   - **App description:** любой текст, например «Музыка для покерного таймера»
   - **Redirect URIs:** добавьте по одному оба адреса:
     - `https://bsptimer.online/spotify/callback`
     - `http://127.0.0.1:3000/spotify/callback`
   - В пункте «Which API/SDKs are you planning to use?» отметьте **Web API** и **Web Playback SDK**.
   - Поставьте галочку согласия и нажмите **Save**.
3. В приложении откройте **Settings → User Management** и добавьте email своего аккаунта Spotify. Если в Spotify на таймере будет входить кто-то ещё, добавьте и их (до 25 человек).
4. На странице **Settings → Basic Information** скопируйте **Client ID**. Он не секретный.
5. Добавьте Client ID на Vercel: Project → Settings → Environment Variables:
   - **Key:** `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`
   - **Value:** скопированный Client ID
   - **Environments:** Production и Preview

   Плеер появится на сайте после следующего деплоя.
6. Для проверки на своём компьютере добавьте ту же строку в файл `.env.local`:
   `NEXT_PUBLIC_SPOTIFY_CLIENT_ID=<Client ID>`

   Открывайте локальный сайт по адресу `http://127.0.0.1:3000`, а не `localhost`: Spotify не принимает `localhost`.

## Как пользоваться

- На большом экране таймера (войдя в управление) пошевелите мышью. Внизу слева появится «♫ Подключить Spotify». Войдите в Spotify и разрешите доступ.
- 🔍 — поиск плейлистов по всему Spotify. Последний плейлист запоминается.
- Каждый компьютер подключается отдельно и помнит свой вход.
- Во время песни перерыва, «момента с трактором», финального слайдшоу и фанфар победителя Spotify сам встаёт на паузу и потом продолжает.
