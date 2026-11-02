import type { MetadataRoute } from 'next';

// Search engines are kept off the whole site. Link preview bots stay allowed so shared links still show a card.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: ['TelegramBot', 'Twitterbot', 'facebookexternalhit', 'WhatsApp', 'vkShare', 'Slackbot'], allow: '/' },
      { userAgent: '*', disallow: '/' },
    ],
  };
}
