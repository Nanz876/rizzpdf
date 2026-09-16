import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How RizzPDF handles your files and data. Files are processed in your browser and never uploaded.",
  alternates: { canonical: "https://www.rizzpdf.com/privacy" },
  robots: { index: true, follow: true },
};

const UPDATED = "September 16, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar />
      <main className="max-w-3xl mx-auto px-5 py-14 space-y-8 text-[15px] leading-relaxed text-gray-700">
        <header>
          <h1 className="text-3xl font-black text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-400 mt-2">Last updated {UPDATED}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Your files never leave your device</h2>
          <p>
            Every PDF tool on RizzPDF runs inside your web browser using JavaScript. When you merge,
            split, compress, convert, sign, unlock or otherwise edit a PDF, the file is read and
            written on your own computer or phone. We do not upload your files to our servers, we
            cannot see them, and we do not store them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">What we do collect</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Tool usage counts.</strong> When you run a tool we record the tool name (for example &quot;merge&quot;) and, if you are signed in, your account ID. File names, contents and sizes are not included.</li>
            <li><strong>Pro unlock history.</strong> If you use Pro bulk unlock while signed in, we store the names of the files you unlocked so you can see your history. The files themselves are never uploaded.</li>
            <li><strong>Account data.</strong> If you create an account, our sign-in provider Clerk stores your email address and login details.</li>
            <li><strong>Payment data.</strong> Payments are handled by Stripe. We never see or store your card number. We store your Stripe customer and subscription IDs and your subscription status so we can tell whether you are a Pro member.</li>
            <li><strong>Day pass.</strong> If you buy a $1 day pass, your browser stores the Stripe checkout session ID so the pass can be verified for 24 hours. Clearing browser storage removes it.</li>
            <li><strong>Free batch counter.</strong> Your browser stores how many free batch runs you have used. This value stays on your device.</li>
            <li><strong>Email signups.</strong> If you enter your email to be notified about new features, we store that email address.</li>
            <li><strong>Analytics.</strong> We use Vercel Web Analytics, which records page views without cookies and without identifying you personally.</li>
            <li><strong>Server logs.</strong> Like any website, our hosting provider (Vercel) processes your IP address to serve pages and to rate-limit abuse. We do not use it to identify you.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Where data is stored</h2>
          <p>
            Account, subscription and Pro unlock-history records live in Supabase (hosted database), authentication in
            Clerk, and payments in Stripe. Each of these providers publishes its own privacy policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Cookies</h2>
          <p>
            We only set cookies needed for sign-in (Clerk). We do not use advertising cookies or
            cross-site tracking.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Deleting your data</h2>
          <p>
            Email <a href="mailto:support@rizzpdf.com" className="text-red-600 hover:underline">support@rizzpdf.com</a> from
            your account email and we will delete your account, subscription record and any stored
            email address within 30 days. Because your files are never uploaded, there are no files
            to delete on our side.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Changes</h2>
          <p>We will update the date at the top of this page whenever this policy changes.</p>
        </section>

        <p className="text-sm text-gray-400 pt-6 border-t border-gray-100">
          See also our <Link href="/terms" className="text-red-600 hover:underline">Terms of Service</Link>.
        </p>
      </main>
      <Footer />
    </div>
  );
}
