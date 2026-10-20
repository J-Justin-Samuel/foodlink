import { DashboardShell } from "@/components/shared/dashboard-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell roles={["ADMIN"]}>{children}</DashboardShell>;
}
