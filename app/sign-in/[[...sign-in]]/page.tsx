import { SignIn } from "@clerk/nextjs";
import { safeRedirect } from "@/lib/safe-redirect";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  // Send the visitor back to what they were doing (e.g. a Pro checkout they
  // started on /pricing) instead of the Clerk default of the homepage.
  const { redirect_url } = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
      <SignIn forceRedirectUrl={safeRedirect(redirect_url)} />
    </div>
  );
}
