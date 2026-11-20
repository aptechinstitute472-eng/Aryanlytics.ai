export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export function computeLineDiff(beforeText: string, afterText: string): DiffLine[] {
  const oldLines = beforeText.replace(/\r\n/g, '\n').split('\n');
  const newLines = afterText.replace(/\r\n/g, '\n').split('\n');

  const m = oldLines.length;
  const n = newLines.length;

  // Guard against overly huge inputs by falling back to clean block diff
  if (m * n > 250000) {
    return [
      ...oldLines.map((text, idx) => ({
        type: 'removed' as const,
        text,
        oldLineNumber: idx + 1,
        newLineNumber: null,
      })),
      ...newLines.map((text, idx) => ({
        type: 'added' as const,
        text,
        oldLineNumber: null,
        newLineNumber: idx + 1,
      })),
    ];
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNum = 1;
  let newNum = 1;

  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      result.push({
        type: 'unchanged',
        text: oldLines[i],
        oldLineNumber: oldNum++,
        newLineNumber: newNum++,
      });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({
        type: 'removed',
        text: oldLines[i],
        oldLineNumber: oldNum++,
        newLineNumber: null,
      });
      i++;
    } else {
      result.push({
        type: 'added',
        text: newLines[j],
        oldLineNumber: null,
        newLineNumber: newNum++,
      });
      j++;
    }
  }

  while (i < m) {
    result.push({
      type: 'removed',
      text: oldLines[i],
      oldLineNumber: oldNum++,
      newLineNumber: null,
    });
    i++;
  }

  while (j < n) {
    result.push({
      type: 'added',
      text: newLines[j],
      oldLineNumber: null,
      newLineNumber: newNum++,
    });
    j++;
  }

  return result;
}
