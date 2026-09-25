/**
 * For tests about which reads run together. Wraps a repository so calls to
 * the named methods are recorded as they start, then held until `release()`.
 * Anything recorded before release started without waiting for the others:
 * one wave of requests rather than several in a row.
 */
export function holdCalls() {
  const started: string[] = [];
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  function wrap<T extends object>(target: T, methods: (keyof T & string)[]): T {
    return new Proxy(target, {
      get(object, property, receiver) {
        const value = Reflect.get(object, property, receiver);
        if (typeof value !== "function" || !methods.includes(property as keyof T & string)) {
          return value;
        }
        return async (...args: unknown[]) => {
          started.push(String(property));
          await released;
          return value.apply(object, args);
        };
      },
    });
  }

  return {
    wrap,
    started,
    release,
    /** Lets every call that doesn't depend on a held one get as far as starting. */
    settle: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}
