import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This area is restricted to a different account role.
      </p>
      <Link href="/" className="mt-4 text-sm font-medium text-primary underline">
        Back to home
      </Link>
    </div>
  );
}
