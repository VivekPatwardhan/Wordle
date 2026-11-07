export interface Achievement {
  key: string;
  category: string;
  icon: string;
  title: string;
  description: string;
  threshold: number;
}

export interface AchievementProgress extends Achievement {
  /** How far the player has got, capped at the threshold. */
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface AchievementsOverview {
  unlockedCount: number;
  totalCount: number;
  categories: { id: string; title: string; achievements: AchievementProgress[] }[];
}

/** Pushed live when a finished game or duel unlocks something. */
export interface AchievementUnlockedEvent {
  achievements: Achievement[];
}
