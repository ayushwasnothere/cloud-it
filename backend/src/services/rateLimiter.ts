const rateMap = new Map<string, { count: number; reset: number }>();

const WINDOW = 60_000; // 1 minute
const LIMIT = 50;      // 50 requests per minute

export function checkRateLimit(userId: string) {
  const now = Date.now();
  const record = rateMap.get(userId);

  if (!record) {
    rateMap.set(userId, { count: 1, reset: now + WINDOW });
    return true;
  }

  if (now > record.reset) {
    rateMap.set(userId, { count: 1, reset: now + WINDOW });
    return true;
  }

  if (record.count >= LIMIT) {
    return false;
  }

  record.count++;
  return true;
}
export function resetRateLimit(userId: string) {
  rateMap.delete(userId);
}