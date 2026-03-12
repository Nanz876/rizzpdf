import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserTier } from "@/lib/tier";
import BulkUnlockClient from "@/components/BulkUnlockClient";

export default async function BulkPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const tier = await getUserTier(userId);
  if (tier !== "pro") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
          >
            ← Dashboard
          </Link>
          <span className="text-gray-300">|</span>
          <Link
            href="/"
            className="text-xl font-black bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent"
          >
            RizzPDF
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">CSV Bulk Unlock</h1>
          <p className="text-gray-500 mt-1">
            Upload a CSV with filenames and passwords. We&apos;ll unlock all your
            PDFs and bundle them into a ZIP download — all in your browser.
          </p>
        </div>

        {/* Format guide */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">
            CSV Format
          </h2>
          <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 overflow-x-auto">
{`filename,password
report_q1.pdf,mypassword123
invoice_jan.pdf,securepass
contract.pdf,letmein`}
          </pre>
          <p className="text-xs text-gray-400 mt-2">
            First row must be a header. Filenames must match the files you upload
            below.
          </p>
        </div>

        <BulkUnlockClient />
      </main>
    </div>
  );
}
