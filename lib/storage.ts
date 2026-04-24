import type { Config } from '@/types/timer';

export const DEFAULT_CONFIG: Config = {
  levelDuration: 20,
  breakDuration: 10,
  breakEvery: 2,
  showCombos: true,
  showPlayers: true,
  slideshowEnabled: false,
  slideshowSpeed: 5,
  breakSongEnabled: false,
  blindLevels: [
    { sb: 10,  bb: 20   },
    { sb: 20,  bb: 40   },
    { sb: 30,  bb: 60   },
    { sb: 40,  bb: 80   },
    { sb: 60,  bb: 120  },
    { sb: 80,  bb: 160  },
    { sb: 100, bb: 200  },
    { sb: 150, bb: 300  },
    { sb: 200, bb: 400  },
    { sb: 300, bb: 600  },
    { sb: 400, bb: 800  },
    { sb: 600, bb: 1200 },
    { sb: 800, bb: 1600 },
    { sb: 1000, bb: 2000 },
  ],
};

export function loadConfig(): Config {
  try {
    const saved = localStorage.getItem('pokerTimerConfig');
    if (!saved) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    // Merge with defaults so newly added fields always have values
    return { ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)), ...(JSON.parse(saved) as Partial<Config>) };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

export function saveConfig(config: Config): void {
  localStorage.setItem('pokerTimerConfig', JSON.stringify(config));
}
