import { createDb } from "./index";
import { plans, plan_entitlements } from "./schema";

const DATABASE_URL = process.env.DATABASE_URL!;

async function seed() {
  const db = createDb(DATABASE_URL);

  // Insert plans
  await db.insert(plans).values([
    { id: "free", name: "Free", billing_type: "free" },
    {
      id: "pro",
      name: "Pro",
      billing_type: "recurring",
      payos_price_refs: { monthly: "pro_monthly", yearly: "pro_yearly" },
    },
    {
      id: "lifetime",
      name: "Lifetime",
      billing_type: "one_time",
      payos_price_refs: { lifetime: "lifetime_once" },
    },
  ]).onConflictDoNothing();

  // Insert entitlements
  const entitlements = [
    // Free tier
    { plan_id: "free", feature_key: "max_projects", value: "3" },
    { plan_id: "free", feature_key: "max_pages", value: "5" },
    { plan_id: "free", feature_key: "max_sections_page", value: "8" },
    { plan_id: "free", feature_key: "max_media_bytes", value: "52428800" }, // 50MB
    { plan_id: "free", feature_key: "max_rsvp", value: "50" },
    { plan_id: "free", feature_key: "max_publishes_day", value: "3" },
    { plan_id: "free", feature_key: "custom_domain", value: "false" },
    { plan_id: "free", feature_key: "remove_branding", value: "false" },
    // Pro tier
    { plan_id: "pro", feature_key: "max_projects", value: "unlimited" },
    { plan_id: "pro", feature_key: "max_pages", value: "unlimited" },
    { plan_id: "pro", feature_key: "max_sections_page", value: "unlimited" },
    { plan_id: "pro", feature_key: "max_media_bytes", value: "5368709120" }, // 5GB
    { plan_id: "pro", feature_key: "max_rsvp", value: "500" },
    { plan_id: "pro", feature_key: "max_publishes_day", value: "unlimited" },
    { plan_id: "pro", feature_key: "custom_domain", value: "true" },
    { plan_id: "pro", feature_key: "remove_branding", value: "true" },
    // Lifetime = same as pro
    { plan_id: "lifetime", feature_key: "max_projects", value: "unlimited" },
    { plan_id: "lifetime", feature_key: "max_pages", value: "unlimited" },
    { plan_id: "lifetime", feature_key: "max_sections_page", value: "unlimited" },
    { plan_id: "lifetime", feature_key: "max_media_bytes", value: "5368709120" },
    { plan_id: "lifetime", feature_key: "max_rsvp", value: "500" },
    { plan_id: "lifetime", feature_key: "max_publishes_day", value: "unlimited" },
    { plan_id: "lifetime", feature_key: "custom_domain", value: "true" },
    { plan_id: "lifetime", feature_key: "remove_branding", value: "true" },
  ];

  await db.insert(plan_entitlements).values(entitlements).onConflictDoNothing();
  console.log("Seed completed!");
  process.exit(0);
}

seed().catch(console.error);
