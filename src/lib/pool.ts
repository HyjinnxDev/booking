/**
 * Run `fn` over `items` with at most `n` promises in flight. §5: bulk email
 * (class cancellations, waitlist blasts, reminders) was sequential and could
 * blow the Vercel function timeout. Resend's batch API doesn't take attachments,
 * so we keep per-message sends but stop waiting on them one at a time.
 * A task's rejection is logged, not propagated — callers stay best-effort.
 */
export async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<unknown>): Promise<void> {
  const q = items.slice();
  const run = async () => {
    while (q.length) {
      const item = q.shift() as T;
      try {
        await fn(item);
      } catch (e) {
        console.error('pool task failed', e);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, q.length)) }, run));
}
