export function normalizeWhatsapp(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!/^(?:08|62|\+62)\d+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return null;
  return digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
}
