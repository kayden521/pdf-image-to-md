export function getAllPageNumbers(totalPages: number): number[] {
  return Array.from({ length: totalPages }, (_, index) => index + 1);
}

export function parsePageRanges(input: string, totalPages: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("请输入页码范围，例如 1-10, 20-30");
  }

  const selectedPages = new Set<number>();
  const parts = trimmed.split(/[,，、\s]+/).filter(Boolean);

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = part.match(/^(\d+)$/);

    if (rangeMatch) {
      const start = Number.parseInt(rangeMatch[1], 10);
      const end = Number.parseInt(rangeMatch[2], 10);

      if (start > end) {
        throw new Error(`页码范围无效：${part}（起始页不能大于结束页）`);
      }
      if (start < 1 || end > totalPages) {
        throw new Error(`页码超出范围：${part}（PDF 共 ${totalPages} 页）`);
      }

      for (let page = start; page <= end; page += 1) {
        selectedPages.add(page);
      }
      continue;
    }

    if (singleMatch) {
      const page = Number.parseInt(singleMatch[1], 10);
      if (page < 1 || page > totalPages) {
        throw new Error(`页码超出范围：${page}（PDF 共 ${totalPages} 页）`);
      }
      selectedPages.add(page);
      continue;
    }

    throw new Error(`页码格式无效：${part}（请使用如 1-10, 20-30）`);
  }

  return Array.from(selectedPages).sort((left, right) => left - right);
}

export function formatPageSelection(pageNumbers: number[]): string {
  if (pageNumbers.length === 0) {
    return "";
  }

  const ranges: string[] = [];
  let rangeStart = pageNumbers[0];
  let rangeEnd = pageNumbers[0];

  for (let index = 1; index < pageNumbers.length; index += 1) {
    const page = pageNumbers[index];
    if (page === rangeEnd + 1) {
      rangeEnd = page;
      continue;
    }

    ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
    rangeStart = page;
    rangeEnd = page;
  }

  ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
  return ranges.join(", ");
}
