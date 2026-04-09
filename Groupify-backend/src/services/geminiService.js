const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/env');
const logger = require('../utils/logger');

// ---------- In-memory LRU Cache ----------

class LRUCache {
  constructor(maxSize = 500, ttlMs = 24 * 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    this.cache.delete(key);
    if (this.cache.size >= this.maxSize) {
      // Evict oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, createdAt: Date.now() });
  }
}

// ---------- Rate Limiter ----------

class RateLimiter {
  constructor(perMinute = 5, perDay = 20) {
    this.perMinute = perMinute;
    this.perDay = perDay;
    this.minuteCount = 0;
    this.dayCount = 0;
    this.lastMinuteReset = Date.now();
    this.lastDayReset = Date.now();
  }

  tryAcquire() {
    const now = Date.now();

    // Reset minute counter
    if (now - this.lastMinuteReset >= 60_000) {
      this.minuteCount = 0;
      this.lastMinuteReset = now;
    }

    // Reset day counter
    if (now - this.lastDayReset >= 86_400_000) {
      this.dayCount = 0;
      this.lastDayReset = now;
    }

    if (this.minuteCount >= this.perMinute || this.dayCount >= this.perDay) {
      return false;
    }

    this.minuteCount++;
    this.dayCount++;
    return true;
  }
}

// ---------- Gemini Service ----------

const cache = new LRUCache();
const rateLimiter = new RateLimiter();

let genAI = null;
let model = null;

function getModel() {
  if (!config.gemini.apiKey) return null;
  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }
  return model;
}

/**
 * Format milliseconds into a human-readable string
 */
function formatMs(ms) {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}min`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}hr`;
  return `${(ms / 86_400_000).toFixed(1)} days`;
}

/**
 * Generate personalized Listener Reflex descriptions using Gemini AI.
 * Batches all members into a single prompt.
 *
 * @param {Object} reflexData - Output from AnalyticsService.computeListenerReflex()
 * @returns {Object|null} Map of userId -> personalized description, or null if unavailable
 */
async function generateReflexInsights(reflexData) {
  const geminiModel = getModel();
  if (!geminiModel) return null;

  const { users, summary, range, mode } = reflexData;
  if (!users || users.length === 0) return null;

  // Build cache key from the data that affects output
  const userKey = users.map(u => `${u.userId}:${u.medianMs}:${u.listens}:${u.category}`).join('|');
  const cacheKey = `reflex:${reflexData.groupId}:${range}:${mode}:${userKey}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Check rate limit
  if (!rateLimiter.tryAcquire()) {
    logger.warn('Gemini rate limit reached, returning null for AI insights');
    return null;
  }

  // Build the prompt
  const groupAvgListens = users.length > 0
    ? Math.round(users.reduce((sum, u) => sum + u.listens, 0) / users.length)
    : 0;

  const modeContext = mode === 'received'
    ? 'how fast each member listens to songs shared in their group'
    : 'how fast others react to songs each member shares';

  const membersBlock = users.map((u, i) => {
    return `${i + 1}. ${u.displayName} — Category: "${u.category}"
   Median reaction time: ${formatMs(u.medianMs)}
   Total listens: ${u.listens} (group avg: ${groupAvgListens})`;
  }).join('\n\n');

  const prompt = `You are a music personality writer for a group music-sharing app called Groupify.
Write a short, personal 1-2 sentence description for each group member's listening style.

Context: This measures ${modeContext}.
Time range: last ${range}
Group has ${users.length} members with a group median reaction time of ${formatMs(summary.groupMedianMs)}.

Rules:
- Reference their actual numbers (reaction time, listen count) naturally — don't just restate them, weave them into a personality observation
- Playful & warm tone, like a friend commenting on their habits
- Use second person ("you")
- Max 30 words per description
- Each description should feel unique — avoid repeating phrases across members
- Return ONLY valid JSON, no markdown, no code fences

Members:
${membersBlock}

Return as JSON object mapping user position (1, 2, etc.) to their description:
{"1": "description for first member", "2": "description for second member"}`;

  try {
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON — strip markdown fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);

    // Map positional keys back to userIds
    const insights = {};
    users.forEach((u, i) => {
      const key = String(i + 1);
      if (parsed[key]) {
        insights[u.userId] = parsed[key];
      }
    });

    // Cache the result
    if (Object.keys(insights).length > 0) {
      cache.set(cacheKey, insights);
    }

    return insights;
  } catch (err) {
    logger.error('Gemini AI generation failed:', { message: err.message, stack: err.stack, status: err.status, details: err.errorDetails });
    return null;
  }
}

module.exports = {
  generateReflexInsights,
};
