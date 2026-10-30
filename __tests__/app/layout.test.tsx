import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('../../app/globals.css', () => ({}));

import RootLayout from '@/app/layout';

describe('RootLayout', () => {
  test('preloads the blind-300 video for a seamless warning start', () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main>Timer</main>
      </RootLayout>
    );

    expect(markup).toContain(
      '<link rel="preload" as="video" href="/video/blind-300.mp4" type="video/mp4"/>'
    );
  });
});
