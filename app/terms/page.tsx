'use client';

import Link from 'next/link';
import { ArrowLeft, FileText, Sparkles } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30">
      <nav className="border-b border-white/10 bg-black/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 w-8 h-8 rounded-lg flex items-center justify-center">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">SubText AI</span>
          </Link>
          <Link href="/" className="flex items-center text-gray-400 hover:text-white transition gap-2">
            <ArrowLeft size={18} /> Back to Home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <FileText size={32} className="text-purple-400" />
          <h1 className="text-3xl md:text-4xl font-bold">Terms of Service</h1>
        </div>

        <div className="space-y-6 text-gray-300 leading-relaxed">
          <p className="text-sm text-gray-500">Effective date: April 15, 2025</p>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using SubText AI ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Eligibility</h2>
            <p>You must be at least 13 years old to use the Service. By using SubText AI, you represent that you meet this age requirement.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Credits & Payments</h2>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Credits are purchased on a one‑time basis and never expire.</li>
              <li>Each decode or reply generation consumes one (1) credit.</li>
              <li>Payments are processed securely via PayPal. Refunds are handled on a case‑by‑case basis.</li>
              <li>We reserve the right to modify pricing, but changes will not affect previously purchased credits.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Use the Service for any illegal purpose or in violation of any laws.</li>
              <li>Harass, threaten, or impersonate others using our AI replies.</li>
              <li>Attempt to reverse engineer, scrape, or exploit the Service.</li>
              <li>Share your account credentials or resell credits without permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. AI‑Generated Content</h2>
            <p>The Service uses artificial intelligence to generate decodings and replies. You are solely responsible for how you use these outputs. We do not guarantee the accuracy, appropriateness, or legality of AI‑generated content. Do not rely on it for critical decisions.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Intellectual Property</h2>
            <p>All code, designs, and branding of SubText AI are owned by us. You retain ownership of the messages you submit, but you grant us a license to process them to provide the Service. AI‑generated replies are provided for your use without restriction.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Termination</h2>
            <p>We may suspend or terminate your account if you violate these Terms. You may delete your account at any time by contacting support. Upon termination, unused credits are non‑refundable unless required by law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Disclaimer of Warranties</h2>
            <p>The Service is provided "as is" without warranties of any kind. We do not warrant that the Service will be uninterrupted, error‑free, or secure.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, SubText AI shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid us in the past 12 months.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Governing Law</h2>
            <p>These Terms shall be governed by the laws of the State of Delaware, without regard to conflict of law principles.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Changes to Terms</h2>
            <p>We may update these Terms from time to time. Continued use after changes constitutes acceptance. Material changes will be notified via email or a prominent notice on the website.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Contact</h2>
            <p>For any questions regarding these Terms, please email <a href="mailto:legal@subtextai.com" className="text-purple-400 hover:underline">legal@subtextai.com</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 text-center text-gray-500 text-sm">
          <Link href="/" className="hover:text-purple-400 transition">← Back to Home</Link>
        </div>
      </main>
    </div>
  );
}