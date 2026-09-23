import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using RizzPDF's free and paid PDF tools on the web and in the Android app.",
  alternates: { canonical: "https://www.rizzpdf.com/terms" },
  robots: { index: true, follow: true },
};

const UPDATED = "September 22, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar />
      <main className="max-w-3xl mx-auto px-5 py-14 space-y-8 text-[15px] leading-relaxed text-gray-700">
        <header>
          <h1 className="text-3xl font-black text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-400 mt-2">Last updated {UPDATED}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">The service</h2>
          <p>
            RizzPDF provides PDF tools that run on your own device: in your web browser at
            rizzpdf.com, and in the RizzPDF Android app. By using either, you agree to these terms.
            If you do not agree, please do not use the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Plans and payment</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Free.</strong> All single-file tools are free with no usage limit. Batch processing includes three free runs, counted on your own device.</li>
            <li><strong>Pro.</strong> A monthly or annual subscription. Access continues until the end of the period you have paid for.</li>
            <li><strong>If you subscribed on the website,</strong> Stripe bills you and you can cancel at any time from your dashboard.</li>
            <li><strong>If you subscribed in the Android app,</strong> Google Play bills you and you must cancel through your Google Play subscriptions settings. We cannot cancel a Google Play subscription on your behalf.</li>
          </ul>
          <p>
            Refunds for subscriptions bought on the website: if a tool fails to work for you, email{" "}
            <a href="mailto:mcalaa7@gmail.com" className="text-red-600 hover:underline">mcalaa7@gmail.com</a>{" "}
            within 7 days of payment and we will refund the most recent subscription charge.
          </p>
          <p>
            Refunds for subscriptions bought in the Android app are handled by Google under the
            Google Play refund policy, because Google is the seller. Email us anyway if something is
            wrong and we will help you sort it out.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Acceptable use</h2>
          <p>
            You may only process files you have the right to use. Do not use RizzPDF to remove
            protection from documents you are not authorised to access, or to break the law. Do not
            attempt to disrupt the service or circumvent payment.
          </p>
          <p>
            Your use of the Android app is also subject to the Google Play Terms of Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">No warranty</h2>
          <p>
            The service is provided &quot;as is&quot;. PDF processing runs on your device and results
            depend on the input file. Keep a copy of your original files. To the fullest extent
            permitted by law, RizzPDF is not liable for any loss arising from use of the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Changes</h2>
          <p>We may update these terms; the date above will change when we do. Continued use means you accept the updated terms.</p>
        </section>

        <p className="text-sm text-gray-400 pt-6 border-t border-gray-100">
          See also our <Link href="/privacy" className="text-red-600 hover:underline">Privacy Policy</Link>.
        </p>
      </main>
      <Footer />
    </div>
  );
}
