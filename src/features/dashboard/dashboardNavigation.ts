export function dashboardSetHref(setCode: string, cardId?: string): string {
  const params = new URLSearchParams({ set: setCode });
  if (cardId) params.set('card', cardId);
  return `#sets?${params.toString()}`;
}
