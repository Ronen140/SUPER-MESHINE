import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>הרשמה</CardTitle>
        <CardDescription>יצירת חשבון חדש למערכת החשבוניות והקבלות.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        כבר יש לכם חשבון?{" "}
        <Link href="/login" className="ms-1 font-medium text-primary hover:underline">
          התחברות
        </Link>
      </CardFooter>
    </Card>
  );
}
