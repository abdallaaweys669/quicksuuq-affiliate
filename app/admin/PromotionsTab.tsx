"use client";

import { useState } from "react";
import type { PromotionRecord } from "@/lib/promotions";

interface PromotionsTabProps {
  promotions: PromotionRecord[];
  adminFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onRefresh: () => Promise<void>;
  onFeedback: (msg: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "13.5px",
  color: "#111827",
  background: "#ffffff",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12.5px",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "5px",
};

export default function PromotionsTab({
  promotions,
  adminFetch,
  onRefresh,
  onFeedback,
}: PromotionsTabProps) {
  const [saving, setSaving] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [dTitle, setDTitle] = useState("");
  const [dRuleType, setDRuleType] = useState<"FIRST_N_CUSTOMERS" | "MIN_ORDER_AMOUNT" | "PERCENT_OFF">("FIRST_N_CUSTOMERS");
  const [dMaxClaims, setDMaxClaims] = useState("20");
  const [dMinOrder, setDMinOrder] = useState("35");
  const [dDiscountPct, setDDiscountPct] = useState("20");
  const [dEndsAt, setDEndsAt] = useState("");
  const [dActive, setDActive] = useState(true);

  async function handleSaveDeal(e: React.FormEvent) {
    e.preventDefault();
    if (!dTitle.trim()) return;
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "promo",
          title: dTitle.trim(),
          rule_type: dRuleType,
          max_claims: dRuleType === "FIRST_N_CUSTOMERS" ? Number(dMaxClaims) || 20 : null,
          min_order_usd: dRuleType === "MIN_ORDER_AMOUNT" ? Number(dMinOrder) || 35 : null,
          discount_percent: dRuleType === "PERCENT_OFF" ? Number(dDiscountPct) || 20 : null,
          ends_at: dEndsAt || null,
          is_active: dActive,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to save promotion");
        return;
      }
      setShowDealModal(false);
      setDTitle("");
      setDEndsAt("");
      await onRefresh();
      onFeedback("Promotion created!");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleDeal(p: PromotionRecord) {
    const res = await adminFetch("/api/admin/promotions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "promo", id: p.id, is_active: !p.is_active }),
    });
    if (res.ok) {
      await onRefresh();
      onFeedback(`${p.title} turned ${!p.is_active ? "ON" : "OFF"}.`);
    }
  }

  async function handleDeleteDeal(p: PromotionRecord) {
    if (!confirm(`Delete promotion "${p.title}"?`)) return;
    const res = await adminFetch(`/api/admin/promotions?kind=promo&id=${encodeURIComponent(p.id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await onRefresh();
      onFeedback("Promotion deleted.");
    }
  }

  const [searchTerm, setSearchTerm] = useState("");
  const visiblePromos = promotions.filter(
    (p) => !searchTerm.trim() || p.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  return (
    <div style={{ padding: "14px 18px 26px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
        <input
          type="search"
          placeholder="Search promotions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...inputStyle, maxWidth: "320px" }}
        />
        <button
          type="button"
          onClick={() => setShowDealModal(true)}
          style={{
            whiteSpace: "nowrap",
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid #111827",
            background: "#1f2937",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + New Promotion
        </button>
      </div>

      {visiblePromos.length === 0 ? (
        <div className="empty-state">
          No promotions found. Click <strong>+ New Promotion</strong> to create one.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Promotion</th>
                <th>Rule</th>
                <th>Usage</th>
                <th>Ends At</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visiblePromos.map((p) => {
                const isFirstN = p.rule_type === "FIRST_N_CUSTOMERS";
                const isPct = p.rule_type === "PERCENT_OFF";
                const max = p.max_claims || 20;
                const spotsLeft = isFirstN ? Math.max(0, max - p.claimed_count) : null;
                const expired = p.ends_at ? new Date(p.ends_at).getTime() < Date.now() : false;

                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, color: "#111827" }}>{p.title}</td>
                    <td style={{ fontSize: "12.5px", color: "#374151" }}>
                      {isFirstN
                        ? `First ${max} customers · Free Delivery`
                        : isPct
                        ? `${Number(p.discount_percent || 20)}% Off`
                        : `Orders $${Number(p.min_order_usd || 35).toFixed(2)}+ · Free Delivery`}
                    </td>
                    <td style={{ fontSize: "12.5px", color: "#374151" }}>
                      {isFirstN ? `${p.claimed_count} / ${max} (${spotsLeft} left)` : "Unlimited"}
                    </td>
                    <td style={{ fontSize: "12.5px", color: "#6b7280" }}>
                      {p.ends_at ? new Date(p.ends_at).toLocaleDateString() : "No limit"}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${p.is_active && !expired ? "status-approved" : "status-pending"}`}
                        style={{ fontSize: "11px", fontWeight: 700 }}
                      >
                        {expired ? "EXPIRED" : p.is_active ? "ACTIVE" : "PAUSED"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button type="button" className="btn-small" onClick={() => handleToggleDeal(p)}>
                          {p.is_active ? "Pause" : "Activate"}
                        </button>
                        <button type="button" className="btn-small" style={{ color: "#dc2626" }} onClick={() => handleDeleteDeal(p)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showDealModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "500px", width: "95%", borderRadius: "16px", padding: "22px 24px" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 700, color: "#111827" }}>
              Create New Promotion
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#6b7280" }}>
              Set up a time-limited Free Delivery or % Off campaign.
            </p>
            <form onSubmit={handleSaveDeal} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Promotion Title *</label>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="e.g. Black Friday 25% Off or First 20 Free Delivery"
                  value={dTitle}
                  onChange={(e) => setDTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Promotion Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {[
                    { id: "FIRST_N_CUSTOMERS", label: "First N Free Delivery" },
                    { id: "MIN_ORDER_AMOUNT", label: "$X+ Free Delivery" },
                    { id: "PERCENT_OFF", label: "% Off Sale" },
                  ].map((opt) => {
                    const active = dRuleType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDRuleType(opt.id as typeof dRuleType)}
                        style={{
                          padding: "8px 8px",
                          borderRadius: "8px",
                          border: active ? "2px solid #16b981" : "1px solid #d1d5db",
                          background: active ? "#ecfdf5" : "#ffffff",
                          color: active ? "#0e8a60" : "#374151",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {dRuleType === "FIRST_N_CUSTOMERS" ? (
                  <div>
                    <label style={labelStyle}>Customer Limit (N)</label>
                    <input style={inputStyle} type="number" min="1" value={dMaxClaims} onChange={(e) => setDMaxClaims(e.target.value)} required />
                  </div>
                ) : dRuleType === "MIN_ORDER_AMOUNT" ? (
                  <div>
                    <label style={labelStyle}>Minimum Order ($ USD)</label>
                    <input style={inputStyle} type="number" step="0.01" min="1" value={dMinOrder} onChange={(e) => setDMinOrder(e.target.value)} required />
                  </div>
                ) : (
                  <div>
                    <label style={labelStyle}>Discount (%)</label>
                    <input style={inputStyle} type="number" min="1" max="90" value={dDiscountPct} onChange={(e) => setDDiscountPct(e.target.value)} required />
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Ends At (optional)</label>
                  <input style={inputStyle} type="datetime-local" value={dEndsAt} onChange={(e) => setDEndsAt(e.target.value)} />
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", cursor: "pointer" }}>
                <input type="checkbox" checked={dActive} onChange={(e) => setDActive(e.target.checked)} />
                Activate immediately
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button type="button" className="btn-secondary" style={{ padding: "9px 16px", borderRadius: "8px" }} onClick={() => setShowDealModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "9px 18px", borderRadius: "8px", background: "#1f2937", borderColor: "#111827", color: "#ffffff" }}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Create Promotion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
