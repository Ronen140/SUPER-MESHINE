"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mapAuthError } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/browser";
import { type SignupInput, signupSchema } from "./signup-form.schema";

export function SignupForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName } },
    });

    if (error) {
      setFormError(mapAuthError(error));
      return;
    }

    router.push("/");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-full-name">שם מלא</Label>
        <Input
          id="signup-full-name"
          type="text"
          autoComplete="name"
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={errors.fullName ? "signup-full-name-error" : undefined}
          {...register("fullName")}
        />
        {errors.fullName ? (
          <p id="signup-full-name-error" role="alert" className="text-sm text-destructive">
            {errors.fullName.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-email">אימייל</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "signup-email-error" : undefined}
          {...register("email")}
        />
        {errors.email ? (
          <p id="signup-email-error" role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-password">סיסמה</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "signup-password-error" : undefined}
          {...register("password")}
        />
        {errors.password ? (
          <p id="signup-password-error" role="alert" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-confirm-password">אימות סיסמה</Label>
        <Input
          id="signup-confirm-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? "signup-confirm-password-error" : undefined}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p id="signup-confirm-password-error" role="alert" className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "יוצרים חשבון…" : "יצירת חשבון"}
      </Button>
    </form>
  );
}
