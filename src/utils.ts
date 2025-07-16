export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function buildQueryParams(params: any): Record<string, any> {
  const cleanParams: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      cleanParams[key] = value;
    }
  }
  
  return cleanParams;
}

export function expandFields(fields: string | string[]): string {
  if (Array.isArray(fields)) {
    return fields.join(',');
  }
  return fields;
}