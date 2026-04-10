import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

const APP_NAME = "TKOA Finance";

/**
 * Generate a new TOTP secret for a user.
 */
export function generateTOTPSecret(): string {
  return generateSecret();
}

/**
 * Generate the otpauth URL for use with authenticator apps.
 */
export function getTOTPUri(secret: string, email: string): string {
  return generateURI({
    label: email,
    issuer: APP_NAME,
    secret,
  });
}

/**
 * Generate a base64 data URL for the QR code.
 */
export async function generateQRCode(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, {
    margin: 1,
    color: { dark: "#ffffff", light: "#00000000" },
    width: 200,
  });
}

/**
 * Verify a TOTP token against a secret.
 * Accepts 1 step drift (30 seconds) in either direction.
 */
export function verifyTOTP(token: string, secret: string): boolean {
  const result = verifySync({ token: token.replace(/\s/g, ""), secret });
  return result !== null && typeof result === "object" && (result as { valid?: boolean }).valid === true;
}
