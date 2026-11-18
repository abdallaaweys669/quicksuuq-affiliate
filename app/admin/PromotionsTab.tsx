"use client";

import { useState } from "react";
import type { BundleItem, BundleRecord, PromotionRecord } from "@/lib/promotions";

interface PromotionsTabProps {
  bundles: BundleRecord[];
  promotions: PromotionRecord[];
  adminFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onRefresh: () => Promise<void>;
  onFeedback: (msg: string) => void;
}

export default function PromotionsTab({
  bundles,
  promotions,
  adminFetch,
  onRefresh,
  onFeedback,
}: PromotionsTabProps) {
  const [subTab, setSubTab] = useState<"bundles" | "deals">("bundles");
  const [saving, setSaving] = useState(false);

  // Bundle modal state
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);
  const [bTitle, setBTitle] = useState("");
  const [bPoster, setBPoster] = useState("");
  const [bItems, setBItems] = useState<BundleItem[]>([{ title: "", qty: 1, unitPrice: 0 }]);
  const [bPrice, setBPrice] = useState("15.00");
  const [bStock, setBStock] = useState("50");
  const [bCommType, setBCommType] = useState<"DEFAULT" | "PERCENT" | "FIXED">("DEFAULT");
  const [bCommValue, setBCommValue] = useState("0");
  const [bActive, setBActive] = useState(true);

  // Delivery Deal modal state
  const [showDealModal, setShowDealModal] = useState(false);
  const [dTitle, setDTitle] = useState("");
  const [dRuleType, setDRuleType] = useState<"FIRST_N_CUSTOMERS" | "MIN_ORDER_AMOUNT">("FIRST_N_CUSTOMERS");
  const [dMaxClaims, setDMaxClaims] = useState("20");
  const [dMinOrder, setDMinOrder] = useState("35");
  const [dEndsAt, setDEndsAt] = useState("");
  const [dActive, setDActive] = useState(true);

  const regularTotal = bItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
  const bundlePriceNum = Number(bPrice) || 0;
  const savings = Math.max(0, regularTotal - bundlePriceNum);

  function openNewBundleModal() {
    setEditingBundleId(null);
    setBTitle("");
    setBPoster("");
    setBItems([{ title: "", qty: 1, unitPrice: 0 }]);
    setBPrice("15.00");
    setBStock("50");
    setBCommType("DEFAULT");
    setBCommValue("0");
    setBActive(true);
    setShowBundleModal(true);
  }

  function openEditBundleModal(b: BundleRecord) {
    setEditingBundleId(b.id);
    setBTitle(b.title);
    setBPoster(b.poster_url || "");
    setBItems(b.items.length > 0 ? b.items : [{ title: "", qty: 1, unitPrice: 0 }]);
    setBPrice(b.bundle_price.toFixed(2));
    setBStock(String(b.stock));
    setBCommType(b.commission_type);
    setBCommValue(String(b.commission_value));
    setBActive(b.is_active);
    setShowBundleModal(true);
  }

  async function handleSaveBundle(e: React.FormEvent) {
    e.preventDefault();
    if (!bTitle.trim()) return;
    setSaving(true);
    try {
      const cleanItems = bItems.filter((it) => it.title.trim());
      const payload = {
        kind: "bundle",
        id: editingBundleId || undefined,
        title: bTitle.trim(),
        poster_url: bPoster.trim() || null,
        items: cleanItems,
        regular_price: regularTotal,
        bundle_price: bundlePriceNum,
        stock: Number(bStock) || 0,
        commission_type: bCommType,
        commission_value: bCommType === "DEFAULT" ? 0 : Number(bCommValue) || 0,
        is_active: bActive,
      };
      const res = await adminFetch("/api/admin/promotions", {
        method: editingBundleId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to save bundle");
        return;
      }
      setShowBundleModal(false);
      await onRefresh();
      onFeedback(editingBundleId ? "Bundle updated!" : "Bundle created!");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleBundle(b: BundleRecord) {
    const res = await adminFetch("/api/admin/promotions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "bundle", id: b.id, is_active: !b.is_active }),
    });
    if (res.ok) {
      await onRefresh();
      onFeedback(`${b.title} is now ${!b.is_active ? "Visible" : "Hidden"} on website.`);
    }
  }

  async function handleDeleteBundle(b: BundleRecord) {
    if (!confirm(`Delete bundle "${b.title}"?`)) return;
    const res = await adminFetch(`/api/admin/promotions?kind=bundle&id=${encodeURIComponent(b.id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await onRefresh();
      onFeedback("Bundle deleted.");
    }
  }

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
      onFeedback("Delivery promotion created!");
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Sub-navigation & CTA */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "inline-flex", background: "#f3f4f6", padding: "4px", borderRadius: "10px", gap: "4px" }}>
          <button
            type="button"
            onClick={() => setSubTab("bundles")}
            style={{
              padding: "7px 14px",
              borderRadius: "7px",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              background: subTab === "bundles" ? "#ffffff" : "transparent",
              color: subTab === "bundles" ? "#111827" : "#6b7280",
              boxShadow: subTab === "bundles" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            Bundles / Xirmooyin ({bundles.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("deals")}
            style={{
              padding: "7px 14px",
              borderRadius: "7px",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              background: subTab === "deals" ? "#ffffff" : "transparent",
              color: subTab === "deals" ? "#111827" : "#6b7280",
              boxShadow: subTab === "deals" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            Delivery Deals ({promotions.length})
          </button>
        </div>

        {subTab === "bundles" ? (
          <button
            type="button"
            className="btn-primary"
            style={{ whiteSpace: "nowrap", padding: "9px 16px", flexShrink: 0 }}
            onClick={openNewBundleModal}
          >
            + New Bundle
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            style={{ whiteSpace: "nowrap", padding: "9px 16px", flexShrink: 0 }}
            onClick={() => setShowDealModal(true)}
          >
            + New Delivery Deal
          </button>
        )}
      </div>

      {/* BUNDLES SECTION */}
      {subTab === "bundles" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
            gap: "16px",
          }}
        >
          {bundles.length === 0 && (
            <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
              No bundles yet. Click <strong>+ New Bundle</strong> to create Set A, Qado Qoys, etc.
            </div>
          )}

          {bundles.map((b) => {
            const saveAmt = Math.max(0, b.regular_price - b.bundle_price);
            const commLabel =
              b.commission_type === "FIXED"
                ? `$${b.commission_value.toFixed(2)} / sale`
                : b.commission_type === "PERCENT"
                ? `${b.commission_value}% commission`
                : "Default rate";

            return (
              <div
                key={b.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  {b.poster_url ? (
                    <img
                      src={b.poster_url}
                      alt={b.title}
                      style={{ width: "100%", height: "240px", objectFit: "contain", background: "#eef6f0", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "92px",
                        background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#0e8a60",
                        fontWeight: 700,
                        fontSize: "15px",
                      }}
                    >
                      {b.title}
                    </div>
                  )}

                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" }}>{b.title}</h3>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: "999px",
                          background: b.is_active ? "#ecfdf5" : "#f3f4f6",
                          color: b.is_active ? "#0e8a60" : "#6b7280",
                          border: b.is_active ? "1px solid #a7f3d0" : "1px solid #e5e7eb",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.is_active ? "Visible" : "Hidden"}
                      </span>
                    </div>

                    {/* Clean 1-line items summary */}
                    <p style={{ margin: "0 0 10px", fontSize: "12.5px", color: "#6b7280" }}>
                      {b.items.length} {b.items.length === 1 ? "item" : "items"} included
                      {b.items.length > 0 ? ` · ${b.items[0].title.split("·")[0].trim()}...` : ""}
                    </p>

                    {/* Price & savings */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "10px" }}>
                      <span style={{ fontSize: "20px", fontWeight: 800, color: "#111827" }}>
                        ${b.bundle_price.toFixed(2)}
                      </span>
                      {b.regular_price > b.bundle_price && (
                        <>
                          <span style={{ fontSize: "13px", color: "#9ca3af", textDecoration: "line-through" }}>
                            ${b.regular_price.toFixed(2)}
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#0e8a60", background: "#ecfdf5", padding: "2px 6px", borderRadius: "6px" }}>
                            Save ${saveAmt.toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Stock, Sold, Commission */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "12px", color: "#6b7280" }}>
                      <span>Stock: <strong>{b.stock}</strong></span>
                      <span>·</span>
                      <span>Sold: <strong>{b.sold_count}</strong></span>
                      <span>·</span>
                      <span>{commLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{
                    padding: "10px 16px",
                    borderTop: "1px solid #f3f4f6",
                    background: "#f9fafb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => handleToggleBundle(b)}
                  >
                    {b.is_active ? "Hide" : "Show"}
                  </button>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button type="button" className="btn-small" onClick={() => openEditBundleModal(b)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-small"
                      style={{ color: "#dc2626" }}
                      onClick={() => handleDeleteBundle(b)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DELIVERY DEALS SECTION */}
      {subTab === "deals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {promotions.length === 0 && (
            <div className="empty-state">
              No delivery promotions yet. Click <strong>+ New Delivery Deal</strong> to launch Free Delivery for the first 20 customers or orders over $35.
            </div>
          )}

          {promotions.map((p) => {
            const isFirstN = p.rule_type === "FIRST_N_CUSTOMERS";
            const max = p.max_claims || 20;
            const pct = isFirstN ? Math.min(100, Math.round((p.claimed_count / max) * 100)) : 0;
            const spotsLeft = isFirstN ? Math.max(0, max - p.claimed_count) : null;
            const expired = p.ends_at ? new Date(p.ends_at).getTime() < Date.now() : false;

            return (
              <div
                key={p.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" }}>{p.title}</h3>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: "999px",
                          background: p.is_active && !expired ? "#ecfdf5" : "#f3f4f6",
                          color: p.is_active && !expired ? "#0e8a60" : "#6b7280",
                        }}
                      >
                        {expired ? "Expired" : p.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
                      {isFirstN
                        ? `Free Delivery for first ${max} customers`
                        : `Free Delivery on orders $${Number(p.min_order_usd || 35).toFixed(2)}+`}
                      {p.ends_at ? ` · Ends ${new Date(p.ends_at).toLocaleString()}` : " · No time limit"}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="button" className="btn-small" onClick={() => handleToggleDeal(p)}>
                      {p.is_active ? "Turn Off" : "Turn On"}
                    </button>
                    <button
                      type="button"
                      className="btn-small"
                      style={{ color: "#dc2626" }}
                      onClick={() => handleDeleteDeal(p)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isFirstN && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#4b5563", marginBottom: "5px" }}>
                      <span>
                        <strong>{p.claimed_count}</strong> / {max} claimed
                      </span>
                      <span style={{ color: "#0e8a60", fontWeight: 600 }}>{spotsLeft} spots left</span>
                    </div>
                    <div style={{ width: "100%", height: "8px", background: "#f3f4f6", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#16b981", borderRadius: "999px" }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD / EDIT BUNDLE */}
      {showBundleModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "560px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3>{editingBundleId ? "Edit Bundle" : "Create New Bundle"}</h3>
            <p className="modal-sub">Combine items into a value pack with custom pricing and affiliate commission.</p>
            <form onSubmit={handleSaveBundle} className="modal-form">
              <div className="modal-grid-2">
                <div className="form-group">
                  <label>Bundle Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Set A — Qado Qoys"
                    value={bTitle}
                    onChange={(e) => setBTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Poster Image (Upload or URL)</label>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="https://... or upload image"
                      value={bPoster}
                      onChange={(e) => setBPoster(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <label
                      className="btn-small"
                      style={{ cursor: "pointer", whiteSpace: "nowrap", margin: 0, padding: "8px 10px" }}
                    >
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === "string") setBPoster(reader.result);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Items inside */}
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ margin: 0 }}>Items Inside Bundle</label>
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => setBItems([...bItems, { title: "", qty: 1, unitPrice: 0 }])}
                  >
                    + Add Item
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {bItems.map((it, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 70px 90px 32px", gap: "6px", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Item name (e.g. Rice 5kg)"
                        value={it.title}
                        onChange={(e) => {
                          const next = [...bItems];
                          next[idx] = { ...it, title: e.target.value };
                          setBItems(next);
                        }}
                        required
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={it.qty}
                        onChange={(e) => {
                          const next = [...bItems];
                          next[idx] = { ...it, qty: Number(e.target.value) || 1 };
                          setBItems(next);
                        }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Price $"
                        value={it.unitPrice}
                        onChange={(e) => {
                          const next = [...bItems];
                          next[idx] = { ...it, unitPrice: Number(e.target.value) || 0 };
                          setBItems(next);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setBItems(bItems.filter((_, i) => i !== idx))}
                        disabled={bItems.length <= 1}
                        style={{ border: "none", background: "#fee2e2", color: "#dc2626", borderRadius: "6px", height: "34px", cursor: "pointer" }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#4b5563" }}>
                  Normal item-by-item total: <strong>${regularTotal.toFixed(2)}</strong>
                  {savings > 0 && (
                    <span style={{ color: "#0e8a60", fontWeight: 700 }}> · Customer saves ${savings.toFixed(2)}</span>
                  )}
                </p>
              </div>

              <div className="modal-grid-2">
                <div className="form-group">
                  <label>Bundle Price ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bPrice}
                    onChange={(e) => setBPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    value={bStock}
                    onChange={(e) => setBStock(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-grid-2">
                <div className="form-group">
                  <label>Affiliate Commission</label>
                  <select
                    value={bCommType}
                    onChange={(e) => setBCommType(e.target.value as "DEFAULT" | "PERCENT" | "FIXED")}
                  >
                    <option value="DEFAULT">Use Default Store Rate</option>
                    <option value="FIXED">Fixed $ per Bundle</option>
                    <option value="PERCENT">Custom % Rate</option>
                  </select>
                </div>
                {bCommType !== "DEFAULT" && (
                  <div className="form-group">
                    <label>{bCommType === "FIXED" ? "Amount ($ USD)" : "Percent (%)"}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bCommValue}
                      onChange={(e) => setBCommValue(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                <input type="checkbox" checked={bActive} onChange={(e) => setBActive(e.target.checked)} />
                Show on QuickSuuq website
              </label>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowBundleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingBundleId ? "Save Changes" : "Create Bundle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD DELIVERY DEAL */}
      {showDealModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "480px" }}>
            <h3>Create Delivery Promotion</h3>
            <p className="modal-sub">Time-limited Free Delivery rule that stops automatically when full or expired.</p>
            <form onSubmit={handleSaveDeal} className="modal-form">
              <div className="form-group">
                <label>Promotion Title *</label>
                <input
                  type="text"
                  placeholder="e.g. First 20 Customers Free Delivery"
                  value={dTitle}
                  onChange={(e) => setDTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Rule Type</label>
                <select
                  value={dRuleType}
                  onChange={(e) => setDRuleType(e.target.value as "FIRST_N_CUSTOMERS" | "MIN_ORDER_AMOUNT")}
                >
                  <option value="FIRST_N_CUSTOMERS">First N Customers (Free Delivery)</option>
                  <option value="MIN_ORDER_AMOUNT">Orders Over $X (Free Delivery)</option>
                </select>
              </div>

              <div className="modal-grid-2">
                {dRuleType === "FIRST_N_CUSTOMERS" ? (
                  <div className="form-group">
                    <label>Customer Limit (N)</label>
                    <input
                      type="number"
                      min="1"
                      value={dMaxClaims}
                      onChange={(e) => setDMaxClaims(e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Minimum Order ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={dMinOrder}
                      onChange={(e) => setDMinOrder(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>End Date & Time (optional)</label>
                  <input
                    type="datetime-local"
                    value={dEndsAt}
                    onChange={(e) => setDEndsAt(e.target.value)}
                  />
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                <input type="checkbox" checked={dActive} onChange={(e) => setDActive(e.target.checked)} />
                Activate immediately
              </label>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowDealModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Create Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
