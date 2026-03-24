"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

function CheckIcon({ color }: { color: "green" | "red" | "amber" | "gray" }) {
  const styles = {
    green: "bg-green-100 text-green-600",
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-700",
    gray: "bg-gray-100 text-gray-300",
  };
  return (
    <span
      className={`w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 text-[9px] font-black ${styles[color]}`}
    >
      {color === "gray" ? "—" : "✓"}
    </span>
  );
}

function FeatureItem({
  icon,
  muted,
  children,
}: {
  icon: "green" | "red" | "amber" | "gray";
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] leading-snug">
      <CheckIcon color={icon} />
      <span className={muted ? "text-gray-400" : "text-gray-700"}>
        {children}
      </span>
    </li>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isSignedIn } = useUser();

  async function handleProClick() {
    if (!isSignedIn) {
      window.location.href = "/sign-up?redirect=/pricing";
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing: annual ? "annual" : "monthly" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleDayPass() {
    // Day pass uses the existing PaywallModal flow — redirect to tools
    window.location.href = "/tools";
  }

  const proMonthlyDisplay = annual ? "$4" : "$5";
  const proButtonLabel = loading
    ? "Redirecting…"
    : annual
    ? "Get Pro — $48/year →"
    : "Get Pro — $5/month →";

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-black">
            <span className="text-gray-900">Rizz</span>
            <span className="text-red-600">PDF</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-[13px] font-semibold text-gray-600 border border-gray-300 px-4 py-1.5 rounded-full hover:border-red-400 hover:text-red-600 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-[13px] font-bold bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-full transition-colors"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-white border-b border-gray-100 text-center py-14 px-6">
        <div className="inline-block bg-red-50 text-red-600 text-[11px] font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">
          Simple pricing
        </div>
        <h1 className="text-[38px] font-black text-gray-900 tracking-tight leading-tight mb-3">
          Do more with <span className="text-red-600">RizzPDF</span>
        </h1>
        <p className="text-[16px] text-gray-500 max-w-md mx-auto leading-relaxed mb-7">
          Start free — no card needed. Pay only when you need more. Every plan
          includes all 16 PDF tools.
        </p>

        {/* Billing toggle */}
        <button
          onClick={() => setAnnual((a) => !a)}
          className="inline-flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 cursor-pointer"
        >
          <span
            className={`text-[13px] font-semibold transition-colors ${
              !annual ? "text-gray-900" : "text-gray-400"
            }`}
          >
            Monthly
          </span>
          <div
            className={`relative w-11 h-6 rounded-full transition-colors ${
              annual ? "bg-red-600" : "bg-gray-200"
            }`}
          >
            <div
              className={`absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow transition-all ${
                annual ? "left-[23px]" : "left-[3px]"
              }`}
            />
          </div>
          <span
            className={`text-[13px] font-semibold transition-colors ${
              annual ? "text-gray-900" : "text-gray-400"
            }`}
          >
            Annual
          </span>
          <span
            className={`bg-red-600 text-white text-[11px] font-black px-2.5 py-1 rounded-md transition-opacity ${
              annual ? "opacity-100" : "opacity-0"
            }`}
          >
            Save 20%
          </span>
        </button>
      </div>

      {/* Cards */}
      <div className="max-w-[980px] mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">

          {/* Free */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-7">
              <div className="text-[11px] font-bold tracking-widest uppercase text-gray-400 mb-2.5">
                Free
              </div>
              <div className="flex items-baseline gap-0.5 mb-1.5">
                <span className="text-[22px] font-bold text-gray-900">$</span>
                <span className="text-[50px] font-black text-gray-900 leading-none tracking-tighter">
                  0
                </span>
              </div>
              <div className="text-[12px] text-gray-400 mb-5 h-4">&nbsp;</div>
              <button className="w-full py-3 rounded-xl text-[14px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
                Get started free
              </button>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="p-7">
              <div className="text-[11px] font-bold tracking-widest uppercase text-gray-400 mb-3.5">
                What&apos;s included
              </div>
              <ul className="flex flex-col gap-2.5">
                <FeatureItem icon="green">3 files per tool per session</FeatureItem>
                <FeatureItem icon="green">All 16 PDF tools</FeatureItem>
                <FeatureItem icon="green">No account required</FeatureItem>
                <FeatureItem icon="green">Files never leave your browser</FeatureItem>
                <FeatureItem icon="gray" muted>Up to 50MB per file</FeatureItem>
                <FeatureItem icon="gray" muted>No file history</FeatureItem>
              </ul>
            </div>
          </div>

          {/* Day Pass */}
          <div className="bg-white border-2 border-amber-400 rounded-2xl overflow-hidden">
            <div className="p-7">
              <div className="text-[11px] font-bold tracking-widest uppercase text-amber-600 mb-2.5">
                Day Pass
              </div>
              <div className="flex items-baseline gap-0.5 mb-1.5">
                <span className="text-[22px] font-bold text-gray-900">$</span>
                <span className="text-[50px] font-black text-gray-900 leading-none tracking-tighter">
                  1
                </span>
                <span className="text-[14px] text-gray-400 font-medium self-end pb-1.5">
                  /day
                </span>
              </div>
              <div className="text-[12px] text-gray-400 mb-5 h-4">
                One-time · expires after 24 hours
              </div>
              <button
                onClick={handleDayPass}
                className="w-full py-3 rounded-xl text-[14px] font-bold bg-amber-400 hover:bg-amber-500 text-white transition-colors"
              >
                Buy day pass →
              </button>
              {annual && (
                <p className="text-[11px] text-amber-600 font-semibold text-center mt-2">
                  Same price — no subscription needed
                </p>
              )}
            </div>
            <div className="h-px bg-gray-100" />
            <div className="p-7">
              <div className="text-[11px] font-bold tracking-widest uppercase text-gray-400 mb-3.5">
                What&apos;s included
              </div>
              <ul className="flex flex-col gap-2.5">
                <FeatureItem icon="amber">
                  <strong>Unlimited files</strong> for 24 hrs
                </FeatureItem>
                <FeatureItem icon="amber">All 16 PDF tools</FeatureItem>
                <FeatureItem icon="amber">No account required</FeatureItem>
                <FeatureItem icon="amber">Files stay in your browser</FeatureItem>
                <FeatureItem icon="gray" muted>Up to 50MB per file</FeatureItem>
                <FeatureItem icon="gray" muted>No file history</FeatureItem>
              </ul>
            </div>
          </div>

          {/* Pro */}
          <div className="bg-white border-2 border-red-500 rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black tracking-widest uppercase px-4 py-1 rounded-b-lg">
              Most popular
            </div>
            <div className="p-7 pt-9 bg-gradient-to-b from-red-50/60 to-white">
              <div className="text-[11px] font-bold tracking-widest uppercase text-red-600 mb-2.5">
                Pro
              </div>
              <div className="flex items-baseline gap-0.5 mb-1.5">
                <span className="text-[22px] font-bold text-gray-900">$</span>
                <span className="text-[50px] font-black text-gray-900 leading-none tracking-tighter transition-all">
                  {proMonthlyDisplay}
                </span>
                <span className="text-[14px] text-gray-400 font-medium self-end pb-1.5">
                  /mo
                </span>
              </div>
              <div className="text-[12px] text-gray-400 mb-5 h-4">
                {annual
                  ? "Billed $48/year · save $12 · cancel anytime"
                  : "Billed $5/month · cancel anytime"}
              </div>
              <button
                onClick={handleProClick}
                disabled={loading}
                className="w-full py-3 rounded-xl text-[14px] font-bold bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white transition-colors shadow-[0_4px_14px_rgba(220,38,38,0.35)]"
              >
                {proButtonLabel}
              </button>
            </div>
            <div className="h-px bg-red-100" />
            <div className="p-7">
              <div className="text-[11px] font-bold tracking-widest uppercase text-gray-400 mb-3.5">
                Everything in Free, plus
              </div>
              <ul className="flex flex-col gap-2.5">
                <FeatureItem icon="red">
                  <strong>Unlimited files</strong>, always
                </FeatureItem>
                <FeatureItem icon="red">All 16 PDF tools</FeatureItem>
                <FeatureItem icon="red">
                  <strong>200MB</strong> per file
                </FeatureItem>
                <FeatureItem icon="red">Full file history</FeatureItem>
                <FeatureItem icon="red">Files stay in your browser</FeatureItem>
                <FeatureItem icon="red">Priority support</FeatureItem>
              </ul>
            </div>
          </div>

        </div>
      </div>

      {/* Trust strip */}
      <div className="flex flex-wrap justify-center gap-6 px-6 pb-12 text-[12px] text-gray-500 font-medium">
        <span>🔒 Files never leave your browser</span>
        <span>✕ Cancel Pro any time</span>
        <span>💳 No card for free tier</span>
        <span>⚡ Instant access after payment</span>
      </div>

      {/* Comparison table */}
      <div className="max-w-[760px] mx-auto px-6 pb-16">
        <h2 className="text-[22px] font-black text-gray-900 text-center mb-2">
          Full comparison
        </h2>
        <p className="text-[14px] text-gray-500 text-center mb-7">
          Everything you need to choose the right plan
        </p>
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="py-3.5 px-5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Feature
                </th>
                <th className="py-3.5 px-4 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Free
                </th>
                <th className="py-3.5 px-4 text-center text-[11px] font-bold uppercase tracking-wider text-amber-600">
                  Day Pass
                </th>
                <th className="py-3.5 px-4 text-center text-[11px] font-bold uppercase tracking-wider text-red-600">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: "Files per session",
                  free: "3 per tool",
                  day: <span className="text-amber-600 font-semibold">Unlimited</span>,
                  pro: <span className="text-red-600 font-bold">Unlimited</span>,
                },
                {
                  label: "Max file size",
                  free: "50MB",
                  day: <span className="text-amber-600 font-semibold">50MB</span>,
                  pro: <span className="text-red-600 font-bold">200MB</span>,
                },
                {
                  label: "All 16 PDF tools",
                  free: "✓",
                  day: "✓",
                  pro: "✓",
                  greenAll: true,
                },
                {
                  label: "No account needed",
                  free: "✓",
                  day: "✓",
                  pro: "Req.",
                  greenFreeDay: true,
                },
                {
                  label: "Files stay in browser",
                  free: "✓",
                  day: "✓",
                  pro: "✓",
                  greenAll: true,
                },
                {
                  label: "File history",
                  free: "—",
                  day: "—",
                  pro: <span className="text-red-600 font-bold text-[16px]">✓</span>,
                  highlight: true,
                },
                {
                  label: "Priority support",
                  free: "—",
                  day: "—",
                  pro: <span className="text-red-600 font-bold text-[16px]">✓</span>,
                  highlight: true,
                },
                {
                  label: "Price",
                  free: "Free forever",
                  day: <span className="text-amber-600 font-semibold">$1 one-time</span>,
                  pro: (
                    <span className="text-red-600 font-bold">
                      {annual ? "$4/mo (billed $48/yr)" : "$5/month"}
                    </span>
                  ),
                },
              ].map((row, i) => (
                <tr
                  key={i}
                  className={row.highlight ? "bg-red-50/50" : "hover:bg-gray-50/50"}
                >
                  <td className="py-3 px-5 text-[13px] font-medium text-gray-700 border-t border-gray-100">
                    {row.label}
                  </td>
                  <td className={`py-3 px-4 text-center text-[13px] border-t border-gray-100 ${row.greenAll ? "text-green-600 text-[16px]" : "text-gray-500"}`}>
                    {row.free}
                  </td>
                  <td className={`py-3 px-4 text-center text-[13px] border-t border-gray-100 ${row.greenAll || row.greenFreeDay ? "text-green-600 text-[16px]" : "text-gray-500"}`}>
                    {row.day}
                  </td>
                  <td className={`py-3 px-4 text-center text-[13px] border-t border-gray-100 ${row.greenAll ? "text-green-600 text-[16px]" : "text-gray-500"}`}>
                    {row.pro}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-[640px] mx-auto px-6 pb-20">
        <h2 className="text-[22px] font-black text-gray-900 text-center mb-2">
          Common questions
        </h2>
        <p className="text-[14px] text-gray-500 text-center mb-7">
          Need something else?{" "}
          <a href="mailto:hello@rizzpdf.com" className="text-red-600 font-semibold">
            Contact us →
          </a>
        </p>
        {[
          {
            q: "Do my files get uploaded anywhere?",
            a: "Never. Every tool runs entirely in your browser using JavaScript. Your files don't touch our servers — not even temporarily.",
          },
          {
            q: "What's the difference between Day Pass and Pro?",
            a: "Day Pass is a $1 one-time unlock for 24 hours — perfect if you have a batch to process today and don't need an account. Pro is $5/month (or $4/month billed annually) and adds 200MB files, full history, and priority support.",
          },
          {
            q: "Can I cancel Pro any time?",
            a: "Yes — cancel any time from your dashboard. No questions asked, no cancellation fees, no gotchas.",
          },
          {
            q: "What counts as a 'file' on the free tier?",
            a: "3 files per tool per browser session. So you can merge 3 PDFs, compress 3 PDFs, and convert 3 PDFs — all free in the same session across different tools.",
          },
          {
            q: "Is annual billing worth it?",
            a: "If you use RizzPDF regularly, the annual plan saves you $12 a year — two months free. You're billed $48 upfront instead of $5/month. You can still cancel any time.",
          },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-white border border-gray-100 rounded-xl px-5 py-4 mb-2.5"
          >
            <div className="text-[14px] font-bold text-gray-900 mb-1.5 flex justify-between items-center">
              {item.q}
              <span className="text-gray-300 text-lg font-light ml-4">+</span>
            </div>
            <div className="text-[13px] text-gray-500 leading-relaxed">
              {item.a}
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div
        className="text-center py-16 px-6"
        style={{
          background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
        }}
      >
        <h2 className="text-[26px] font-black text-white mb-2.5 tracking-tight">
          Start free — no card needed
        </h2>
        <p className="text-white/80 text-[15px] mb-7">
          All 16 PDF tools, right in your browser. Upgrade only when you need
          more.
        </p>
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 bg-white text-red-600 font-black px-8 py-3.5 rounded-xl text-[15px] shadow-lg hover:opacity-95 transition-opacity"
        >
          Try RizzPDF free →
        </Link>
        <p className="text-white/50 text-[12px] mt-4">
          🔒 Files never leave your browser · Privacy guaranteed
        </p>
      </div>
    </div>
  );
}
