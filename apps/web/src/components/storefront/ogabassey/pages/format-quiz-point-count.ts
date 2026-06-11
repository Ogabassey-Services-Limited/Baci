export function formatQuizPointCount(points: number): string {
  return `${points} loyalty ${points === 1 ? 'point' : 'points'}`;
}
