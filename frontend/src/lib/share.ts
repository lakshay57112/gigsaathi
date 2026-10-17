// Sending a complaint through WhatsApp. A link can carry only so much text, so long drafts
// fall back to the phone's share sheet, or to copying.

// Encoded length (Indian scripts take about 9 characters per letter once encoded).
const MAX_ENCODED_LENGTH = 3500;

/** A WhatsApp link that opens with `text` ready to send, or null if the text is too long. */
export function buildWhatsAppUrl(text: string): string | null {
  const encoded = encodeURIComponent(text);
  if (!text.trim() || encoded.length > MAX_ENCODED_LENGTH) return null;
  return `https://wa.me/?text=${encoded}`;
}

export type ShareOutcome = "whatsapp" | "share-sheet" | "too-long" | "cancelled";

/** Try WhatsApp first, then the share sheet. "too-long" means the caller should copy instead. */
export async function shareComplaint(subject: string, body: string): Promise<ShareOutcome> {
  const text = subject.trim() ? `${subject.trim()}\n\n${body}` : body;
  const url = buildWhatsAppUrl(text);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
    return "whatsapp";
  }
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: subject, text });
      return "share-sheet";
    } catch {
      return "cancelled"; // the person closed the share sheet
    }
  }
  return "too-long";
}
