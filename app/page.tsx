import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          <Image
            src="/logo.png"
            alt="QuickSuuq"
            width={180}
            height={42}
            priority
            className="brand-logo-img"
          />
          <div>
            <p className="eyebrow">OFFICIAL PARTNER NETWORK</p>
            <p className="brand-title">Affiliate & Partner Management</p>
          </div>
        </div>
        <span className="env-pill">● Supabase PostgreSQL Live</span>
      </header>

      <section className="hero">
        <p className="eyebrow green">PRODUCTION READY · SOMALIA</p>
        <h1>Custom Affiliate Tracking & EVC Plus Mobile Payouts.</h1>
        <p className="intro">
          Full lifetime customer attribution, zero-PII salesperson transparency, automated 2% commission ledgers, and direct mobile money batch payout workflows integrated seamlessly with QuickSuuq&apos;s Shopify store.
        </p>
        <div className="status-row">
          <span className="status-dot" />
          <span>Shopify Cart & Webhook Engine Live</span>
          <span className="muted">·</span>
          <span>PostgreSQL 17 Database Active</span>
          <span className="muted">·</span>
          <span>Hormuud EVC Plus Settlement</span>
        </div>
      </section>

      {/* Two Direct Portals */}
      <section className="actions-grid">
        <Link href="/portal" className="action-box">
          <div className="box-icon">👤</div>
          <h3>Salesperson Affiliate Portal</h3>
          <p>
            For sales reps and affiliates to register with unique email, log in, view their live commission earnings, track attributed orders, and check EVC Plus mobile payouts.
          </p>
          <span className="btn-entry">Open Salesperson Portal →</span>
        </Link>

        <Link href="/admin" className="action-box">
          <div className="box-icon">🛡️</div>
          <h3>Shopify Admin Console</h3>
          <p>
            For store management to approve pending commissions, add or edit sales reps, manage commission rates, process payouts, and export EVC Plus disbursement batch CSVs.
          </p>
          <span className="btn-entry">Open Admin Console →</span>
        </Link>
      </section>

      <section className="section-head">
        <div>
          <p className="eyebrow">SYSTEM ARCHITECTURE</p>
          <h2>Core Affiliate Pipeline</h2>
        </div>
      </section>

      <section className="phase-grid">
        <article className="phase-card">
          <span className="phase-number">01</span>
          <h3>Cart Drawer Code</h3>
          <p>Captured in Shopify cart drawer before checkout. Validated real-time against active salesperson codes.</p>
        </article>
        <article className="phase-card">
          <span className="phase-number">02</span>
          <h3>Lifetime Phone Mapping</h3>
          <p>First order links customer phone permanently to salesperson. Future repeat orders auto-attribute without re-typing codes.</p>
        </article>
        <article className="phase-card">
          <span className="phase-number">03</span>
          <h3>Commission Ledger</h3>
          <p>Real-time Shopify webhooks compute 2% commissions, prevent duplicates, and adjust automatically for refunds/cancellations.</p>
        </article>
        <article className="phase-card">
          <span className="phase-number">04</span>
          <h3>EVC Plus Payouts</h3>
          <p>Batch commission approvals, Hormuud/Zaad transaction logging, and 1-click mobile money CSV export.</p>
        </article>
      </section>

      <footer className="portal-page-footer">
        QuickSuuq Somalia · Proprietary Affiliate Management Platform · Built with Next.js & Supabase
      </footer>
    </main>
  );
}
