import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How RizzPDF handles your files and data. Files are processed on your own device and never uploaded.",
  alternates: { canonical: "https://www.rizzpdf.com/privacy" },
  robots: { index: true, follow: true },
};

const UPDATED = "September 23, 2026";

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
            Every PDF tool on RizzPDF runs on your own device. On the website, tools run inside your
            web browser using JavaScript. In the RizzPDF Android app, tools run on your phone. When
            you merge, split, compress, convert, sign, unlock or otherwise edit a PDF, the file is
            read and written locally. We do not upload your files to our servers, we cannot see
            them, and we do not store them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">The RizzPDF Android app</h2>
          <p>
            The app works without an account. You can open, read and edit PDFs without signing in,
            and nothing about your documents is sent anywhere.
          </p>
          <p>
            Documents you add to your library, and the files the tools produce, are stored only on
            your phone. Deleting the app deletes them. They are never uploaded, and they are not
            backed up to us.
          </p>
          <p>
            The app contacts our servers in two cases, both of them only when you are signed
            in. It asks rizzpdf.com whether your account has Pro, so that features you have paid
            for are available on your phone; that request contains your sign-in token and nothing
            else, and it returns only your subscription tier. And if you tap Delete Account, it
            asks us to delete your account and the records listed below. Nothing about your
            documents is sent in either case.
          </p>
          <p>
            The app does not sell anything. There is no way to buy Pro inside it, and it sends
            nothing to a payment provider. If you are a Pro member, you subscribed on the website
            and Stripe handled it there. Should we ever add in-app purchases, they would be handled
            by Google Play and by our subscription provider RevenueCat, we would still never see
            your payment details, and we would update this page before that shipped.
          </p>
          <p>
            The app contains no advertising and no third-party analytics or tracking.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">What we do collect</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Tool usage counts (website only).</strong> When you run a tool on the website we record the tool name (for example &quot;merge&quot;) and, if you are signed in, your account ID. File names, contents and sizes are not included.</li>
            <li><strong>Pro unlock history (website only).</strong> If you use Pro bulk unlock while signed in, we store the names of the files you unlocked so you can see your history. The files themselves are never uploaded.</li>
            <li><strong>Account data.</strong> If you create an account, our sign-in provider Clerk stores your email address and login details.</li>
            <li><strong>Payment data.</strong> Payments are handled by Stripe. We never see or store your card number. We store your Stripe customer and subscription IDs and your subscription status so we can tell whether you are a Pro member.</li>
            <li><strong>Free batch counter.</strong> How many free batch runs you have used is stored on your device, in your browser or in the app. It is not sent to us.</li>
            <li><strong>Email signups.</strong> If you enter your email to be notified about new features, we store that email address.</li>
            <li><strong>Analytics.</strong> We use Vercel Web Analytics, which records page views without cookies and without identifying you personally.</li>
            <li><strong>Server logs.</strong> Like any website, our hosting provider (Vercel) processes your IP address to serve pages and to rate-limit abuse. We do not use it to identify you.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Where data is stored</h2>
          <p>
            Account, subscription and Pro unlock-history records live in Supabase (hosted database), authentication in
            Clerk, and payments in Stripe. Each of these providers publishes its own privacy
            policy. Subscriptions are sold on the website only, so no purchase data is held by
            Google Play for RizzPDF.
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
          <h2 className="text-xl font-bold text-gray-900">Deleting your account and data</h2>
          <p>
            In the RizzPDF Android app, open the <strong>Account</strong> tab and tap{" "}
            <strong>Delete Account</strong>. Your account, your subscription record, your unlock
            history and your tool usage records are removed straight away, and an active website
            subscription is cancelled at the same time so you are not billed again.
          </p>
          <p>
            You can also email{" "}
            <a href="mailto:mcalaa7@gmail.com" className="text-red-600 hover:underline">mcalaa7@gmail.com</a> from
            your account email address, and we will delete it within 30 days and confirm when it is
            done. Our{" "}
            <Link href="/delete-account" className="text-red-600 hover:underline">account deletion page</Link>{" "}
            sets out exactly what is removed and what is kept.
          </p>
          <p>
            Because your files are never uploaded, there are no files to delete on our side.
            Documents stored in the Android app live only on your phone — remove them in the app, or
            uninstall it.
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
