export function normalizePhoneForStorage(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D+/g, "");

  if (!digits) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.startsWith("54")) {
    return `+${digits}`;
  }

  if (digits.length >= 10 && digits.length <= 11) {
    return `+54${digits.replace(/^0+/, "")}`;
  }

  return `+${digits}`;
}
