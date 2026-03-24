import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unlock PDF Online Free — Remove Password Instantly",
  description:
    "Remove PDF password protection instantly in your browser. Free for 3 files, no sign-up, no uploads. Unlock any password-protected PDF in seconds.",
  keywords: [
    "unlock PDF",
    "remove PDF password",
    "PDF password remover free",
    "unlock password protected PDF online",
    "decrypt PDF online",
    "PDF unlocker no email",
  ],
  alternates: { canonical: "https://www.rizzpdf.com/tools/unlock" },
  openGraph: {
    title: "Unlock PDF Online Free — Remove Password Instantly",
    description: "Remove PDF password protection instantly in your browser. Free for 3 files, no sign-up required.",
    url: "https://www.rizzpdf.com/tools/unlock",
  },
};

export default function UnlockLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
