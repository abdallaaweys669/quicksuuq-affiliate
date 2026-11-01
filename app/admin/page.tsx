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
  has_pin: boolean;
  commission_rate: number;
  is_active: boolean;
  total_orders: number;
  total_sales: number;
  pending_amount: number;
  approved_amount: number;
  paid_amount: number;
}

interface Commission {
  id: string;
  shopify_order_id: string;
  order_number: string;
  salesperson_id: string;
  salesperson_name: string;
  salesperson_code: string;
  eligible_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: "PENDING" | "APPROVED" | "PAID" | "VOIDED";
  created_at: string;
}

interface PayoutRecord {
  id: string;
  salesperson_name: string;
  salesperson_code: string;
  salesperson_phone: string | null;
  amount: number;
  payment_method: string;
  transaction_ref: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  commissions_count: number;
}

export default function AdminDashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<"commissions" | "salespeople" | "payouts">("commissions");

  // Data states
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Modals state
  const [showAddRep, setShowAddRep] = useState(false);
  const [newRepName, setNewRepName] = useState("");
  const [newRepEmail, setNewRepEmail] = useState("");
  const [newRepCode, setNewRepCode] = useState("");
  const [newRepPhone, setNewRepPhone] = useState("");
  const [newRepRate, setNewRepRate] = useState("0.02");
  const [newRepPin, setNewRepPin] = useState("");

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedRepId, setSelectedRepId] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("EVC_PLUS");
  const [payoutTxRef, setPayoutTxRef] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  function isShopifyEmbedded(): boolean {
    if (typeof window === "undefined") return false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("shop") || params.get("host") || params.get("embedded") === "1") {
        sessionStorage.setItem("qs_shopify_embedded", "1");
        return true;
      }
      if (sessionStorage.getItem("qs_shopify_embedded") === "1") return true;
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  async function adminFetch(url: string, init?: RequestInit) {
    const headers = new Headers(init?.headers || {});
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("qs_admin_token");
      if (token) headers.set("x-admin-token", token);
      if (isShopifyEmbedded()) headers.set("x-shopify-embedded", "1");
    }
    return fetch(url, { ...init, headers });
  }

  async function checkAdmin() {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/salespeople");
      if (res.ok) {
        setIsAdmin(true);
        loadAllData();
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllData() {
    try {
      const [repsRes, commsRes, paysRes] = await Promise.all([
        adminFetch("/api/admin/salespeople"),
        adminFetch("/api/admin/commissions"),
        adminFetch("/api/admin/payouts"),
      ]);
      if (repsRes.ok) {
        const d = await repsRes.json();
        setSalespeople(d.salespeople || []);
      }
      if (commsRes.ok) {
        const d = await commsRes.json();
        setCommissions(d.commissions || []);
      }
      if (paysRes.ok) {
        const d = await paysRes.json();
        setPayouts(d.payouts || []);
      }
    } catch (e) {
      console.error("Error loading admin data:", e);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Incorrect passcode");
        return;
      }
      if (data.token && typeof window !== "undefined") {
        localStorage.setItem("qs_admin_token", data.token);
      }
      setIsAdmin(true);
      await loadAllData();
    } catch {
      setLoginError("Failed to authenticate.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/admin/logout", { method: "POST" });
    if (typeof window !== "undefined") {
      localStorage.removeItem("qs_admin_token");
      sessionStorage.removeItem("qs_shopify_embedded");
    }
    setIsAdmin(false);
    setPasscode("");
  }

  async function handleApproveCommission(id: string) {
    try {
      const res = await adminFetch("/api/admin/commissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], action: "APPROVE" }),
      });
      if (res.ok) {
        setCommissions((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: "APPROVED" } : c))
        );
        showFeedback("Commission approved!");
      }
    } catch {
      showFeedback("Failed to approve commission.");
    }
  }

  async function handleBatchApprovePending() {
    const pendingIds = commissions.filter((c) => c.status === "PENDING").map((c) => c.id);
    if (pendingIds.length === 0) return;
    try {
      const res = await adminFetch("/api/admin/commissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingIds, action: "APPROVE" }),
      });
      if (res.ok) {
        setCommissions((prev) =>
          prev.map((c) => (pendingIds.includes(c.id) ? { ...c, status: "APPROVED" } : c))
        );
        showFeedback(`Approved ${pendingIds.length} commissions!`);
      }
    } catch {
      showFeedback("Failed to batch approve.");
    }
  }

  async function handleToggleRepActive(rep: Salesperson) {
    try {
      const res = await adminFetch("/api/admin/salespeople", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rep.id, is_active: !rep.is_active }),
      });
      if (res.ok) {
        setSalespeople((prev) =>
          prev.map((s) => (s.id === rep.id ? { ...s, is_active: !s.is_active } : s))
        );
        showFeedback(`Salesperson ${rep.code} is now ${!rep.is_active ? "active" : "inactive"}.`);
      }
    } catch {
      showFeedback("Failed to update status.");
    }
  }

  async function handleResetPin(rep: Salesperson) {
    if (!confirm(`Reset PIN for ${rep.name} (${rep.code})? They will be prompted to set a new PIN on next login.`)) return;
    try {
      const res = await adminFetch("/api/admin/salespeople", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rep.id, resetPin: true }),
      });
      if (res.ok) {
        setSalespeople((prev) =>
          prev.map((s) => (s.id === rep.id ? { ...s, has_pin: false } : s))
        );
        showFeedback(`PIN reset for ${rep.code}.`);
      }
    } catch {
      showFeedback("Failed to reset PIN.");
    }
  }

  async function handleAddSalesperson(e: React.FormEvent) {
    e.preventDefault();
    if (!newRepEmail.trim()) {
      alert("Email address is required for unique login identification.");
      return;
    }
    if (!newRepPhone.trim()) {
      alert("Somali phone number is compulsory for EVC Plus payouts.");
      return;
    }

    try {
      const res = await adminFetch("/api/admin/salespeople", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRepName,
          email: newRepEmail,
          code: newRepCode,
          phone: newRepPhone,
          commission_rate: parseFloat(newRepRate) || 0.02,
          pin: newRepPin || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to add salesperson");
        return;
      }
      setShowAddRep(false);
      setNewRepName("");
      setNewRepEmail("");
      setNewRepCode("");
      setNewRepPhone("");
      setNewRepPin("");
      await loadAllData();
      showFeedback(`Added salesperson ${data.salesperson.code} (${data.salesperson.email})!`);
    } catch {
      alert("Error adding salesperson.");
    }
  }

  async function handleCreatePayout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRepId) return;

    // Get approved commissions for this rep
    const approved = commissions.filter(
      (c) => c.salesperson_id === selectedRepId && c.status === "APPROVED"
    );
    if (approved.length === 0) {
      alert("No approved commissions found for this salesperson.");
      return;
    }

    try {
      const res = await adminFetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salespersonId: selectedRepId,
          paymentMethod: payoutMethod,
          transactionRef: payoutTxRef,
          commissionIds: approved.map((c) => c.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create payout");
        return;
      }
      setShowPayoutModal(false);
      setPayoutTxRef("");
      await loadAllData();
      showFeedback(`Payout of $${data.amount} processed via ${payoutMethod}!`);
    } catch {
      alert("Error processing payout.");
    }
  }

  function showFeedback(msg: string) {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(""), 3500);
  }

  if (loading) {
    return (
      <main className="portal-container">
        <div className="loader-box">
          <div className="spinner" />
          <p>Loading management console...</p>
        </div>
      </main>
    );
  }

  // 1. Admin Login View
  if (!isAdmin) {
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
            <h1>Admin Security Console</h1>
            <p className="subtitle">Enter the master administration passcode to manage sales reps, commission approvals, and mobile money payouts.</p>
          </div>

          <form onSubmit={handleLogin} className="portal-form">
            {loginError && <div className="error-alert">{loginError}</div>}

            <div className="form-group">
              <label>Admin Passcode</label>
              <input
                type="password"
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
                autoFocus
              />
              <span className="field-hint">Master security passcode: <code>quicksuuq-admin-2026</code></span>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Authenticating..." : "Access Admin Console"}
            </button>
          </form>

          <div className="portal-footer">
            <Link href="/" className="back-link">← Return to QuickSuuq Homepage</Link>
          </div>
        </div>
      </main>
    );
  }

  // Calculations for stats
  const totalOrders = commissions.length;
  const totalSalesDriven = commissions.reduce((sum, c) => sum + (c.eligible_amount || 0), 0);
  const pendingAmount = commissions
    .filter((c) => c.status === "PENDING")
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);
  const approvedUnpaid = commissions
    .filter((c) => c.status === "APPROVED")
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);
  const totalPaidOut = commissions
    .filter((c) => c.status === "PAID")
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

  const filteredCommissions = commissions.filter(
    (c) => statusFilter === "ALL" || c.status === statusFilter
  );

  return (
    <main className="portal-dashboard admin-view">
      {feedbackMsg && <div className="toast-notification">{feedbackMsg}</div>}

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
            <h2 className="rep-name">Admin Management Console</h2>
            <div className="rep-meta">
              <span>QuickSuuq Partner Network</span>
              <span className="muted">·</span>
              <span className="rep-phone-tag">PostgreSQL 17 Live</span>
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="rate-badge live">● Admin Authenticated</span>
          <button onClick={handleLogout} className="btn-logout">Exit Admin</button>
        </div>
      </header>

      {/* KPI Stats */}
      <section className="metrics-grid admin-metrics">
        <div className="metric-card">
          <span className="metric-label">TOTAL MERCHANDISE</span>
          <div className="metric-value">${totalSalesDriven.toFixed(2)}</div>
          <span className="metric-sub">{totalOrders} affiliate orders</span>
        </div>
        <div className="metric-card highlight-pending">
          <span className="metric-label">PENDING APPROVAL</span>
          <div className="metric-value yellow">${pendingAmount.toFixed(2)}</div>
          <span className="metric-sub">{commissions.filter((c) => c.status === "PENDING").length} orders pending</span>
        </div>
        <div className="metric-card highlight">
          <span className="metric-label">READY FOR PAYOUT</span>
          <div className="metric-value teal">${approvedUnpaid.toFixed(2)}</div>
          <span className="metric-sub">Approved commissions</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">TOTAL PAID OUT</span>
          <div className="metric-value">${totalPaidOut.toFixed(2)}</div>
          <span className="metric-sub">{payouts.length} payout batches</span>
        </div>
      </section>

      {/* Admin Tabs */}
      <section className="content-card">
        <div className="admin-toolbar">
          <div className="tabs-header">
            <button
              className={`tab-btn ${activeTab === "commissions" ? "active" : ""}`}
              onClick={() => setActiveTab("commissions")}
            >
              Commissions ({commissions.length})
            </button>
            <button
              className={`tab-btn ${activeTab === "salespeople" ? "active" : ""}`}
              onClick={() => setActiveTab("salespeople")}
            >
              Sales Team ({salespeople.length})
            </button>
            <button
              className={`tab-btn ${activeTab === "payouts" ? "active" : ""}`}
              onClick={() => setActiveTab("payouts")}
            >
              Payouts & Mobile Money ({payouts.length})
            </button>
          </div>

          <div className="toolbar-actions">
            {activeTab === "commissions" && (
              <div className="action-row">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Only</option>
                  <option value="APPROVED">Approved Only</option>
                  <option value="PAID">Paid Only</option>
                  <option value="VOIDED">Voided Only</option>
                </select>
                {commissions.some((c) => c.status === "PENDING") && (
                  <button onClick={handleBatchApprovePending} className="btn-action">
                    ✓ Approve All Pending
                  </button>
                )}
              </div>
            )}

            {activeTab === "salespeople" && (
              <button onClick={() => setShowAddRep(true)} className="btn-action primary">
                + Add New Salesperson
              </button>
            )}

            {activeTab === "payouts" && (
              <div className="action-row">
                <a href="/api/admin/payouts/export?scope=approved" className="btn-action secondary" download>
                  📥 Export EVC Plus CSV
                </a>
                <button onClick={() => setShowPayoutModal(true)} className="btn-action primary">
                  💸 Record Payout Batch
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Commissions Table */}
        {activeTab === "commissions" && (
          <div className="table-responsive">
            {filteredCommissions.length === 0 ? (
              <div className="empty-state">
                <p>No commissions match the selected status.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Salesperson</th>
                    <th>Order Subtotal</th>
                    <th>Rate</th>
                    <th>Commission</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommissions.map((c) => (
                    <tr key={c.id}>
                      <td className="bold-cell">{c.order_number}</td>
                      <td>
                        <strong>{c.salesperson_name}</strong>
                        <span className="code-sub"> ({c.salesperson_code})</span>
                      </td>
                      <td>${c.eligible_amount.toFixed(2)}</td>
                      <td>{(c.commission_rate * 100).toFixed(1)}%</td>
                      <td className="bold-cell green-cell">+${c.commission_amount.toFixed(2)}</td>
                      <td>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`status-pill ${c.status.toLowerCase()}`}>{c.status}</span>
                      </td>
                      <td>
                        {c.status === "PENDING" && (
                          <button
                            onClick={() => handleApproveCommission(c.id)}
                            className="btn-tiny approve"
                          >
                            Approve
                          </button>
                        )}
                        {c.status === "PAID" && <span className="muted-text">Completed</span>}
                        {c.status === "APPROVED" && <span className="blue-text">Ready for Payout</span>}
                        {c.status === "VOIDED" && <span className="muted-text">Cancelled</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Sales Team Table */}
        {activeTab === "salespeople" && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Referral Code</th>
                  <th>Name</th>
                  <th>Email (Unique Login)</th>
                  <th>Phone (EVC Plus)</th>
                  <th>Rate</th>
                  <th>Password / PIN</th>
                  <th>Total Sales</th>
                  <th>Total Earned</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {salespeople.map((s) => (
                  <tr key={s.id}>
                    <td><span className="code-tag">{s.code}</span></td>
                    <td className="bold-cell">{s.name}</td>
                    <td className="mono-cell">{s.email || <span className="muted-text">None</span>}</td>
                    <td>{s.phone ? `+252 ${s.phone}` : <span className="muted-text">Not set</span>}</td>
                    <td>{(s.commission_rate * 100).toFixed(1)}%</td>
                    <td>
                      {s.has_pin ? (
                        <span className="status-pill active-pill">Active Password</span>
                      ) : (
                        <span className="status-pill pending">Pending Setup</span>
                      )}
                    </td>
                    <td>${(s.total_sales || 0).toFixed(2)}</td>
                    <td className="teal-cell">${((s.pending_amount || 0) + (s.approved_amount || 0) + (s.paid_amount || 0)).toFixed(2)}</td>
                    <td>
                      <span className={`status-pill ${s.is_active ? "active-pill" : "voided"}`}>
                        {s.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          onClick={() => handleToggleRepActive(s)}
                          className="btn-tiny"
                        >
                          {s.is_active ? "Deactivate" : "Activate"}
                        </button>
                        {s.has_pin && (
                          <button
                            onClick={() => handleResetPin(s)}
                            className="btn-tiny"
                          >
                            Reset PIN
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Payouts Table */}
        {activeTab === "payouts" && (
          <div className="table-responsive">
            {payouts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💸</div>
                <h3>No payouts recorded yet</h3>
                <p>When you approve commissions and disburse mobile money, record the payout batch here.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Salesperson</th>
                    <th>Amount</th>
                    <th>Payment Method</th>
                    <th>Transaction Ref</th>
                    <th>Commissions Paid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.paid_at || p.created_at).toLocaleDateString()}</td>
                      <td className="bold-cell">
                        {p.salesperson_name} ({p.salesperson_code})
                      </td>
                      <td className="bold-cell green-cell">${p.amount.toFixed(2)}</td>
                      <td>
                        <span className="payment-pill">{p.payment_method.replace("_", " ")}</span>
                      </td>
                      <td className="mono-cell">{p.transaction_ref || "Direct Transfer"}</td>
                      <td>{p.commissions_count} order(s)</td>
                      <td><span className="status-pill paid">{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      {/* Modal: Add Salesperson */}
      {showAddRep && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Add New Salesperson</h3>
            <p className="modal-sub">Create an affiliate referral code and assign a commission rate.</p>
            <form onSubmit={handleAddSalesperson} className="modal-form">
              <div className="modal-grid-2">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Hassan Omar"
                    value={newRepName}
                    onChange={(e) => setNewRepName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Unique Referral Code</label>
                  <input
                    type="text"
                    placeholder="e.g. HASSAN50"
                    value={newRepCode}
                    onChange={(e) => setNewRepCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>
              </div>
              <div className="modal-grid-2">
                <div className="form-group">
                  <label>Registered Email (Login)</label>
                  <input
                    type="email"
                    placeholder="e.g. hassan@example.com"
                    value={newRepEmail}
                    onChange={(e) => setNewRepEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <div className="form-label-row">
                    <label>Somali Phone (EVC Plus)</label>
                    <span className="compulsory-badge">Compulsory</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="e.g. +252615552000"
                    value={newRepPhone}
                    onChange={(e) => setNewRepPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-grid-2">
                <div className="form-group">
                  <label>Commission Rate (0.02 = 2%)</label>
                  <input
                    type="number"
                    step="0.005"
                    min="0"
                    max="1"
                    value={newRepRate}
                    onChange={(e) => setNewRepRate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Initial PIN (Optional)</label>
                  <input
                    type="password"
                    maxLength={6}
                    inputMode="numeric"
                    placeholder="e.g. 1234 (or blank)"
                    value={newRepPin}
                    onChange={(e) => setNewRepPin(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddRep(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ height: "40px", padding: "0 20px" }}>
                  Save Salesperson
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Payout */}
      {showPayoutModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Record Mobile Money Payout</h3>
            <p className="modal-sub">Mark approved commissions as paid after sending funds via EVC Plus or Zaad.</p>
            <form onSubmit={handleCreatePayout} className="modal-form">
              <div className="form-group">
                <label>Select Salesperson</label>
                <select
                  value={selectedRepId}
                  onChange={(e) => setSelectedRepId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Salesperson --</option>
                  {salespeople.map((s) => {
                    const approvedTotal = commissions
                      .filter((c) => c.salesperson_id === s.id && c.status === "APPROVED")
                      .reduce((sum, c) => sum + c.commission_amount, 0);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) — Approved: ${approvedTotal.toFixed(2)}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                >
                  <option value="EVC_PLUS">EVC Plus (Hormuud)</option>
                  <option value="ZAAD">Zaad (Telesom)</option>
                  <option value="SAHAL">Sahal (Golis)</option>
                  <option value="CASH">Cash / Store Credit</option>
                </select>
              </div>

              <div className="form-group">
                <label>Transaction Reference ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. TXN9823412 or Hormuud SMS Ref"
                  value={payoutTxRef}
                  onChange={(e) => setPayoutTxRef(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowPayoutModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Complete & Mark Paid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
