import {createHmac, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import {createClient} from 'redis';

const LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;

const SCRIPT = `
local time = redis.call('TIME')
local now = time[1] * 1000 + math.floor(time[2] / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - ${WINDOW_MS})
local count = redis.call('ZCARD', KEYS[1])
if count >= ${LIMIT} then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, oldest[2] + ${WINDOW_MS} - now}
end
redis.call('ZADD', KEYS[1], now, ARGV[1])
redis.call('PEXPIRE', KEYS[1], ${WINDOW_MS})
return {1, 0}
`;

export const BROWSER_COOKIE = '__Host-a2ui-browser';

export function browserIdentity(cookieHeader: string | undefined, secret: string) {
  const sign = (id: string) => createHmac('sha256', secret).update(`browser:${id}`).digest();
  const cookies = (cookieHeader ?? '').split(';').map((part) => part.trim())
    .filter((part) => part.startsWith(`${BROWSER_COOKIE}=`));
  if (cookies.length === 1) {
    const token = cookies[0].slice(BROWSER_COOKIE.length + 1);
    const match = /^([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(token);
    if (match && timingSafeEqual(sign(match[1]), Buffer.from(match[2], 'hex'))) {
      return {id: match[1], token, established: true};
    }
  }
  const id = randomBytes(32).toString('hex');
  return {id, token: `${id}.${sign(id).toString('hex')}`, established: false};
}

export function createQuota(url: string, secret: string) {
  const client = createClient({url, disableOfflineQueue: true, socket: {connectTimeout: 5000}});
  client.on('error', () => console.error('[quota] Redis connection error'));
  void client.connect().catch(() => console.error('[quota] Redis connection failed'));
  return {
    get ready() {
      return client.isReady;
    },
    async consume(browserId: string): Promise<{allowed: boolean; retryAfter: number}> {
      const identity = createHmac('sha256', secret).update(`quota-browser:${browserId}`).digest('hex');
      const result = await client.eval(SCRIPT, {
        keys: [`a2ui:ask-quota:${identity}`],
        arguments: [randomUUID()],
      }) as number[];
      return {allowed: result[0] === 1, retryAfter: Math.ceil(result[1] / 1000)};
    },
    async close() {
      if (client.isOpen) await client.close();
    },
  };
}
