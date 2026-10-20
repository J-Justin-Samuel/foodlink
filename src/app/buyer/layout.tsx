import { DashboardShell } from "@/components/shared/dashboard-shell";

export default function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell roles={["BUYER", "ADMIN"]}>{children}</DashboardShell>;
}
