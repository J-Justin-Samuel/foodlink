"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FreshnessGauge } from "@/components/shared/freshness-gauge";
import {
  computeFreshness,
  DISPOSITION_LABELS,
  STATUS_META,
  type SensorReading,
} from "@/lib/freshness";
import {
  parseSensorPacket,
  SCANNER_CHARACTERISTIC_UUID,
  SCANNER_NAME_PREFIX,
  SCANNER_SERVICE_UUID,
} from "@/lib/sensor-protocol";
import { submitFreshnessScan, type ScanOutcome } from "@/lib/actions/freshness";

/* ---- Minimal Web Bluetooth typings (so no extra @types package is needed) ---- */
interface BtCharacteristic extends EventTarget {
  value?: DataView;
  startNotifications(): Promise<BtCharacteristic>;
  stopNotifications(): Promise<BtCharacteristic>;
}
interface BtService {
  getCharacteristic(uuid: string): Promise<BtCharacteristic>;
}
interface BtGatt {
  connected: boolean;
  connect(): Promise<BtGatt>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BtService>;
}
interface BtDevice extends EventTarget {
  name?: string;
  gatt?: BtGatt;
}
interface BtApi {
  requestDevice(options: {
    filters: Array<{ services?: string[]; namePrefix?: string }>;
    optionalServices?: string[];
  }): Promise<BtDevice>;
}

type Mode = "idle" | "connecting" | "connected" | "simulating";
type Source = "BLUETOOTH" | "SIMULATOR";

const SMOOTHING_SAMPLES = 5; // MQ-135 is noisy; show the average of the last few packets
const PRESETS: Array<{ label: string; r: SensorReading }> = [
  {
    label: "Cold and clean",
    r: { tvocPpm: 120, surfaceTempC: 4, humidityPct: 45 },
  },
  {
    label: "Warm room",
    r: { tvocPpm: 320, surfaceTempC: 26, humidityPct: 65 },
  },
  { label: "Spoiled", r: { tvocPpm: 900, surfaceTempC: 40, humidityPct: 80 } },
];

function describeBluetoothError(err: { name?: string; message?: string }) {
  switch (err.name) {
    case "SecurityError":
      return "Bluetooth is blocked on this page. Open the site over https:// (or localhost) and allow Bluetooth.";
    case "NetworkError":
      return "Couldn't connect to the scanner. Move closer, make sure it's powered on, and try again.";
    case "NotSupportedError":
      return "This scanner doesn't offer the FoodLink sensor service. Check its firmware.";
    default:
      return err.message || "Couldn't connect to the scanner.";
  }
}

interface Props {
  donationId: string;
  /** Lets people type readings in by hand (for testing without hardware). */
  simulatorEnabled: boolean;
}

export function FreshnessScanner({ donationId, simulatorEnabled }: Props) {
  const router = useRouter();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [source, setSource] = useState<Source>("BLUETOOTH");
  const [sim, setSim] = useState<SensorReading>(PRESETS[0].r);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanOutcome | null>(null);
  const [saving, startSaving] = useTransition();

  const samples = useRef<SensorReading[]>([]);
  const deviceRef = useRef<BtDevice | null>(null);
  const charRef = useRef<BtCharacteristic | null>(null);
  const valueHandler = useRef<((e: Event) => void) | null>(null);
  const disconnectHandler = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "bluetooth" in navigator);
  }, []);

  const teardown = useCallback(() => {
    const ch = charRef.current;
    if (ch && valueHandler.current)
      ch.removeEventListener(
        "characteristicvaluechanged",
        valueHandler.current,
      );
    ch?.stopNotifications().catch(() => {});
    const dev = deviceRef.current;
    if (dev && disconnectHandler.current)
      dev.removeEventListener(
        "gattserverdisconnected",
        disconnectHandler.current,
      );
    if (dev?.gatt?.connected) dev.gatt.disconnect();
    charRef.current = null;
    deviceRef.current = null;
    valueHandler.current = null;
    disconnectHandler.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const pushSample = useCallback((s: SensorReading) => {
    samples.current = [...samples.current.slice(-(SMOOTHING_SAMPLES - 1)), s];
    const n = samples.current.length;
    const sum = samples.current.reduce(
      (a, x) => ({
        tvocPpm: a.tvocPpm + x.tvocPpm,
        surfaceTempC: a.surfaceTempC + x.surfaceTempC,
        humidityPct: a.humidityPct + x.humidityPct,
      }),
      { tvocPpm: 0, surfaceTempC: 0, humidityPct: 0 },
    );
    setReading({
      tvocPpm: sum.tvocPpm / n,
      surfaceTempC: sum.surfaceTempC / n,
      humidityPct: sum.humidityPct / n,
    });
    setSource("BLUETOOTH");
  }, []);

  async function connect() {
    setError(null);
    setResult(null);
    const bt = (navigator as unknown as { bluetooth?: BtApi }).bluetooth;
    if (!bt) {
      setError("This browser can't talk to Bluetooth devices.");
      return;
    }
    teardown();
    setMode("connecting");
    try {
      const device = await bt.requestDevice({
        filters: [
          { services: [SCANNER_SERVICE_UUID] },
          { namePrefix: SCANNER_NAME_PREFIX },
        ],
        optionalServices: [SCANNER_SERVICE_UUID],
      });
      deviceRef.current = device;

      const onDisconnect = () => {
        setMode((m) => (m === "connected" ? "idle" : m));
        setError(
          "The scanner disconnected. Tap “Connect scanner” to reconnect.",
        );
      };
      disconnectHandler.current = onDisconnect;
      device.addEventListener("gattserverdisconnected", onDisconnect);

      if (!device.gatt) throw new Error("The device has no GATT server.");
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SCANNER_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(
        SCANNER_CHARACTERISTIC_UUID,
      );

      const onValue = (e: Event) => {
        const view = (e.target as unknown as BtCharacteristic).value;
        if (!view) return;
        const parsed = parseSensorPacket(view);
        if (parsed) pushSample(parsed);
      };
      valueHandler.current = onValue;
      characteristic.addEventListener("characteristicvaluechanged", onValue);
      await characteristic.startNotifications();
      charRef.current = characteristic;

      samples.current = [];
      setReading(null);
      setDeviceName(device.name ?? "FoodLink scanner");
      setMode("connected");
    } catch (err) {
      const e = err as { name?: string; message?: string };
      teardown();
      setMode("idle");
      // NotFoundError = the person closed the device chooser. Not an error.
      if (e.name !== "NotFoundError") setError(describeBluetoothError(e));
    }
  }

  function disconnect() {
    teardown();
    setMode("idle");
  }

  function startSimulator(r: SensorReading = sim) {
    teardown();
    setError(null);
    setResult(null);
    setSim(r);
    setReading(r);
    setSource("SIMULATOR");
    setMode("simulating");
  }

  function updateSim(patch: Partial<SensorReading>) {
    const next = { ...sim, ...patch };
    setSim(next);
    setReading(next);
    setSource("SIMULATOR");
    setMode("simulating");
  }

  const live = reading ? computeFreshness(reading) : null;

  function save() {
    if (!reading || !live) return;
    if (
      live.status === "SPOILED" &&
      !window.confirm(
        "This reading says the food is spoiled. Saving removes the batch from volunteers and reclassifies it for composting or an animal shelter. It can't be undone from here. Save anyway?",
      )
    ) {
      return;
    }
    setError(null);
    startSaving(async () => {
      const res = await submitFreshnessScan({
        donationId,
        tvocPpm: reading.tvocPpm,
        surfaceTempC: reading.surfaceTempC,
        humidityPct: reading.humidityPct,
        source,
        deviceName:
          source === "BLUETOOTH" ? (deviceName ?? undefined) : undefined,
      });
      if (res.ok) {
        setResult(res.data);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const streaming = mode === "connected";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {supported !== false && !streaming && (
          <Button
            type="button"
            onClick={connect}
            disabled={mode === "connecting" || supported === null}
          >
            {mode === "connecting" ? "Connecting…" : "Connect scanner"}
          </Button>
        )}
        {streaming && (
          <>
            <span className="text-sm font-medium">
              <span
                className="mr-1.5 inline-block size-2 rounded-full bg-green-600"
                aria-hidden
              />
              Connected to {deviceName}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={disconnect}
            >
              Disconnect
            </Button>
          </>
        )}
      </div>

      {supported === false && (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          This browser can&apos;t use Bluetooth scanners. Use Chrome or Edge on
          Android, Windows, macOS or Linux (the page must be on https:// or
          localhost). On an iPhone, open FoodLink in the Bluefy browser.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-4 rounded-lg border p-4 sm:flex-row sm:items-start">
        <div className="shrink-0" aria-live="polite">
          <FreshnessGauge score={live ? live.score : null} size={240} />
          {streaming && !reading && (
            <p className="text-center text-xs text-muted-foreground">
              Waiting for the first reading…
            </p>
          )}
        </div>

        <div className="w-full min-w-0 flex-1 space-y-3">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["TVOC", reading ? `${Math.round(reading.tvocPpm)}` : "—", "ppm"],
              [
                "Surface",
                reading ? reading.surfaceTempC.toFixed(1) : "—",
                "°C",
              ],
              [
                "Humidity",
                reading ? `${Math.round(reading.humidityPct)}` : "—",
                "%",
              ],
            ].map(([name, value, unit]) => (
              <div key={name} className="rounded-md bg-muted p-2">
                <dt className="text-xs text-muted-foreground">{name}</dt>
                <dd className="font-mono text-lg font-semibold">
                  {value}
                  <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                    {unit}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          {live && (
            <div>
              <p className="text-sm font-medium">
                {STATUS_META[live.status].advice}
              </p>
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                {live.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <Button
            type="button"
            onClick={save}
            disabled={!reading || saving || !!result}
            variant={live?.status === "SPOILED" ? "destructive" : "default"}
            className="w-full sm:w-auto"
          >
            {saving
              ? "Saving…"
              : live?.status === "SPOILED"
                ? "Save result and reclassify batch"
                : "Save this result"}
          </Button>
        </div>
      </div>

      {result && (
        <div
          role="status"
          className="rounded-lg border-2 border-foreground p-3 text-sm"
        >
          <p className="font-semibold">
            Saved: {result.score}/100, {STATUS_META[result.status].label}.
          </p>
          {result.diverted ? (
            <p className="mt-1">
              This batch is no longer available for people to eat. It was
              reclassified for{" "}
              <strong>
                {DISPOSITION_LABELS[result.disposition].toLowerCase()}
              </strong>{" "}
              and this delivery was cancelled.
            </p>
          ) : (
            <p className="mt-1 text-muted-foreground">
              {STATUS_META[result.status].advice}
            </p>
          )}
        </div>
      )}

      {simulatorEnabled && (
        <details
          className="rounded-lg border p-3 text-sm"
          open={mode === "simulating"}
        >
          <summary className="cursor-pointer font-medium">
            No scanner? Enter readings by hand (testing only)
          </summary>
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startSimulator(p.r)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {(
              [
                ["tvocPpm", "TVOC (ppm)", 0, 1500, 10],
                ["surfaceTempC", "Surface temperature (°C)", -5, 60, 0.5],
                ["humidityPct", "Humidity (%)", 0, 100, 1],
              ] as const
            ).map(([key, name, min, max, step]) => (
              <div key={key}>
                <Label htmlFor={`sim-${key}`} className="mb-1 block text-xs">
                  {name}: {sim[key]}
                </Label>
                <input
                  id={`sim-${key}`}
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={sim[key]}
                  onChange={(e) => updateSim({ [key]: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Manual readings are saved as “simulator” and are rejected on
              production servers.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
