/** RN-web 0.21 emits onScroll, including a final idle event, but does not
 * synthesize native momentum-end. This event-triggered debounce commits only
 * the latest offset after scrolling pauses. It never advances by itself. */
export function createScrollSettlement(commit: (offset: number, requested: boolean) => void, delayMs = 140) {
  let latestOffset = 0;
  let requestedOffset: number | undefined;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (pending !== undefined) clearTimeout(pending);
    pending = undefined;
    requestedOffset = undefined;
  };
  return {
    /** Rapid buttons are intents, not observations of an intermediate scroll.
     * Keep the latest destination until scroll idle; a user gesture cancels it. */
    request(offset: number) {
      cancel();
      requestedOffset = offset;
    },
    update(offset: number) {
      latestOffset = offset;
      if (pending !== undefined) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = undefined;
        const requested = requestedOffset !== undefined;
        const settledOffset = requestedOffset ?? latestOffset;
        requestedOffset = undefined;
        commit(settledOffset, requested);
      }, delayMs);
    },
    cancel,
  };
}
