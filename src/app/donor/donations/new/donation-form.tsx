"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressSearch } from "@/components/shared/address-search";
import {
  FoodPhotoPicker,
  type PickedPhoto,
} from "@/components/shared/food-photo-picker";
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
  photoIds: [],
};

const selectClass =
  "h-11 w-full rounded-xl border border-input bg-white/90 px-3 text-sm";

export function DonationForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

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
    setPhotos([]);
    reset({ ...EMPTY, preparedAt: toLocalInputValue(new Date()) });
  }

  if (createdId) {
    return (
      <div className="glass-strong space-y-4 rounded-3xl p-8 text-center">
        <span
          className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-fresh/20 text-3xl"
          aria-hidden
        >
          🎉
        </span>
        <h2 className="text-2xl font-extrabold">Donation listed</h2>
        <p className="text-sm text-ink/75">
          Nearby volunteers can now see and claim this batch.
        </p>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/donor" className="btn-flame">
            Go to my donations
          </Link>
          <button
            type="button"
            className="btn-glass"
            onClick={() => setCreatedId(null)}
          >
            List another batch
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Photo first: it is what everyone sees when deciding */}
      <section
        className="glass-strong space-y-3 rounded-3xl p-5"
        aria-labelledby="photo-h"
      >
        <h2 id="photo-h" className="text-lg font-bold">
          Photo of the food
        </h2>
        <FoodPhotoPicker
          value={photos}
          error={errors.photoIds?.message}
          onChange={(next) => {
            setPhotos(next);
            setValue(
              "photoIds",
              next.map((p) => p.id),
              { shouldValidate: true },
            );
          }}
        />
      </section>

      {/* Batch basics */}
      <section className="glass-strong grid gap-4 rounded-3xl p-5 sm:grid-cols-2">
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
      <section className="glass-strong space-y-3 rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-bold text-forest">
            What&apos;s in the batch?
          </Label>
          <button
            type="button"
            className="btn-glass btn-sm"
            onClick={() => append({ name: "", quantity: "", notes: "" })}
            disabled={fields.length >= 30}
          >
            + Add item
          </button>
        </div>

        {fields.map((field, i) => (
          <div
            key={field.id}
            className="grid gap-2 rounded-2xl bg-peach/40 p-3 sm:grid-cols-[2fr_1fr_2fr_auto]"
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
      <section className="glass-strong grid gap-4 rounded-3xl p-5 sm:grid-cols-2">
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
      <section className="glass-strong space-y-4 rounded-3xl p-5">
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
            className="w-full rounded-xl border border-input bg-white/90 px-3 py-2 text-sm"
            {...register("pickupInstructions")}
          />
        </Field>
      </section>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        className="btn-flame w-full text-base disabled:opacity-60"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Listing…" : "List donation"}
      </button>
      {photos.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Add a photo of the food above to list it.
        </p>
      )}
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
