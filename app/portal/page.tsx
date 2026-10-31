"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface Salesperson {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  commission_rate: number;
}

interface Stats {
  totalOrders: number;
  totalSales: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  totalEarned: number;
}

interface CommissionOrder {
  id: string;
  order_number: string;
  currency: string;
  eligible_amount: string;
  commission_rate: string;
  commission_amount: string;
  status: "PENDING" | "APPROVED" | "PAID" | "VOIDED";
  created_at: string;
  paid_at: string | null;
}

interface Payout {
  id: string;
  amount: string;
  payment_method: string;
  transaction_ref: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export default function SalespersonPortalPage() {
  const [loading, setLoading] = useState(true);
  const [salesperson, setSalesperson] = useState<Salesperson | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<CommissionOrder[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  // Auth mode: "login" or "register"
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCode, setRegCode] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

  // First-time PIN/password setup state (if needed for old legacy reps)
  const [setupRep, setSetupRep] = useState<{ id: string; name: string; code: string; email: string | null } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Active view tab
  const [activeTab, setActiveTab] = useState<"orders" | "payouts">("orders");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch session on mount
  useEffect(() => {
    fetchSession();
  }, []);

  async function fetchSession() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/salesperson/me");
      if (res.ok) {
        const data = await res.json();
        setSalesperson(data.salesperson);
        setStats(data.stats);
        setOrders(data.orders || []);
        setPayouts(data.payouts || []);
      } else {
        setSalesperson(null);
      }
    } catch {
      setSalesperson(null);
    } finally {
      setLoading(false);
    }
  }

  // Handle Login with Email & Password
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/salesperson/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Login failed. Please check your credentials.");
        return;
      }

      if (data.requiresPinSetup) {
        setSetupRep({ id: data.salespersonId, name: data.name, code: data.code, email: data.email });
        return;
      }

      await fetchSession();
    } catch {
      setLoginError("Network connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Registration with Unique Email, Compulsory Somali Phone, Unique Code, and Password
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");

    if (!regName.trim()) {
      setRegError("Please enter your full name.");
      return;
    }

    if (!regEmail.trim() || !regEmail.includes("@")) {
      setRegError("Please enter a valid email address.");
      return;
    }

    if (!regPhone.trim()) {
      setRegError("Somali phone number is compulsory for EVC Plus commission payouts.");
      return;
    }

    if (!regCode.trim() || regCode.length < 2) {
      setRegError("Please choose a referral code (at least 2 letters or numbers).");
      return;
    }

    if (!regPassword || regPassword.length < 6) {
      setRegError("Password must be at least 6 characters long.");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError("Passwords do not match. Please re-enter.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/salesperson/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          phone: regPhone,
          code: regCode,
          password: regPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error || "Registration failed. Please try again.");
        return;
      }

      setRegSuccess("Account created successfully! Loading your dashboard...");
      await fetchSession();
    } catch {
      setRegError("Network connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Legacy PIN/Password Setup
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    if (!newPassword || newPassword.length < 4) {
      setLoginError("Password or PIN must be at least 4 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLoginError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/salesperson/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salespersonId: setupRep?.id, pin: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Failed to set password.");
        return;
      }
      setSetupRep(null);
      await fetchSession();
    } catch {
      setLoginError("Failed to set password. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/salesperson/logout", { method: "POST" });
    setSalesperson(null);
    setStats(null);
    setOrders([]);
    setPayouts([]);
    setLoginEmail("");
    setLoginPassword("");
  }

  function copyReferralCode() {
    if (!salesperson) return;
    navigator.clipboard.writeText(salesperson.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function copyReferralLink() {
    if (!salesperson) return;
    const link = `https://quicksuuq-test.myshopify.com/?ref=${encodeURIComponent(salesperson.code)}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  if (loading) {
    return (
      <main className="portal-container">
        <div className="loader-box">
          <div className="spinner" />
          <p>Connecting to QuickSuuq Affiliate Portal...</p>
        </div>
      </main>
    );
  }

  // 1. Unauthenticated Login / Register Screen
  if (!salesperson) {
    return (
      <main className="portal-container">
        <div className="portal-card">
          <div className="portal-header">
            <Link href="/" className="brand-logo-wrap">
              <Image
                src="/logo.png"
                alt="QuickSuuq"
                width={170}
                height={40}
                priority
                className="brand-logo-img"
              />
            </Link>
            <h1>Affiliate Portal</h1>
            <p className="subtitle">
              Earn 2% commission on every order. Payouts sent directly via EVC Plus.
            </p>
          </div>

          {setupRep ? (
            <form onSubmit={handleSetPassword} className="portal-form">
              <div className="welcome-banner">
                <p>Welcome, <strong>{setupRep.name}</strong> ({setupRep.code})!</p>
                <span>Please set a secure password or 4-digit PIN for your account.</span>
              </div>

              {loginError && <div className="error-alert">{loginError}</div>}

              <div className="form-group">
                <label>Create Password / PIN</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Confirm Password / PIN</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Saving..." : "Save & Access Dashboard"}
              </button>
              <button
                type="button"
                onClick={() => { setSetupRep(null); setLoginError(""); }}
                className="btn-link"
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <div>
              {/* Auth Mode Tabs */}
              <div className="auth-tabs">
                <button
                  type="button"
                  className={`auth-tab ${authMode === "login" ? "active" : ""}`}
                  onClick={() => { setAuthMode("login"); setLoginError(""); setRegError(""); }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`auth-tab ${authMode === "register" ? "active" : ""}`}
                  onClick={() => { setAuthMode("register"); setLoginError(""); setRegError(""); }}
                >
                  Register as Affiliate
                </button>
              </div>

              {authMode === "login" ? (
                /* Login Form */
                <form onSubmit={handleLogin} className="portal-form">
                  {loginError && <div className="error-alert">{loginError}</div>}

                  <div className="form-group">
                    <label>Registered Email or Referral Code</label>
                    <input
                      type="text"
                      placeholder="e.g. abdalla@example.com or ABDALLA10"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      autoFocus
                    />
                    <span className="field-hint">Log in using your unique email address or referral code.</span>
                  </div>

                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" disabled={submitting} className="btn-primary">
                    {submitting ? "Signing in..." : "Sign In to Portal"}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAuthMode("register"); setLoginError(""); }}
                    className="btn-link"
                  >
                    Don&apos;t have an affiliate account? Register here →
                  </button>
                </form>
              ) : (
                /* Register Form */
                <form onSubmit={handleRegister} className="portal-form">
                  {regError && <div className="error-alert">{regError}</div>}
                  {regSuccess && <div className="success-alert">{regSuccess}</div>}

                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Abdullahi Aweis Mohamed"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address (Unique Login)</label>
                    <input
                      type="email"
                      placeholder="e.g. abdalla@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                    <span className="field-hint">Used to sign in. Every salesperson has their own unique email.</span>
                  </div>

                  <div className="form-group">
                    <div className="form-label-row">
                      <label>Somali Phone Number</label>
                      <span className="compulsory-badge">Compulsory</span>
                    </div>
                    <input
                      type="tel"
                      placeholder="e.g. 61 102 4011 or +252611024011"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      required
                    />
                    <span className="field-hint">
                      Compulsory for Hormuud EVC Plus mobile money commission payouts.
                    </span>
                  </div>

                  <div className="form-group">
                    <label>Desired Referral Code</label>
                    <input
                      type="text"
                      placeholder="e.g. ABDALLA10 or ALI100"
                      value={regCode}
                      onChange={(e) => setRegCode(e.target.value.toUpperCase())}
                      maxLength={30}
                      required
                    />
                    <span className="field-hint">Customers use this code at checkout to credit your commissions.</span>
                  </div>

                  <div className="form-group">
                    <label>Password (Min 6 Characters)</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Confirm Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" disabled={submitting} className="btn-primary">
                    {submitting ? "Creating Account..." : "Create My Affiliate Account"}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAuthMode("login"); setRegError(""); }}
                    className="btn-link"
                  >
                    Already have an account? Sign in here →
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="portal-footer">
            <Link href="/" className="back-link">← Return to QuickSuuq Homepage</Link>
          </div>
        </div>
      </main>
    );
  }

  // 2. Authenticated Salesperson Dashboard
  const ratePercent = (salesperson.commission_rate * 100).toFixed(0);

  return (
    <main className="portal-dashboard">
      {/* Top Bar with QuickSuuq Logo and Salesperson Info */}
      <header className="dashboard-topbar">
        <div className="brand-group">
          <Link href="/" className="brand-logo-wrap">
            <Image
              src="/logo.png"
              alt="QuickSuuq"
              width={160}
              height={38}
              priority
              className="brand-logo-img"
            />
          </Link>
          <div className="rep-header-info">
            <h2 className="rep-name">{salesperson.name}</h2>
            <div className="rep-meta">
              <span>{salesperson.email || "No email set"}</span>
              {salesperson.phone && (
                <>
                  <span className="muted">·</span>
                  <span className="rep-phone-tag">EVC Plus: +252 {salesperson.phone}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="rate-badge live">{ratePercent}% Commission Rate</span>
          <button onClick={handleLogout} className="btn-logout">
            Sign Out
          </button>
        </div>
      </header>

      {/* Shareable Referral Banner */}
      <section className="share-card">
        <span className="share-eyebrow">Your Official QuickSuuq Referral Code</span>
        <div className="code-display">
          <span className="code-tag">{salesperson.code}</span>
          <button onClick={copyReferralCode} className="btn-copy">
            {copiedCode ? "✓ Code Copied!" : "Copy Code"}
          </button>
          <button onClick={copyReferralLink} className="btn-copy">
            {copiedLink ? "✓ Link Copied!" : "Copy Store Link"}
          </button>
        </div>
        <p className="share-hint">
          Share your referral code or direct link with customers. When they enter <strong style={{ color: "#a3e8d2" }}>{salesperson.code}</strong> in the cart drawer, you earn {ratePercent}% on their entire order. Plus, their phone number is permanently linked to you for all future repeat purchases!
        </p>
      </section>

      {/* Real-time Earnings Metric Cards */}
      <section className="metrics-grid">
        <article className="metric-card">
          <span className="metric-label">Attributed Orders</span>
          <span className="metric-value">{stats?.totalOrders ?? 0}</span>
          <span className="metric-sub">Shopify customer orders</span>
        </article>

        <article className="metric-card">
          <span className="metric-label">Total Sales Volume</span>
          <span className="metric-value">${(stats?.totalSales ?? 0).toFixed(2)}</span>
          <span className="metric-sub">Customer purchases</span>
        </article>

        <article className="metric-card highlight">
          <span className="metric-label">Approved Commission</span>
          <span className="metric-value teal">${(stats?.approvedCommission ?? 0).toFixed(2)}</span>
          <span className="metric-sub">Ready for next EVC Plus batch</span>
        </article>

        <article className="metric-card highlight-pending">
          <span className="metric-label">Pending Commission</span>
          <span className="metric-value yellow">${(stats?.pendingCommission ?? 0).toFixed(2)}</span>
          <span className="metric-sub">Under 24h review / delivered</span>
        </article>
      </section>

      {/* Activity Tables (Orders & Payouts) */}
      <section className="content-card">
        <div className="tabs-header">
          <button
            className={`tab-btn ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            Attributed Orders ({orders.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "payouts" ? "active" : ""}`}
            onClick={() => setActiveTab("payouts")}
          >
            Payout History ({payouts.length})
          </button>
        </div>

        {activeTab === "orders" ? (
          orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🛍️</div>
              <h3>No Attributed Orders Yet</h3>
              <p>
                Share your referral code <strong>{salesperson.code}</strong> with your friends and customers on WhatsApp, TikTok, or Facebook to start earning commissions!
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Eligible Sales</th>
                    <th>Rate</th>
                    <th>Commission</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="bold-cell">#{order.order_number}</td>
                      <td className="muted-text">
                        {new Date(order.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="bold-cell">${Number(order.eligible_amount).toFixed(2)}</td>
                      <td>{(Number(order.commission_rate) * 100).toFixed(0)}%</td>
                      <td className="teal-cell">${Number(order.commission_amount).toFixed(2)}</td>
                      <td>
                        <span className={`status-pill ${order.status.toLowerCase()}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : payouts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💸</div>
            <h3>No Payouts Processed Yet</h3>
            <p>
              When admin approves your pending commissions, payments are sent directly to your EVC Plus mobile phone number ({salesperson.phone ? `+252 ${salesperson.phone}` : "Somali phone"}).
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Payout ID</th>
                  <th>Amount</th>
                  <th>Payment Method</th>
                  <th>Reference / Tx ID</th>
                  <th>Status</th>
                  <th>Paid Date</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="mono-cell">{payout.id.slice(0, 8)}...</td>
                    <td className="teal-cell">${Number(payout.amount).toFixed(2)}</td>
                    <td>
                      <span className="payment-pill">{payout.payment_method}</span>
                    </td>
                    <td className="mono-cell">{payout.transaction_ref || "Pending"}</td>
                    <td>
                      <span className={`status-pill ${payout.status.toLowerCase()}`}>
                        {payout.status}
                      </span>
                    </td>
                    <td className="muted-text">
                      {payout.paid_at
                        ? new Date(payout.paid_at).toLocaleDateString()
                        : "Processing"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="portal-page-footer">
        QuickSuuq Somalia · Transparent Affiliate Tracking · EVC Plus Direct Settlement
      </footer>
    </main>
  );
}
