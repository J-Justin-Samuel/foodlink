import { DashboardShell } from "@/components/shared/dashboard-shell";

/** Shared by donors, volunteers, NGOs and admins; each delivery page checks the viewer's own access. */
export default function TrackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell roles={["DONOR", "VOLUNTEER", "NGO", "ADMIN"]}>
      {children}
    </DashboardShell>
  );
}
