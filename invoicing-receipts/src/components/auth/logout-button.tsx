"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { mapAuthError } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setIsPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError(mapAuthError(signOutError));
        return;
      }

      router.push("/login");
      router.refresh();
    } catch (err) {
      // createClient() throws synchronously on missing env; signOut()'s own
      // promise can also reject on a raw network failure — surface both
      // instead of failing silently (code-quality review, Issue #1).
      setError(mapAuthError(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        disabled={isPending}
        className="w-full justify-start"
      >
        <LogOut aria-hidden="true" />
        {isPending ? "מתנתק…" : "התנתקות"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
