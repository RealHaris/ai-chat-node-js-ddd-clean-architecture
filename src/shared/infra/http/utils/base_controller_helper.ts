import { isArray } from '~/shared/common/utils/validation';

export function removeNulls(obj: any): any {
  if (obj === null) {
    return undefined;
  }

  if (isArray(obj)) {
    return obj.map(removeNulls);
  }

  if (typeof obj === 'object' && obj !== null) {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] === null) {
        cleaned[key] = undefined;
      } else if (isArray(obj[key])) {
        cleaned[key] = obj[key].map(removeNulls);
      } else if (typeof obj[key] === 'object') {
        cleaned[key] = removeNulls(obj[key]);
      } else {
        cleaned[key] = obj[key];
      }
    }
    return cleaned;
  }

  return obj;
}
