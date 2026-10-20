/**
 * GATT contract between the ESP32 scanner and the browser (Web Bluetooth).
 *
 *   Service         a3f10000-6f6f-4d0e-9a52-5ed0f00d0001
 *   Characteristic  a3f10001-6f6f-4d0e-9a52-5ed0f00d0001   (NOTIFY, 6 bytes)
 *
 * Packet layout, little-endian:
 *   bytes 0-1  uint16  TVOC                      ppm
 *   bytes 2-3  int16   surface temperature       °C × 100   (24.35 °C -> 2435)
 *   bytes 4-5  uint16  relative humidity         % × 100    (61.20 % -> 6120)
 *
 * The ESP32 should include the service UUID in its advertisement, or advertise
 * a name starting with "FoodLink" (the browser accepts either).
 */
import type { SensorReading } from "@/lib/freshness";

export const SCANNER_SERVICE_UUID = "a3f10000-6f6f-4d0e-9a52-5ed0f00d0001";
export const SCANNER_CHARACTERISTIC_UUID =
  "a3f10001-6f6f-4d0e-9a52-5ed0f00d0001";
export const SCANNER_NAME_PREFIX = "FoodLink";
export const SCANNER_PACKET_BYTES = 6;

/** Returns null for malformed or physically impossible packets. */
export function parseSensorPacket(view: DataView): SensorReading | null {
  if (view.byteLength < SCANNER_PACKET_BYTES) return null;
  const tvocPpm = view.getUint16(0, true);
  const surfaceTempC = view.getInt16(2, true) / 100;
  const humidityPct = view.getUint16(4, true) / 100;

  if (humidityPct < 0 || humidityPct > 100) return null;
  if (surfaceTempC < -40 || surfaceTempC > 150) return null;
  return { tvocPpm, surfaceTempC, humidityPct };
}

/** Inverse of parseSensorPacket — used by tests and the in-browser fake device. */
export function encodeSensorPacket(r: SensorReading): ArrayBuffer {
  const buf = new ArrayBuffer(SCANNER_PACKET_BYTES);
  const v = new DataView(buf);
  v.setUint16(0, Math.round(r.tvocPpm), true);
  v.setInt16(2, Math.round(r.surfaceTempC * 100), true);
  v.setUint16(4, Math.round(r.humidityPct * 100), true);
  return buf;
}
