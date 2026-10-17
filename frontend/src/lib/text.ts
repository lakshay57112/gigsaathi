/** AI replies often contain markdown. We show plain text, so tidy the common markers. */
export function cleanAiText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/^\s*[*-]\s+/gm, "• ")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers or insecure contexts: fall back to a temporary textarea.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } finally {
      area.remove();
    }
  }
}
