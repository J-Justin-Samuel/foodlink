import { DashboardShell } from "@/components/shared/dashboard-shell";

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell roles={["DONOR", "VOLUNTEER", "NGO", "BUYER", "ADMIN"]}>
      {children}
    </DashboardShell>
  );
}
