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
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut();
    setIsPending(false);

    if (signOutError) {
      setError(mapAuthError(signOutError));
      return;
    }

    router.push("/login");
    router.refresh();
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
