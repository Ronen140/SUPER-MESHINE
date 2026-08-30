import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

function safeRedirect(next: string | undefined): string {
  if (!next?.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>התחברות</CardTitle>
        <CardDescription>התחברו כדי לנהל את החשבוניות והקבלות שלכם.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm redirectTo={safeRedirect(next)} />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        אין לכם חשבון?{" "}
        <Link href="/signup" className="ms-1 font-medium text-primary hover:underline">
          הרשמה
        </Link>
      </CardFooter>
    </Card>
  );
}
