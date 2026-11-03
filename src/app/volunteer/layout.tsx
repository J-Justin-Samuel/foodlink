import { DashboardShell } from "@/components/shared/dashboard-shell";

export default function VolunteerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell roles={["VOLUNTEER", "ADMIN"]}>{children}</DashboardShell>
  );
}
