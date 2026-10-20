import { DashboardShell } from "@/components/shared/dashboard-shell";

export default function NgoLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell roles={["NGO", "ADMIN"]}>{children}</DashboardShell>;
}
