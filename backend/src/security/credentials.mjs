import { createHash, timingSafeEqual } from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest();
export function matches(value, expected) {
  return typeof value === 'string' && timingSafeEqual(hash(value), hash(expected));
}
