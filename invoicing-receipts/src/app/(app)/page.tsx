import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getActiveBusinessContext } from "@/lib/businesses/get-active-business";

export default async function HomePage() {
  const { activeBusiness } = await getActiveBusinessContext();

  if (!activeBusiness) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-2xl font-semibold text-foreground">בואו נפיק את המסמך הראשון</h1>
        <p className="text-muted-foreground">
          כדי להתחיל, צריך קודם עסק — עוסק פטור או עוסק מורשה. אפשר להוסיף עסקים נוספים בכל שלב.
        </p>
        <Button asChild>
          <Link href="/businesses/new">יצירת עסק ראשון</Link>
        </Button>
      </div>
    );
  }

  const name = activeBusiness.display_name?.trim() || activeBusiness.legal_name;

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-foreground">בוקר טוב</h1>
      <p className="text-muted-foreground">
        העסק הפעיל: <span className="font-medium text-foreground">{name}</span>. עדיין אין כאן
        מסמכים — זהו שלד האפליקציה (Phase 0). דשבורד, עורך מסמכים וקטלוג פריטים יגיעו בהמשך.
      </p>
    </div>
  );
}
