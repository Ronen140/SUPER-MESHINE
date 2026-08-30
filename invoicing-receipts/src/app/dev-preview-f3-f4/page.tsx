/**
 * TEMPORARY, throwaway browser-verification harness for F3/F4 (no live Supabase project
 * to exercise the real authenticated route through). Renders the real BusinessForm and
 * BusinessSwitcher components (not mocks) with hardcoded props so they can be screenshotted
 * in a real browser. Deleted (along with the /__preview__ public-paths exception) before
 * the end of this task — see vault/Meeting Notes/invoicing-receipts-system.md.
 */
import { BusinessForm } from "@/app/(app)/businesses/new/business-form";
import { BusinessSwitcher } from "@/components/layout/business-switcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ONE_BUSINESS = [
  {
    id: "biz-1",
    legal_name: 'רונן דורמן בע"מ',
    display_name: null,
    entity_type: "murshe" as const,
    accent_color: "#047857",
  },
];

const TWO_BUSINESSES = [
  ...ONE_BUSINESS,
  {
    id: "biz-2",
    legal_name: "עמותת הנוער",
    display_name: "מועדון הנוער",
    entity_type: "patur" as const,
    accent_color: "#b45309",
  },
];

export default function PreviewPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10 p-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Switcher — 0 businesses</h2>
        <div className="w-64">
          <BusinessSwitcher businesses={[]} activeBusinessId={null} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Switcher — 1 business</h2>
        <div className="w-64">
          <BusinessSwitcher businesses={ONE_BUSINESS} activeBusinessId="biz-1" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Switcher — 2 businesses (dropdown)</h2>
        <div className="w-64">
          <BusinessSwitcher businesses={TWO_BUSINESSES} activeBusinessId="biz-1" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Business creation form (F3)</h2>
        <Card>
          <CardHeader>
            <CardTitle>יצירת עסק חדש</CardTitle>
          </CardHeader>
          <CardContent>
            <BusinessForm />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
