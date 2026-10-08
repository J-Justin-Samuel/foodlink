"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  submitOperationalDetails,
  type OperationalDetailsInput,
} from "@/app/onboarding/actions";

type FormState = Omit<
  OperationalDetailsInput,
  "latitude" | "longitude" | "role"
> & {
  latitude: string;
  longitude: string;
};

const EMPTY_STATE: FormState = {
  organizationName: "",
  displayName: "",
  phone: "",
  licenseNumber: "",
  licenseType: undefined,
  addressLine: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  latitude: "",
  longitude: "",
};

export function OperationalDetailsStep({
  role,
  onComplete,
}: {
  role: string;
  onComplete: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_STATE);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const showOrgFields = role === "DONOR" || role === "NGO";
  const showLicenseFields = role === "DONOR" || role === "NGO";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function captureGpsLocation() {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported in this browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update("latitude", position.coords.latitude.toFixed(6));
        update("longitude", position.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      () => {
        setError("Could not read GPS location — enter it manually or retry");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function handleSubmit() {
    setError(null);
    setFieldErrors({});

    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("Base GPS coordinates are required — use 'Detect my location'");
      return;
    }

    startTransition(async () => {
      const result = await submitOperationalDetails({
        role: role as OperationalDetailsInput["role"],
        organizationName: form.organizationName || undefined,
        displayName: form.displayName,
        phone: form.phone,
        licenseNumber: form.licenseNumber || undefined,
        licenseType: form.licenseType,
        addressLine: form.addressLine,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        country: form.country,
        latitude: lat,
        longitude: lng,
      });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      onComplete();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Operational details</h2>
        <p className="text-sm text-muted-foreground">
          We use this to verify your account and route nearby matches.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {showOrgFields && (
          <Field
            label="Organization name"
            error={fieldErrors.organizationName}
            className="sm:col-span-2"
          >
            <Input
              value={form.organizationName}
              onChange={(e) => update("organizationName", e.target.value)}
              placeholder="e.g. Taste of Bengaluru Hotel"
            />
          </Field>
        )}

        <Field label="Your name" error={fieldErrors.displayName}>
          <Input
            value={form.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            required
          />
        </Field>

        <Field label="Phone number" error={fieldErrors.phone}>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+91XXXXXXXXXX"
            required
          />
        </Field>

        {showLicenseFields && (
          <>
            <Field label="License type" error={fieldErrors.licenseType}>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.licenseType ?? ""}
                onChange={(e) =>
                  update(
                    "licenseType",
                    (e.target.value || undefined) as FormState["licenseType"],
                  )
                }
              >
                <option value="">Select...</option>
                <option value="FSSAI">FSSAI (Food Safety License)</option>
                <option value="NGO_80G">NGO 80G Tax Exemption</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>

            <Field
              label="License / registration number"
              error={fieldErrors.licenseNumber}
            >
              <Input
                value={form.licenseNumber}
                onChange={(e) => update("licenseNumber", e.target.value)}
              />
            </Field>
          </>
        )}

        <Field
          label="Address"
          error={fieldErrors.addressLine}
          className="sm:col-span-2"
        >
          <Input
            value={form.addressLine}
            onChange={(e) => update("addressLine", e.target.value)}
            required
          />
        </Field>

        <Field label="City" error={fieldErrors.city}>
          <Input
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            required
          />
        </Field>

        <Field label="State" error={fieldErrors.state}>
          <Input
            value={form.state}
            onChange={(e) => update("state", e.target.value)}
            required
          />
        </Field>

        <Field label="Postal code" error={fieldErrors.postalCode}>
          <Input
            value={form.postalCode}
            onChange={(e) => update("postalCode", e.target.value)}
            required
          />
        </Field>

        <Field label="Country" error={fieldErrors.country}>
          <Input
            value={form.country}
            onChange={(e) => update("country", e.target.value)}
          />
        </Field>
      </div>

      <div className="rounded-lg border border-dashed p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Base GPS coordinates</Label>
            <p className="text-xs text-muted-foreground">
              Used for proximity matching on the volunteer map (PostGIS).
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={captureGpsLocation}
            disabled={isLocating}
          >
            {isLocating ? "Detecting..." : "Detect my location"}
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Input
            placeholder="Latitude"
            value={form.latitude}
            onChange={(e) => update("latitude", e.target.value)}
          />
          <Input
            placeholder="Longitude"
            value={form.longitude}
            onChange={(e) => update("longitude", e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleSubmit} disabled={isPending} className="w-full">
        {isPending ? "Submitting..." : "Submit for verification"}
      </Button>
    </div>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string[];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      {children}
      {error?.[0] && (
        <p className="mt-1 text-xs text-destructive">{error[0]}</p>
      )}
    </div>
  );
}
