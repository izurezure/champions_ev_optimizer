export function ratingStateForFormat({ formats, formatId, currentRating }) {
  const format = findUiFormat(formats, formatId);
  const ratings = [...format.ratings];
  const current = String(currentRating ?? '');
  const selectedRating = ratings.includes(current)
    ? current
    : ratings.includes('1500')
      ? '1500'
      : ratings[0] ?? '';
  return { ratings, selectedRating };
}

export function formatLabelForId(formats, formatId) {
  return findUiFormat(formats, formatId).label;
}

function findUiFormat(formats, formatId) {
  const format = formats.find((entry) => entry.id === formatId);
  if (!format) throw new Error(`Unknown format "${formatId}"`);
  return format;
}
