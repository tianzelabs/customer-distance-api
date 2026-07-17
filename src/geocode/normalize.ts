export function normalizeTownName(input: string): string {
  const collapsedWhitespace = input.trim().replace(/\s+/g, ' ');
  const lower = collapsedWhitespace.toLowerCase();
  const withoutDiacritics = lower.normalize('NFD').replace(/[̀-ͯ]/g, '');

  if (withoutDiacritics.startsWith('budapest')) {
    return 'budapest';
  }

  return withoutDiacritics;
}
