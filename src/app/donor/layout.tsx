import { DashboardShell } from "@/components/shared/dashboard-shell";

export default function DonorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell roles={["DONOR", "ADMIN"]}>{children}</DashboardShell>;
}
