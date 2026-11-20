import { expect, test } from 'vitest';
import { withTimeout } from './timeout';

test('withTimeout: süre aşılırsa reddeder', async () => {
  await expect(withTimeout(new Promise(() => {}), 20)).rejects.toThrow('zaman aşımı');
});
test('withTimeout: zamanında biterse değeri döner', async () => {
  await expect(withTimeout(Promise.resolve(5), 1000)).resolves.toBe(5);
});
