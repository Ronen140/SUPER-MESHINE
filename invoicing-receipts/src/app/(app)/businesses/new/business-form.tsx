"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toUserMessage } from "@/lib/errors";
import { type BusinessInput, businessSchema } from "@/lib/schemas/business";
import { mapAuthError } from "@/lib/supabase/auth-errors";

const ENTITY_TYPE_OPTIONS = [
  {
    value: "patur" as const,
    label: "עוסק פטור",
    description: 'פטור ממע"מ. אפשר להפיק קבלות, הצעות מחיר וחשבוניות עסקה בלבד.',
  },
  {
    value: "murshe" as const,
    label: "עוסק מורשה",
    description: 'גובה ומדווח מע"מ. אפשר להפיק גם חשבונית מס וחשבונית מס-קבלה.',
  },
];

type CreatedBusiness = { id: string; legal_name: string; tax_id: string };

/** `{ error: string }` shape returned by `POST /api/businesses`/`POST /api/keygen` on failure. */
function extractApiErrorMessage(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error: unknown }).error === "string"
  ) {
    return toUserMessage((payload as { error: string }).error);
  }
  return null;
}

export function BusinessForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingKeyBusiness, setPendingKeyBusiness] = useState<CreatedBusiness | null>(null);
  const [keygenError, setKeygenError] = useState<string | null>(null);
  const [isRetryingKey, setIsRetryingKey] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BusinessInput>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      legal_name: "",
      tax_id: "",
      display_name: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const response = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legal_name: values.legal_name,
          entity_type: values.entity_type,
          tax_id: values.tax_id,
          ...(values.display_name ? { display_name: values.display_name } : {}),
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setFormError(extractApiErrorMessage(payload) ?? toUserMessage(null));
        return;
      }

      const { business, signingKeyError } = payload as {
        business: CreatedBusiness;
        signingKeyError: string | null;
      };

      if (signingKeyError) {
        setPendingKeyBusiness(business);
        setKeygenError(toUserMessage(signingKeyError));
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setFormError(mapAuthError(err));
    }
  });

  async function handleRetryKeygen() {
    if (!pendingKeyBusiness) return;
    setIsRetryingKey(true);
    setKeygenError(null);
    try {
      const response = await fetch("/api/keygen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: pendingKeyBusiness.id,
          legal_name: pendingKeyBusiness.legal_name,
          tax_id: pendingKeyBusiness.tax_id,
        }),
      });

      if (!response.ok) {
        setKeygenError("יצירת מפתח החתימה נכשלה שוב. אפשר לנסות שוב בעוד כמה רגעים.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setKeygenError(mapAuthError(err));
    } finally {
      setIsRetryingKey(false);
    }
  }

  if (pendingKeyBusiness) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-md bg-success/10 p-4 text-sm text-success">
          העסק &quot;{pendingKeyBusiness.legal_name}&quot; נוצר בהצלחה.
        </p>
        <div className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-medium text-warning">מפתח החתימה עדיין לא מוכן</p>
          <p className="mt-1 text-muted-foreground">
            יצירת מפתח החתימה של העסק נכשלה ברקע. אי אפשר להפיק מסמכים עד שהמפתח ייווצר בהצלחה.
          </p>
          {keygenError ? (
            <p role="alert" className="mt-2 text-destructive">
              {keygenError}
            </p>
          ) : null}
          <div className="mt-3 flex items-center gap-3">
            <Button type="button" size="sm" onClick={handleRetryKeygen} disabled={isRetryingKey}>
              {isRetryingKey ? "מנסים שוב…" : "נסה שוב"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
            >
              המשך בכל זאת
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="business-legal-name">שם חוקי של העסק</Label>
        <Input
          id="business-legal-name"
          type="text"
          autoComplete="organization"
          aria-invalid={errors.legal_name ? true : undefined}
          aria-describedby={errors.legal_name ? "business-legal-name-error" : undefined}
          {...register("legal_name")}
        />
        {errors.legal_name ? (
          <p id="business-legal-name-error" role="alert" className="text-sm text-destructive">
            {errors.legal_name.message}
          </p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">סוג עסק</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ENTITY_TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer flex-col gap-1 rounded-md border border-input p-3 text-sm has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
            >
              <span className="flex items-center gap-2 font-medium text-foreground">
                <input type="radio" value={option.value} {...register("entity_type")} />
                {option.label}
              </span>
              <span className="text-muted-foreground">{option.description}</span>
            </label>
          ))}
        </div>
        {errors.entity_type ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.entity_type.message}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">לא ניתן לשנות את סוג העסק לאחר יצירתו.</p>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="business-tax-id">מספר עוסק / ח.פ</Label>
        <Input
          id="business-tax-id"
          type="text"
          inputMode="numeric"
          dir="ltr"
          className="text-end"
          autoComplete="off"
          aria-invalid={errors.tax_id ? true : undefined}
          aria-describedby={errors.tax_id ? "business-tax-id-error" : undefined}
          {...register("tax_id")}
        />
        {errors.tax_id ? (
          <p id="business-tax-id-error" role="alert" className="text-sm text-destructive">
            {errors.tax_id.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="business-display-name">שם תצוגה (אופציונלי)</Label>
        <Input id="business-display-name" type="text" {...register("display_name")} />
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "יוצרים עסק…" : "יצירת עסק"}
      </Button>
    </form>
  );
}
