import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessForm } from "./business-form";

export default function NewBusinessPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>יצירת עסק חדש</CardTitle>
          <CardDescription>
            כל עסק מנהל לקוחות, מסמכים ומספור נפרדים משלו. אפשר להוסיף פרטים נוספים (כתובת,
            הגדרות) בהמשך דרך הגדרות העסק.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessForm />
        </CardContent>
      </Card>
    </div>
  );
}
