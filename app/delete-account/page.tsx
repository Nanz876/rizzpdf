import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Delete your RizzPDF account",
  description:
    "How to delete your RizzPDF account and everything stored with it, from the Android app or by email.",
  alternates: { canonical: "https://www.rizzpdf.com/delete-account" },
  robots: { index: true, follow: true },
};

const UPDATED = "September 23, 2026";

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar />
      <main className="max-w-3xl mx-auto px-5 py-14 space-y-8 text-[15px] leading-relaxed text-gray-700">
        <header>
          <h1 className="text-3xl font-black text-gray-900">
            Delete your RizzPDF account
          </h1>
          <p className="text-sm text-gray-400 mt-2">Last updated {UPDATED}</p>
        </header>

        <section className="space-y-3">
          <p>
            This page explains how to delete your RizzPDF account and everything stored with it.
            It applies to both the RizzPDF Android app and the website at rizzpdf.com — they share
            one account.
          </p>
          <p className="font-semibold text-gray-900">
            Your PDFs are not involved. They are never uploaded, so there is nothing of yours to
            delete on our side.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">In the Android app</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Open the RizzPDF app.</li>
            <li>Tap the <strong>Account</strong> tab.</li>
            <li>Tap <strong>Delete Account</strong>.</li>
            <li>Confirm when asked. The deletion happens straight away.</li>
          </ol>
          <p>
            You need to be signed in to see the button. If you have never signed in, there is no
            account to delete — the app works without one.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">By email</h2>
          <p>
            Email{" "}
            <a href="mailto:mcalaa7@gmail.com" className="text-red-600 hover:underline">
              mcalaa7@gmail.com
            </a>{" "}
            from the address on your account and ask for it to be deleted. We will do it and confirm
            within 30 days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">What is deleted</h2>
          <p>All of the following is removed at the moment you confirm:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Your account and sign-in details</strong> — your email address and the record
              that lets you sign in.
            </li>
            <li>
              <strong>Your subscription record</strong>, including the customer and subscription
              identifiers we hold for payment processing.
            </li>
            <li>
              <strong>Your unlock history</strong> — the list of files you unlocked while signed in.
            </li>
            <li>
              <strong>Your tool usage records</strong> — the counts of which tools you used.
            </li>
          </ul>
          <p>
            If you have a paid subscription bought on the website, it is cancelled immediately as
            part of the deletion, so you are not billed again.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">What is kept, and for how long</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Payment records.</strong> Our payment provider keeps a record of past
              transactions, and we cannot delete these. Tax and accounting law requires them to be
              retained. They are held by the payment provider, not by us.
            </li>
            <li>
              <strong>A subscription bought through Google Play.</strong> Google is the seller, so
              deleting your RizzPDF account does not cancel it. Cancel it in the Play Store under
              Payments and subscriptions.
            </li>
            <li>
              <strong>Launch-email sign-ups.</strong> If you gave us your email address to be told
              about new features, that is stored separately and is not linked to your account, so
              account deletion does not remove it. Email us and we will delete that too.
            </li>
            <li>
              <strong>Routine backups.</strong> Deleted records can survive in encrypted database
              backups until those backups expire, which is no longer than 30 days.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Deleting the app is not the same thing</h2>
          <p>
            Uninstalling the app removes the documents on your phone, because that is the only place
            they exist. It does not delete your account. Use the steps above for that.
          </p>
        </section>

        <section className="space-y-3">
          <p>
            See our{" "}
            <Link href="/privacy" className="text-red-600 hover:underline">
              Privacy Policy
            </Link>{" "}
            for what we collect and why.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
