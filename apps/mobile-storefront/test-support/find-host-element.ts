export type TestTreeInstance = {
  type: unknown;
  props?: Record<string, unknown>;
  children?: Array<string | TestTreeInstance>;
};

export type HostTestInstance = TestTreeInstance & {
  type: string;
};

function isTestTreeInstance(instance: unknown): instance is TestTreeInstance {
  return (
    typeof instance === 'object' &&
    instance !== null &&
    'type' in instance
  );
}

export function findHostElement(instance: unknown): HostTestInstance | null {
  if (!isTestTreeInstance(instance)) {
    return null;
  }

  if (typeof instance.type === 'string') {
    return instance as HostTestInstance;
  }

  for (const child of instance.children || []) {
    if (typeof child !== 'string') {
      const found = findHostElement(child);
      if (found) {
        return found;
      }
    }
  }

  return null;
}
