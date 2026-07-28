export interface AnswerCheckInput {
  expected: string;
  actual: string;
  caseSensitive?: boolean;
}

export function normalizeAnswer(value: string, caseSensitive: boolean): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

export function isAnswerCorrect(input: AnswerCheckInput): boolean {
  const caseSensitive = input.caseSensitive ?? false;
  return (
    normalizeAnswer(input.expected, caseSensitive) === normalizeAnswer(input.actual, caseSensitive)
  );
}
