/**
 * Dottie — Gems Economy Engine 💎
 *
 * Gems are the VIRTUAL CURRENCY of Dottie — earned through engagement,
 * spent on cosmetics and convenience items.
 *
 * DESIGN PHILOSOPHY:
 * - Gems are FUN money — never required for health features
 * - Everything purchasable with gems is cosmetic or convenience
 * - Users CAN earn ALL gems through free daily play (just slower)
 * - No "energy gates" or "wait timers" — this is NOT a mobile game
 * - Mirrors Duolingo's shop: fun to browse, zero pressure
 *
 * EARNING GEMS:
 * - Daily check-ins (small, consistent drip)
 * - Streak milestones (big celebration rewards)
 * - Quiz completions (knowledge = gems)
 * - Badge unlocks (achievement bonus)
 * - Monthly challenges (community goals)
 *
 * SPENDING GEMS:
 * - Cramp Freezes (50💎 each — streak protection)
 * - Companion outfits (75-200💎 — cosmetic)
 * - App theme packs (150-300💎 — visual customization)
 * - Avatar accessories (50-150💎 — self-expression)
 * - Badge frames (100💎 — status display)
 * - XP Boosters (80💎 — 2x XP for 24hrs)
 *
 * PURCHASE TIERS (Real money → Gems):
 * - 80 gems   → $0.99  (Starter)
 * - 200 gems  → $1.99  (Popular 🔥)
 * - 500 gems  → $4.99  (Best Value)
 * - 1200 gems → $9.99  (Mega Pack)
 */

import { GemTransaction, GemSource } from '../../types/gamification.types';

// ─── GEM EARN RATES ───────────────────────────────────────────────────

/** Gems earned per action */
export const GEM_EARN_RATES: Partial<Record<GemSource, number>> = {
  daily_checkin: 2,            // Small daily drip — adds up!
  quiz_complete: 10,           // Reward for learning
  badge_unlock: 15,            // Achievement celebration
  streak_milestone_7: 15,      // 7-day milestone
  streak_milestone_30: 50,     // 30-day milestone
  streak_milestone_100: 150,   // 100-day milestone — big celebration!
};

/** Bonus gems for special actions */
export const GEM_BONUSES = {
  /** Perfect quiz score (100%) — bonus on top of quiz_complete */
  perfectQuiz: 5,
  /** Completing all daily questions */
  allQuestionsAnswered: 3,
  /** First check-in after a Cramp Freeze (welcome back!) */
  returnFromFreeze: 5,
  /** Completing a full learning path */
  pathComplete: 50,
  /** Monthly challenge completion */
  challengeComplete: 30,
  /** Referring a friend (when they reach 7-day streak) */
  referralReward: 100,
};

// ─── GEM SPEND COSTS ──────────────────────────────────────────────────

/** Items available for gem purchase */
export const GEM_STORE_ITEMS: GemStoreItem[] = [
  // ── Streak Protection ──
  {
    id: 'cramp_freeze',
    name: 'Cramp Freeze',
    description: 'Protect your streak on a tough day 🧊',
    cost: 50,
    category: 'utility',
    emoji: '🧊',
    isConsumable: true,
  },
  {
    id: 'xp_booster_24h',
    name: 'XP Boost (24hrs)',
    description: 'Earn 2x XP for the next 24 hours ⚡',
    cost: 80,
    category: 'utility',
    emoji: '⚡',
    isConsumable: true,
  },

  // ── Companion Outfits ──
  {
    id: 'outfit_winter_scarf',
    name: 'Winter Scarf',
    description: 'A cozy scarf for your companion ☕',
    cost: 75,
    category: 'companion_outfit',
    emoji: '🧣',
    isConsumable: false,
  },
  {
    id: 'outfit_summer_hat',
    name: 'Beach Hat',
    description: 'Sunny day vibes for your companion 🏖️',
    cost: 75,
    category: 'companion_outfit',
    emoji: '👒',
    isConsumable: false,
  },
  {
    id: 'outfit_flower_crown',
    name: 'Flower Crown',
    description: 'A beautiful crown of wildflowers 🌸',
    cost: 100,
    category: 'companion_outfit',
    emoji: '💐',
    isConsumable: false,
  },
  {
    id: 'outfit_rainbow_cape',
    name: 'Rainbow Cape',
    description: 'Celebrate with colors! 🌈',
    cost: 120,
    category: 'companion_outfit',
    emoji: '🌈',
    isConsumable: false,
  },
  {
    id: 'outfit_cozy_blanket',
    name: 'Cozy Blanket',
    description: 'For those rest days — warm & snug 🧸',
    cost: 90,
    category: 'companion_outfit',
    emoji: '🧸',
    isConsumable: false,
  },
  {
    id: 'outfit_party_hat',
    name: 'Party Hat',
    description: 'Every day is a celebration! 🎉',
    cost: 80,
    category: 'companion_outfit',
    emoji: '🎉',
    isConsumable: false,
  },

  // ── App Themes ──
  {
    id: 'theme_sunset',
    name: 'Golden Sunset',
    description: 'Warm amber & gold tones throughout the app 🌅',
    cost: 200,
    category: 'theme',
    emoji: '🌅',
    isConsumable: false,
  },
  {
    id: 'theme_ocean',
    name: 'Ocean Breeze',
    description: 'Cool blues & teals — like a calm sea 🌊',
    cost: 200,
    category: 'theme',
    emoji: '🌊',
    isConsumable: false,
  },
  {
    id: 'theme_lavender',
    name: 'Lavender Dream',
    description: 'Soft purples & lilacs — soothing & dreamy 💜',
    cost: 200,
    category: 'theme',
    emoji: '💜',
    isConsumable: false,
  },
  {
    id: 'theme_forest',
    name: 'Enchanted Forest',
    description: 'Deep greens & earth tones — grounding 🌲',
    cost: 250,
    category: 'theme',
    emoji: '🌲',
    isConsumable: false,
  },
  {
    id: 'theme_cherry_blossom',
    name: 'Cherry Blossom',
    description: 'Delicate pinks — like spring in Japan 🌸',
    cost: 300,
    category: 'theme',
    emoji: '🌸',
    isConsumable: false,
  },

  // ── Avatar Accessories ──
  {
    id: 'avatar_sparkle_aura',
    name: 'Sparkle Aura',
    description: 'A shimmering glow around your avatar ✨',
    cost: 100,
    category: 'avatar',
    emoji: '✨',
    isConsumable: false,
  },
  {
    id: 'avatar_heart_frame',
    name: 'Heart Frame',
    description: 'A cute heart-shaped profile frame 💕',
    cost: 80,
    category: 'avatar',
    emoji: '💕',
    isConsumable: false,
  },
  {
    id: 'avatar_crown',
    name: 'Mini Crown',
    description: 'Feel like royalty every day 👑',
    cost: 150,
    category: 'avatar',
    emoji: '👑',
    isConsumable: false,
  },

  // ── Badge Frames ──
  {
    id: 'badge_frame_gold',
    name: 'Gold Frame',
    description: 'Make your badges shine brighter 🏅',
    cost: 100,
    category: 'badge_frame',
    emoji: '🏅',
    isConsumable: false,
  },
  {
    id: 'badge_frame_rainbow',
    name: 'Rainbow Frame',
    description: 'Colorful border for your achievements 🌈',
    cost: 120,
    category: 'badge_frame',
    emoji: '🌈',
    isConsumable: false,
  },
];

// ─── GEM PURCHASE TIERS (Real Money) ──────────────────────────────────

export const GEM_PURCHASE_TIERS: GemPurchaseTier[] = [
  {
    id: 'gems_starter',
    gems: 80,
    priceUSD: 0.99,
    label: 'Starter',
    isPopular: false,
    isBestValue: false,
  },
  {
    id: 'gems_popular',
    gems: 200,
    priceUSD: 1.99,
    label: 'Popular',
    isPopular: true,
    isBestValue: false,
  },
  {
    id: 'gems_value',
    gems: 500,
    priceUSD: 4.99,
    label: 'Best Value',
    isPopular: false,
    isBestValue: true,
  },
  {
    id: 'gems_mega',
    gems: 1200,
    priceUSD: 9.99,
    label: 'Mega Pack',
    isPopular: false,
    isBestValue: false,
  },
];

// ─── GEM FUNCTIONS ────────────────────────────────────────────────────

/**
 * Award gems for an action.
 *
 * @param source - What earned the gems
 * @param currentBalance - Current gem balance
 * @param bonusType - Optional bonus type for extra gems
 * @returns Transaction record + new balance
 */
export function earnGems(
  source: GemSource,
  currentBalance: number,
  bonusType?: keyof typeof GEM_BONUSES
): GemEarnResult {
  const baseAmount = GEM_EARN_RATES[source] ?? 0;
  const bonusAmount = bonusType ? GEM_BONUSES[bonusType] : 0;
  const totalEarned = baseAmount + bonusAmount;

  if (totalEarned === 0) {
    return {
      success: false,
      transaction: null,
      newBalance: currentBalance,
      amountEarned: 0,
      message: 'No gems earned for this action',
    };
  }

  const newBalance = currentBalance + totalEarned;
  const transaction: GemTransaction = {
    amount: totalEarned,
    source,
    timestamp: new Date().toISOString(),
    description: getEarnDescription(source, totalEarned, bonusType),
  };

  return {
    success: true,
    transaction,
    newBalance,
    amountEarned: totalEarned,
    message: `+${totalEarned}💎 ${getEarnMessage(source)}`,
  };
}

/**
 * Spend gems on a store item.
 *
 * @param itemId - Store item to purchase
 * @param currentBalance - Current gem balance
 * @param ownedItems - Items already owned (prevents double-buy of non-consumables)
 * @returns Purchase result + new balance
 */
export function spendGems(
  itemId: string,
  currentBalance: number,
  ownedItems: string[] = []
): GemSpendResult {
  const item = GEM_STORE_ITEMS.find(i => i.id === itemId);

  if (!item) {
    return {
      success: false,
      transaction: null,
      newBalance: currentBalance,
      message: "Hmm, couldn't find that item 🤔",
      item: null,
    };
  }

  // Check if already owned (non-consumable items)
  if (!item.isConsumable && ownedItems.includes(itemId)) {
    return {
      success: false,
      transaction: null,
      newBalance: currentBalance,
      message: `You already own ${item.emoji} ${item.name}!`,
      item,
    };
  }

  // Check balance
  if (currentBalance < item.cost) {
    const deficit = item.cost - currentBalance;
    return {
      success: false,
      transaction: null,
      newBalance: currentBalance,
      message: `Need ${deficit} more gems for ${item.emoji} ${item.name}. Keep logging! 💪`,
      item,
    };
  }

  // Process purchase!
  const newBalance = currentBalance - item.cost;
  const spendSource = getSpendSource(item.category);
  const transaction: GemTransaction = {
    amount: -item.cost,
    source: spendSource,
    timestamp: new Date().toISOString(),
    description: `Purchased: ${item.name}`,
  };

  return {
    success: true,
    transaction,
    newBalance,
    message: `${item.emoji} ${item.name} is yours! 🎉`,
    item,
  };
}

/**
 * Process a real-money gem purchase (IAP).
 *
 * @param tierId - Purchase tier ID
 * @param currentBalance - Current gem balance
 * @returns New balance after purchase
 */
export function processGemPurchase(
  tierId: string,
  currentBalance: number
): GemPurchaseResult {
  const tier = GEM_PURCHASE_TIERS.find(t => t.id === tierId);

  if (!tier) {
    return {
      success: false,
      newBalance: currentBalance,
      gemsAdded: 0,
      message: 'Purchase tier not found',
    };
  }

  const newBalance = currentBalance + tier.gems;
  return {
    success: true,
    newBalance,
    gemsAdded: tier.gems,
    message: `+${tier.gems}💎 added to your balance! ✨`,
  };
}

/**
 * Get store items filtered by category.
 */
export function getStoreByCategory(category: GemStoreCategory): GemStoreItem[] {
  return GEM_STORE_ITEMS.filter(item => item.category === category);
}

/**
 * Get items user can afford right now.
 */
export function getAffordableItems(currentBalance: number): GemStoreItem[] {
  return GEM_STORE_ITEMS.filter(item => item.cost <= currentBalance);
}

/**
 * Calculate total gems earned in a date range.
 */
export function getGemsEarnedInRange(
  transactions: GemTransaction[],
  startDate: string,
  endDate: string
): number {
  return transactions
    .filter(t => t.amount > 0)
    .filter(t => t.timestamp >= startDate && t.timestamp <= endDate)
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Calculate total gems spent in a date range.
 */
export function getGemsSpentInRange(
  transactions: GemTransaction[],
  startDate: string,
  endDate: string
): number {
  return transactions
    .filter(t => t.amount < 0)
    .filter(t => t.timestamp >= startDate && t.timestamp <= endDate)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

/**
 * Get gem transaction history (most recent first).
 */
export function getTransactionHistory(
  transactions: GemTransaction[],
  limit: number = 20
): GemTransaction[] {
  return [...transactions]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

/**
 * Check if user has enough gems for an item.
 */
export function canAfford(currentBalance: number, itemId: string): boolean {
  const item = GEM_STORE_ITEMS.find(i => i.id === itemId);
  return item ? currentBalance >= item.cost : false;
}

/**
 * Get a "next reward" teaser message for motivation.
 * e.g., "3 more check-ins until you can afford a Cramp Freeze!"
 */
export function getNextRewardTeaser(currentBalance: number): string | null {
  // Find cheapest item user can't yet afford
  const sortedItems = [...GEM_STORE_ITEMS].sort((a, b) => a.cost - b.cost);
  const nextItem = sortedItems.find(item => item.cost > currentBalance);

  if (!nextItem) return null; // Can afford everything!

  const deficit = nextItem.cost - currentBalance;
  const checkInsNeeded = Math.ceil(deficit / (GEM_EARN_RATES.daily_checkin ?? 2));

  if (checkInsNeeded <= 5) {
    return `${checkInsNeeded} more check-in${checkInsNeeded > 1 ? 's' : ''} until you can get ${nextItem.emoji} ${nextItem.name}!`;
  }

  return null; // Too far away to tease
}

// ─── HELPER TYPES ────────────────────────────────────────────────────

export type GemStoreCategory =
  | 'utility'
  | 'companion_outfit'
  | 'theme'
  | 'avatar'
  | 'badge_frame';

export interface GemStoreItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: GemStoreCategory;
  emoji: string;
  isConsumable: boolean; // true = can buy multiple times (e.g., Cramp Freeze)
}

export interface GemPurchaseTier {
  id: string;
  gems: number;
  priceUSD: number;
  label: string;
  isPopular: boolean;
  isBestValue: boolean;
}

export interface GemEarnResult {
  success: boolean;
  transaction: GemTransaction | null;
  newBalance: number;
  amountEarned: number;
  message: string;
}

export interface GemSpendResult {
  success: boolean;
  transaction: GemTransaction | null;
  newBalance: number;
  message: string;
  item: GemStoreItem | null;
}

export interface GemPurchaseResult {
  success: boolean;
  newBalance: number;
  gemsAdded: number;
  message: string;
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────

function getEarnDescription(
  source: GemSource,
  amount: number,
  bonusType?: keyof typeof GEM_BONUSES
): string {
  const base = `Earned ${amount}💎 from ${formatSource(source)}`;
  if (bonusType) return `${base} (+ ${bonusType} bonus)`;
  return base;
}

function getEarnMessage(source: GemSource): string {
  switch (source) {
    case 'daily_checkin':
      return 'for showing up today! 🌸';
    case 'quiz_complete':
      return 'for crushing that quiz! 📚';
    case 'badge_unlock':
      return 'badge bonus! 🏅';
    case 'streak_milestone_7':
      return '7-day streak reward! 🔥';
    case 'streak_milestone_30':
      return '30-day streak celebration! 🎉';
    case 'streak_milestone_100':
      return '100 DAYS! You are legendary! 👑';
    default:
      return 'earned! ✨';
  }
}

function formatSource(source: GemSource): string {
  return source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getSpendSource(category: GemStoreCategory): GemSource {
  switch (category) {
    case 'utility':
      return 'spend_cramp_freeze';
    case 'companion_outfit':
      return 'spend_outfit';
    case 'theme':
      return 'spend_theme';
    case 'avatar':
      return 'spend_outfit'; // Reuse — avatar accessories are like outfits
    case 'badge_frame':
      return 'spend_theme'; // Reuse — frames are visual customization
    default:
      return 'spend_theme';
  }
}
