"use client";

import { useState } from "react";
import type { BundleItem, BundleRecord, PromotionRecord } from "@/lib/promotions";

interface StoreProduct {
  id: string;
  variantId: string;
  title: string;
  price: number;
  image: string | null;
}

interface PromotionsTabProps {
  bundles: BundleRecord[];
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
  bundles,
  promotions,
  adminFetch,
  onRefresh,
  onFeedback,
}: PromotionsTabProps) {
  const [subTab, setSubTab] = useState<"bundles" | "deals">("bundles");
  const [saving, setSaving] = useState(false);

  // Store products cache for picker
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Bundle modal state
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);
  const [bTitle, setBTitle] = useState("");
  const [bPoster, setBPoster] = useState("");
  const [bItems, setBItems] = useState<BundleItem[]>([]);
  const [bPrice, setBPrice] = useState("");
  const [bPriceManual, setBPriceManual] = useState(false);
  const [bStock, setBStock] = useState("50");
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

  async function ensureProductsLoaded() {
    if (storeProducts.length > 0 || productsLoading) return;
    setProductsLoading(true);
    try {
      const res = await adminFetch("/api/admin/products");
      if (res.ok) {
        const d = await res.json();
        setStoreProducts(Array.isArray(d.products) ? d.products : []);
      }
    } catch (err) {
      console.error("Failed to load store products:", err);
    } finally {
      setProductsLoading(false);
    }
  }

  function openNewBundleModal() {
    setEditingBundleId(null);
    setBTitle("");
    setBPoster("");
    setBItems([]);
    setBPrice("");
    setBPriceManual(false);
    setBStock("50");
    setBActive(true);
    setProductQuery("");
    setPickerOpen(true);
    setShowBundleModal(true);
    ensureProductsLoaded();
  }

  function openEditBundleModal(b: BundleRecord) {
    setEditingBundleId(b.id);
    setBTitle(b.title);
    setBPoster(b.poster_url || "");
    setBItems(b.items.length > 0 ? b.items : []);
    setBPrice(b.bundle_price.toFixed(2));
    setBPriceManual(true);
    setBStock(String(b.stock));
    setBActive(b.is_active);
    setProductQuery("");
    setPickerOpen(false);
    setShowBundleModal(true);
    ensureProductsLoaded();
  }

  function updateItemsAndSyncPrice(nextItems: BundleItem[]) {
    setBItems(nextItems);
    if (!bPriceManual) {
      const nextTotal = nextItems.reduce(
        (s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
        0
      );
      setBPrice(nextTotal > 0 ? nextTotal.toFixed(2) : "");
    }
  }

  function addProductToBundle(prod: StoreProduct) {
    const idx = bItems.findIndex((it) => it.title.toLowerCase() === prod.title.toLowerCase());
    if (idx >= 0) {
      const next = [...bItems];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      updateItemsAndSyncPrice(next);
    } else {
      updateItemsAndSyncPrice([...bItems, { title: prod.title, qty: 1, unitPrice: prod.price }]);
    }
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
        commission_type: "DEFAULT",
        commission_value: 0,
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

  const filteredProducts = storeProducts
    .filter((p) => !productQuery.trim() || p.title.toLowerCase().includes(productQuery.trim().toLowerCase()))
    .slice(0, 30);

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
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
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
                      style={{ width: "100%", height: "230px", objectFit: "contain", background: "#eef6f0", display: "block" }}
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                      <h3 style={{ margin: 0, fontSize: "15.5px", fontWeight: 700, color: "#111827" }}>{b.title}</h3>
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

                    <p style={{ margin: "0 0 10px", fontSize: "12.5px", color: "#6b7280" }}>
                      {b.items.length} {b.items.length === 1 ? "item" : "items"} included
                      {b.items.length > 0 ? ` · ${b.items[0].title.split("·")[0].trim()}` : ""}
                    </p>

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

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "12px", color: "#6b7280" }}>
                      <span>Stock: <strong>{b.stock}</strong></span>
                      <span>·</span>
                      <span>Sold: <strong>{b.sold_count}</strong></span>
                    </div>
                  </div>
                </div>

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
                  <button type="button" className="btn-small" onClick={() => handleToggleBundle(b)}>
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
          <div
            className="modal-card"
            style={{
              maxWidth: "600px",
              width: "95%",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "16px",
              padding: "22px 24px",
            }}
          >
            <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 700, color: "#111827" }}>
              {editingBundleId ? "Edit Bundle" : "Create New Bundle"}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#6b7280" }}>
              Pick real products from your Shopify store and set your bundle price.
            </p>

            <form onSubmit={handleSaveBundle} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Bundle Name *</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="e.g. Xirmada Qudaarta — Set A"
                    value={bTitle}
                    onChange={(e) => setBTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Poster Image</label>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      type="text"
                      placeholder="Upload or paste URL"
                      value={bPoster}
                      onChange={(e) => setBPoster(e.target.value)}
                    />
                    <label
                      style={{
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        background: "#f9fafb",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        color: "#374151",
                      }}
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

              {/* REAL SHOPIFY PRODUCT PICKER */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Add Real Store Products</label>
                  <button
                    type="button"
                    onClick={() => {
                      setPickerOpen(!pickerOpen);
                      ensureProductsLoaded();
                    }}
                    style={{
                      border: "1px solid #a7f3d0",
                      background: "#ecfdf5",
                      color: "#0e8a60",
                      padding: "4px 10px",
                      borderRadius: "7px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {pickerOpen ? "Hide Product List" : "Browse Store Products"}
                  </button>
                </div>

                {pickerOpen && (
                  <div style={{ marginBottom: "10px" }}>
                    <input
                      type="search"
                      style={{ ...inputStyle, marginBottom: "8px" }}
                      placeholder="Search your Shopify products (e.g. Yaanyo, Baradho, Milk)..."
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                    />
                    <div
                      style={{
                        maxHeight: "170px",
                        overflowY: "auto",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        background: "#ffffff",
                      }}
                    >
                      {productsLoading ? (
                        <div style={{ padding: "14px", fontSize: "12.5px", color: "#6b7280", textAlign: "center" }}>
                          Loading products from Shopify...
                        </div>
                      ) : filteredProducts.length === 0 ? (
                        <div style={{ padding: "14px", fontSize: "12.5px", color: "#6b7280", textAlign: "center" }}>
                          No matching products found.
                        </div>
                      ) : (
                        filteredProducts.map((prod) => (
                          <div
                            key={prod.id}
                            onClick={() => addProductToBundle(prod)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                              padding: "8px 10px",
                              borderBottom: "1px solid #f3f4f6",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                              {prod.image ? (
                                <img
                                  src={prod.image}
                                  alt=""
                                  style={{ width: "30px", height: "30px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }}
                                />
                              ) : (
                                <div style={{ width: "30px", height: "30px", borderRadius: "6px", background: "#f3f4f6", flexShrink: 0 }} />
                              )}
                              <span
                                style={{
                                  fontSize: "13px",
                                  color: "#111827",
                                  fontWeight: 500,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {prod.title}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                              <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#374151" }}>
                                ${prod.price.toFixed(2)}
                              </span>
                              <span
                                style={{
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                  color: "#ffffff",
                                  background: "#16b981",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                }}
                              >
                                + Add
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Selected items inside bundle */}
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {bItems.length === 0 && (
                    <p style={{ margin: "4px 0", fontSize: "12.5px", color: "#6b7280" }}>
                      No items added yet. Click any product above to add it.
                    </p>
                  )}
                  {bItems.map((it, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 64px 82px 30px",
                        gap: "6px",
                        alignItems: "center",
                      }}
                    >
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="Item name"
                        value={it.title}
                        onChange={(e) => {
                          const next = [...bItems];
                          next[idx] = { ...it, title: e.target.value };
                          setBItems(next);
                        }}
                        required
                      />
                      <input
                        style={inputStyle}
                        type="number"
                        min="1"
                        title="Quantity"
                        value={it.qty}
                        onChange={(e) => {
                          const next = [...bItems];
                          next[idx] = { ...it, qty: Number(e.target.value) || 1 };
                          setBItems(next);
                        }}
                      />
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.01"
                        min="0"
                        title="Unit Price ($)"
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
                        style={{
                          border: "none",
                          background: "#fee2e2",
                          color: "#dc2626",
                          borderRadius: "7px",
                          height: "36px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", flexWrap: "wrap", gap: "8px" }}>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#4b5563" }}>
                    Normal total: <strong>${regularTotal.toFixed(2)}</strong>
                    {savings > 0 && (
                      <span style={{ color: "#0e8a60", fontWeight: 700 }}> · Customer saves ${savings.toFixed(2)}</span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBItems([...bItems, { title: "", qty: 1, unitPrice: 0 }])}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#4b5563",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    + Add custom line
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Bundle Price ($ USD) *</label>
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={regularTotal > 0 ? regularTotal.toFixed(2) : "0.00"}
                    value={bPrice}
                    onChange={(e) => {
                      setBPriceManual(true);
                      setBPrice(e.target.value);
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Stock Quantity *</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    value={bStock}
                    onChange={(e) => setBStock(e.target.value)}
                    required
                  />
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", cursor: "pointer" }}>
                <input type="checkbox" checked={bActive} onChange={(e) => setBActive(e.target.checked)} />
                Show on QuickSuuq website
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: "9px 16px", borderRadius: "8px" }}
                  onClick={() => setShowBundleModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "9px 18px", borderRadius: "8px", background: "#16b981", borderColor: "#16b981" }}
                  disabled={saving}
                >
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
          <div className="modal-card" style={{ maxWidth: "480px", width: "95%", borderRadius: "16px", padding: "22px 24px" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 700, color: "#111827" }}>
              Create Delivery Promotion
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#6b7280" }}>
              Time-limited Free Delivery rule that stops automatically when full or expired.
            </p>
            <form onSubmit={handleSaveDeal} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Promotion Title *</label>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="e.g. First 20 Customers Free Delivery"
                  value={dTitle}
                  onChange={(e) => setDTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Rule Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setDRuleType("FIRST_N_CUSTOMERS")}
                    style={{
                      padding: "9px 10px",
                      borderRadius: "8px",
                      border: dRuleType === "FIRST_N_CUSTOMERS" ? "2px solid #16b981" : "1px solid #d1d5db",
                      background: dRuleType === "FIRST_N_CUSTOMERS" ? "#ecfdf5" : "#ffffff",
                      color: dRuleType === "FIRST_N_CUSTOMERS" ? "#0e8a60" : "#374151",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    First N Customers
                  </button>
                  <button
                    type="button"
                    onClick={() => setDRuleType("MIN_ORDER_AMOUNT")}
                    style={{
                      padding: "9px 10px",
                      borderRadius: "8px",
                      border: dRuleType === "MIN_ORDER_AMOUNT" ? "2px solid #16b981" : "1px solid #d1d5db",
                      background: dRuleType === "MIN_ORDER_AMOUNT" ? "#ecfdf5" : "#ffffff",
                      color: dRuleType === "MIN_ORDER_AMOUNT" ? "#0e8a60" : "#374151",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Orders Over $X
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {dRuleType === "FIRST_N_CUSTOMERS" ? (
                  <div>
                    <label style={labelStyle}>Customer Limit (N)</label>
                    <input
                      style={inputStyle}
                      type="number"
                      min="1"
                      value={dMaxClaims}
                      onChange={(e) => setDMaxClaims(e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label style={labelStyle}>Minimum Order ($ USD)</label>
                    <input
                      style={inputStyle}
                      type="number"
                      step="0.01"
                      min="1"
                      value={dMinOrder}
                      onChange={(e) => setDMinOrder(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div>
                  <label style={labelStyle}>End Date & Time (optional)</label>
                  <input
                    style={inputStyle}
                    type="datetime-local"
                    value={dEndsAt}
                    onChange={(e) => setDEndsAt(e.target.value)}
                  />
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", cursor: "pointer" }}>
                <input type="checkbox" checked={dActive} onChange={(e) => setDActive(e.target.checked)} />
                Activate immediately
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: "9px 16px", borderRadius: "8px" }}
                  onClick={() => setShowDealModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "9px 18px", borderRadius: "8px", background: "#16b981", borderColor: "#16b981" }}
                  disabled={saving}
                >
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
