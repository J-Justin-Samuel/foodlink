import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Inngest calls this endpoint (signed with INNGEST_SIGNING_KEY) to run the scheduled jobs.
export const { GET, POST, PUT } = serve({ client: inngest, functions });
