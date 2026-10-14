"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressSearch } from "@/components/shared/address-search";
import { createDonation } from "@/lib/actions/donations";
import {
  donationFormSchema,
  type DonationFormValues,
} from "@/lib/validations/donation";
import { CLASSIFICATION_LABELS, FOOD_CLASSIFICATIONS } from "@/types/donation";

const pad = (n: number) => String(n).padStart(2, "0");
function toLocalInputValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const EMPTY: DonationFormValues = {
  title: "",
  items: [{ name: "", quantity: "", notes: "" }],
  estimatedServings: 20,
  quantityKg: 10,
  classification: "COOKED",
  preparedAt: "",
  expiryHours: 4,
  pickupAddress: "",
  pickupLat: 0,
  pickupLng: 0,
  pickupInstructions: "",
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function DonationForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const form = useForm<DonationFormValues>({
    resolver: zodResolver(donationFormSchema),
    defaultValues: EMPTY,
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // Set "now" on the client only, to avoid server/client hydration mismatches.
  useEffect(() => {
    if (!form.getValues("preparedAt")) {
      setValue("preparedAt", toLocalInputValue(new Date()));
    }
  }, [form, setValue]);

  const address = watch("pickupAddress");
  const lat = watch("pickupLat");
  const lng = watch("pickupLng");
  const resolved =
    address && !(lat === 0 && lng === 0) ? { address, lat, lng } : null;

  async function onSubmit(values: DonationFormValues) {
    setServerError(null);
    const result = await createDonation({
      ...values,
      // datetime-local has no timezone; convert using the browser's zone.
      preparedAt: new Date(values.preparedAt).toISOString(),
    });

    if (!result.ok) {
      setServerError(result.error);
      for (const [field, messages] of Object.entries(
        result.fieldErrors ?? {},
      )) {
        if (messages?.[0]) {
          form.setError(field as keyof DonationFormValues, {
            message: messages[0],
          });
        }
      }
      return;
    }

    setCreatedId(result.data.id);
    reset({ ...EMPTY, preparedAt: toLocalInputValue(new Date()) });
  }

  if (createdId) {
    return (
      <div className="space-y-4 rounded-lg border p-6 text-center">
        <h2 className="text-lg font-semibold">Donation listed</h2>
        <p className="text-sm text-muted-foreground">
          Nearby volunteers can now see and claim this batch.
        </p>
        <Button onClick={() => setCreatedId(null)}>List another batch</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      {/* Batch basics */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Batch title"
          error={errors.title?.message}
          className="sm:col-span-2"
        >
          <Input
            placeholder="e.g. Wedding buffet leftovers"
            {...register("title")}
          />
        </Field>

        <Field label="Food type" error={errors.classification?.message}>
          <select className={selectClass} {...register("classification")}>
            {FOOD_CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {CLASSIFICATION_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Estimated servings"
          error={errors.estimatedServings?.message}
        >
          <Input
            type="number"
            min={1}
            {...register("estimatedServings", { valueAsNumber: true })}
          />
        </Field>

        <Field label="Approx. weight (kg)" error={errors.quantityKg?.message}>
          <Input
            type="number"
            step="0.1"
            min={0.1}
            {...register("quantityKg", { valueAsNumber: true })}
          />
        </Field>
      </section>

      {/* Itemised contents */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            What&apos;s in the batch?
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ name: "", quantity: "", notes: "" })}
            disabled={fields.length >= 30}
          >
            Add item
          </Button>
        </div>

        {fields.map((field, i) => (
          <div
            key={field.id}
            className="grid gap-2 rounded-md border p-3 sm:grid-cols-[2fr_1fr_2fr_auto]"
          >
            <Field label="Item" error={errors.items?.[i]?.name?.message}>
              <Input
                placeholder="Veg biryani"
                {...register(`items.${i}.name`)}
              />
            </Field>
            <Field
              label="Quantity"
              error={errors.items?.[i]?.quantity?.message}
            >
              <Input
                placeholder="30 plates"
                {...register(`items.${i}.quantity`)}
              />
            </Field>
            <Field
              label="Notes (optional)"
              error={errors.items?.[i]?.notes?.message}
            >
              <Input
                placeholder="Contains nuts"
                {...register(`items.${i}.notes`)}
              />
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(i)}
                disabled={fields.length === 1}
                aria-label={`Remove item ${i + 1}`}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
        {(errors.items?.root?.message ?? errors.items?.message) && (
          <p className="text-xs text-destructive">
            {errors.items?.root?.message ?? errors.items?.message}
          </p>
        )}
      </section>

      {/* Freshness window */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Prepared at" error={errors.preparedAt?.message}>
          <Input type="datetime-local" {...register("preparedAt")} />
        </Field>
        <Field
          label="Safe to eat for (hours)"
          error={errors.expiryHours?.message}
          hint="Counted from the preparation time."
        >
          <Input
            type="number"
            step="0.5"
            min={0.5}
            max={72}
            {...register("expiryHours", { valueAsNumber: true })}
          />
        </Field>
      </section>

      {/* Pickup */}
      <section className="space-y-4">
        <Field label="Pickup address" error={errors.pickupAddress?.message}>
          <AddressSearch
            resolved={resolved}
            error={errors.pickupAddress?.message}
            onSelect={(v) => {
              setValue("pickupAddress", v.address, { shouldValidate: true });
              setValue("pickupLat", v.lat);
              setValue("pickupLng", v.lng);
            }}
            onClear={() => {
              setValue("pickupAddress", "");
              setValue("pickupLat", 0);
              setValue("pickupLng", 0);
            }}
          />
        </Field>

        <Field
          label="Pickup instructions (optional)"
          error={errors.pickupInstructions?.message}
        >
          <textarea
            rows={3}
            placeholder="e.g. Use the rear kitchen entrance and ask for Chef Rina"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register("pickupInstructions")}
          />
        </Field>
      </section>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Listing…" : "List donation"}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
