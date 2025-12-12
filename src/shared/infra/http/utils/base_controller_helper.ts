import { isArray } from '~/shared/common/utils/validation';

export function removeNulls(obj: unknown): unknown {
  if (obj === null) {
    return undefined;
  }

  if (isArray(obj)) {
    return (obj as unknown[]).map(removeNulls);
  }

  if (typeof obj === 'object' && obj !== null) {
    const cleaned: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      const value = (obj as Record<string, unknown>)[key];
      if (value === null) {
        cleaned[key] = undefined;
      } else if (isArray(value)) {
        cleaned[key] = (value as unknown[]).map(removeNulls);
      } else if (typeof value === 'object') {
        cleaned[key] = removeNulls(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  return obj;
}
