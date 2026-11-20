"use client";

import { useState } from "react";
import type { BundleItem, BundleRecord } from "@/lib/promotions";

interface StoreProduct {
  id: string;
  variantId: string;
  title: string;
  price: number;
  unit?: "kg" | "pcs" | "liter";
  image: string | null;
}

interface BundlesTabProps {
  bundles: BundleRecord[];
  adminFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onRefresh: () => Promise<void>;
  onFeedback: (msg: string) => void;
}

type UnitType = "kg" | "pcs" | "liter";

function formatQtyUnit(qty: number, unit?: string): string {
  if (unit === "kg") return `${qty} kg`;
  if (unit === "liter") return `${qty} L`;
  return qty === 1 ? "1 pc" : `${qty} pcs`;
}

function nextUnit(u?: string): UnitType {
  if (u === "kg") return "pcs";
  if (u === "pcs") return "liter";
  return "kg";
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

const blackBtnStyle: React.CSSProperties = {
  whiteSpace: "nowrap",
  padding: "8px 15px",
  borderRadius: "8px",
  border: "1px solid #111827",
  background: "#1f2937",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

export default function BundlesTab({
  bundles,
  adminFetch,
  onRefresh,
  onFeedback,
}: BundlesTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Store products cache
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState<"ALL" | UnitType>("ALL");

  // Bundle builder fields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bTitle, setBTitle] = useState("");
  const [bDesc, setBDesc] = useState("");
  const [bPoster, setBPoster] = useState("");
  const [bItems, setBItems] = useState<BundleItem[]>([]);
  const [bPrice, setBPrice] = useState("");
  const [bDiscountPct, setBDiscountPct] = useState("");
  const [bPriceManual, setBPriceManual] = useState(false);
  const [bHasFlash, setBHasFlash] = useState(false);
  const [bPromoPrice, setBPromoPrice] = useState("");
  const [bPromoEndsAt, setBPromoEndsAt] = useState("");
  const [bStock, setBStock] = useState("30");
  const [bActive, setBActive] = useState(true);

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

  function openNewModal() {
    setEditingId(null);
    setStep(1);
    setBTitle("");
    setBDesc("");
    setBPoster("");
    setBItems([]);
    setBPrice("");
    setBDiscountPct("0");
    setBPriceManual(false);
    setBHasFlash(false);
    setBPromoPrice("");
    setBPromoEndsAt("");
    setBStock("30");
    setBActive(true);
    setProductQuery("");
    setUnitFilter("ALL");
    setModalOpen(true);
    ensureProductsLoaded();
  }

  function openEditModal(b: BundleRecord) {
    setEditingId(b.id);
    setStep(1);
    setBTitle(b.title);
    setBDesc(b.description || "");
    setBPoster(b.poster_url || "");
    setBItems(b.items.length > 0 ? b.items : []);
    setBPrice(b.bundle_price.toFixed(2));
    const pct =
      b.regular_price > 0 && b.bundle_price < b.regular_price
        ? Math.round(((b.regular_price - b.bundle_price) / b.regular_price) * 100)
        : 0;
    setBDiscountPct(pct > 0 ? String(pct) : "0");
    setBPriceManual(true);
    setBHasFlash(Boolean(b.promo_price && b.promo_price > 0));
    setBPromoPrice(b.promo_price ? b.promo_price.toFixed(2) : "");
    setBPromoEndsAt(b.promo_ends_at ? b.promo_ends_at.slice(0, 16) : "");
    setBStock(String(b.stock));
    setBActive(b.is_active);
    setProductQuery("");
    setUnitFilter("ALL");
    setModalOpen(true);
    ensureProductsLoaded();
  }

  function updateItemsAndSyncPrice(nextItems: BundleItem[]) {
    setBItems(nextItems);
    const nextTotal = nextItems.reduce(
      (s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
      0
    );
    if (!bPriceManual) {
      setBPrice(nextTotal > 0 ? nextTotal.toFixed(2) : "");
      setBDiscountPct("");
    } else if (nextTotal > 0 && bDiscountPct) {
      const pct = Math.min(99, Math.max(0, Number(bDiscountPct) || 0));
      setBPrice((nextTotal * (1 - pct / 100)).toFixed(2));
    }
  }

  function getSelectedQty(title: string): number {
    const found = bItems.find((it) => it.title.toLowerCase() === title.toLowerCase());
    return found ? found.qty : 0;
  }

  function adjustProductQty(prod: StoreProduct, delta: number) {
    const idx = bItems.findIndex((it) => it.title.toLowerCase() === prod.title.toLowerCase());
    if (idx === -1 && delta > 0) {
      updateItemsAndSyncPrice([
        ...bItems,
        { title: prod.title, qty: 1, unitPrice: prod.price, unit: prod.unit || "pcs", image: prod.image },
      ]);
      return;
    }
    if (idx >= 0) {
      const nextQty = bItems[idx].qty + delta;
      if (nextQty <= 0) {
        updateItemsAndSyncPrice(bItems.filter((_, i) => i !== idx));
      } else {
        const next = [...bItems];
        next[idx] = { ...next[idx], qty: nextQty, image: next[idx].image || prod.image };
        updateItemsAndSyncPrice(next);
      }
    }
  }

  function handleDiscountPctChange(raw: string) {
    setBPriceManual(true);
    setBDiscountPct(raw);
    const pct = Number(raw);
    if (regularTotal > 0 && raw !== "" && !Number.isNaN(pct)) {
      const clamped = Math.min(99, Math.max(0, pct));
      setBPrice((regularTotal * (1 - clamped / 100)).toFixed(2));
    }
  }

  function handleBundlePriceChange(raw: string) {
    setBPriceManual(true);
    setBPrice(raw);
    const price = Number(raw);
    if (regularTotal > 0 && raw !== "" && !Number.isNaN(price) && price <= regularTotal) {
      const pct = Math.round(((regularTotal - price) / regularTotal) * 100);
      setBDiscountPct(pct > 0 ? String(pct) : "0");
    } else {
      setBDiscountPct("");
    }
  }

  async function handleSave() {
    if (!bTitle.trim()) {
      setStep(1);
      return;
    }
    setSaving(true);
    try {
      const cleanItems = bItems.filter((it) => it.title.trim());
      const payload = {
        kind: "bundle",
        id: editingId || undefined,
        title: bTitle.trim(),
        description: bDesc.trim(),
        poster_url: bPoster.trim() || null,
        items: cleanItems,
        regular_price: regularTotal,
        bundle_price: bundlePriceNum,
        promo_price: bHasFlash && Number(bPromoPrice) > 0 ? Number(bPromoPrice) : null,
        promo_ends_at: bHasFlash && bPromoEndsAt ? bPromoEndsAt : null,
        stock: Number(bStock) || 0,
        is_active: bActive,
      };
      const res = await adminFetch("/api/admin/promotions", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to save bundle");
        return;
      }
      setModalOpen(false);
      await onRefresh();
      onFeedback(editingId ? "Bundle updated!" : "Bundle created!");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(b: BundleRecord) {
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

  async function handleDelete(b: BundleRecord) {
    if (!confirm(`Delete bundle "${b.title}"?`)) return;
    const res = await adminFetch(`/api/admin/promotions?kind=bundle&id=${encodeURIComponent(b.id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await onRefresh();
      onFeedback("Bundle deleted.");
    }
  }

  const filteredProducts = storeProducts
    .filter((p) => {
      const matchQ = !productQuery.trim() || p.title.toLowerCase().includes(productQuery.trim().toLowerCase());
      const matchU = unitFilter === "ALL" || (p.unit || "pcs") === unitFilter;
      return matchQ && matchU;
    })
    .slice(0, 45);

  const visibleBundles = bundles.filter(
    (b) => !searchTerm.trim() || b.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  return (
    <div style={{ padding: "14px 18px 26px" }}>
      {/* Top Toolbar with comfortable padding from card edges */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
        <input
          type="search"
          placeholder="Search bundles..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...inputStyle, maxWidth: "320px" }}
        />
        <button type="button" onClick={openNewModal} style={blackBtnStyle}>
          + New Bundle
        </button>
      </div>

      {/* Bundle Cards Grid */}
      {visibleBundles.length === 0 ? (
        <div className="empty-state">
          No bundles found. Click <strong>+ New Bundle</strong> to create one.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {visibleBundles.map((b) => {
            const hasValidFlash =
              b.promo_price != null &&
              b.promo_price > 0 &&
              (!b.promo_ends_at || new Date(b.promo_ends_at).getTime() > Date.now());
            const displayPrice = hasValidFlash && b.promo_price ? b.promo_price : b.bundle_price;
            const saveAmt = Math.max(0, b.regular_price - displayPrice);

            return (
              <div
                key={b.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e1e3e5",
                  borderRadius: "12px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                }}
              >
                <div>
                  {b.poster_url ? (
                    <img
                      src={b.poster_url}
                      alt={b.title}
                      style={{ width: "100%", height: "220px", objectFit: "contain", background: "#f9fafb", borderBottom: "1px solid #f1f2f3", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        padding: "12px 16px",
                        background: "#f9fafb",
                        borderBottom: "1px solid #e1e3e5",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        QuickSuuq Bundle
                      </span>
                      {saveAmt > 0 && (
                        <span style={{ background: "#ecfdf5", color: "#008060", border: "1px solid #bbe5b3", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700 }}>
                          Save ${saveAmt.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                      <h3 style={{ margin: 0, fontSize: "15.5px", fontWeight: 700, color: "#111827" }}>{b.title}</h3>
                      <span
                        className={`status-pill ${b.is_active ? "status-approved" : "status-pending"}`}
                        style={{ fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" }}
                      >
                        {b.is_active ? "VISIBLE" : "HIDDEN"}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
                      {b.items.slice(0, 6).map((it, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: "11.5px",
                            background: "#f4f6f8",
                            border: "1px solid #e5e7eb",
                            color: "#374151",
                            padding: "2px 7px",
                            borderRadius: "6px",
                            fontWeight: 500,
                          }}
                        >
                          {it.title} <strong>({formatQtyUnit(it.qty, it.unit)})</strong>
                        </span>
                      ))}
                      {b.items.length > 6 && (
                        <span style={{ fontSize: "11.5px", color: "#4b5563", fontWeight: 600, padding: "2px 4px" }}>
                          +{b.items.length - 6} more
                        </span>
                      )}
                    </div>

                    {b.description && (
                      <p style={{ margin: "0 0 10px", fontSize: "12.5px", color: "#6d7175", lineHeight: 1.4 }}>
                        {b.description}
                      </p>
                    )}

                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "19px", fontWeight: 700, color: "#111827" }}>
                        ${displayPrice.toFixed(2)}
                      </span>
                      {b.regular_price > displayPrice && (
                        <>
                          <span style={{ fontSize: "13px", color: "#8c9196", textDecoration: "line-through" }}>
                            ${b.regular_price.toFixed(2)}
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#008060", background: "#f1f8f5", padding: "2px 6px", borderRadius: "6px" }}>
                            Save ${saveAmt.toFixed(2)}
                          </span>
                        </>
                      )}
                      {hasValidFlash && (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#9a5b00", background: "#fff4e5", padding: "2px 6px", borderRadius: "6px" }}>
                          Limited Offer
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: "12px", color: "#6d7175" }}>
                      Stock: <strong>{b.stock}</strong> · Sold: <strong>{b.sold_count}</strong>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "10px 16px",
                    borderTop: "1px solid #f1f2f3",
                    background: "#fafbfb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <button type="button" className="btn-small" onClick={() => handleToggle(b)}>
                    {b.is_active ? "Hide" : "Show"}
                  </button>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => openEditModal(b)}
                      style={{ ...blackBtnStyle, padding: "5px 12px", fontSize: "12px", borderRadius: "6px" }}
                    >
                      Edit
                    </button>
                    <button type="button" className="btn-small" style={{ color: "#dc2626" }} onClick={() => handleDelete(b)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CLEAN 3-STEP SHOPIFY WIZARD MODAL (One step at a time!) */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div
            className="modal-card"
            style={{
              maxWidth: "580px",
              width: "95%",
              borderRadius: "14px",
              padding: "20px 22px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#111827" }}>
                {editingId ? "Edit Bundle" : "New Bundle"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ border: "none", background: "#f3f4f6", color: "#374151", width: "28px", height: "28px", borderRadius: "50%", fontSize: "16px", cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            {/* 1 -> 2 -> 3 Step Tracker */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "18px" }}>
              {[
                { num: 1 as const, label: "1. Details" },
                { num: 2 as const, label: `2. Products (${bItems.length})` },
                { num: 3 as const, label: "3. Price & Save" },
              ].map((s) => {
                const isCurrent = step === s.num;
                const isDone = step > s.num;
                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => {
                      if (s.num > 1 && !bTitle.trim()) return;
                      setStep(s.num);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: isCurrent ? "1px solid #111827" : "1px solid #e5e7eb",
                      background: isCurrent ? "#1f2937" : isDone ? "#f3f4f6" : "#ffffff",
                      color: isCurrent ? "#ffffff" : "#374151",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* STEP 1: DETAILS */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={labelStyle}>Bundle Name *</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="e.g. Xirmada Qudaarta - Set B"
                    value={bTitle}
                    onChange={(e) => setBTitle(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={labelStyle}>Short Description (optional)</label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="e.g. Ku filan 3-4 qof · 1 isbuuc · ~20 kg"
                    value={bDesc}
                    onChange={(e) => setBDesc(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Poster Image (optional)</label>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      type="text"
                      placeholder="Leave empty or upload/paste URL"
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
                    {bPoster && (
                      <button
                        type="button"
                        onClick={() => setBPoster("")}
                        style={{ border: "none", background: "#fee2e2", color: "#dc2626", borderRadius: "7px", padding: "9px 10px", fontSize: "12px", cursor: "pointer" }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: PRODUCTS (kg / pcs / liter) */}
            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="search"
                    style={{ ...inputStyle, flex: 1, minWidth: "180px" }}
                    placeholder="Search store products (Yaanyo, Milk, Oil)..."
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                  />
                  <div style={{ display: "inline-flex", gap: "4px", background: "#f3f4f6", padding: "3px", borderRadius: "8px" }}>
                    {(["ALL", "kg", "pcs", "liter"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnitFilter(u)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          border: "none",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          background: unitFilter === u ? "#1f2937" : "transparent",
                          color: unitFilter === u ? "#ffffff" : "#4b5563",
                        }}
                      >
                        {u === "ALL" ? "All" : u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clean Product List */}
                <div style={{ maxHeight: "230px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#ffffff" }}>
                  {productsLoading ? (
                    <div style={{ padding: "20px", textAlign: "center", fontSize: "13px", color: "#6b7280" }}>
                      Loading products from Shopify...
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", fontSize: "13px", color: "#6b7280" }}>
                      No matching products found.
                    </div>
                  ) : (
                    filteredProducts.map((prod) => {
                      const qty = getSelectedQty(prod.title);
                      const unit = prod.unit || "pcs";
                      return (
                        <div
                          key={prod.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                            padding: "8px 12px",
                            borderBottom: "1px solid #f3f4f6",
                            background: qty > 0 ? "#f9fafb" : "#ffffff",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                            {prod.image ? (
                              <img src={prod.image} alt="" style={{ width: "32px", height: "32px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "#f3f4f6", flexShrink: 0 }} />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {prod.title}
                              </div>
                              <div style={{ fontSize: "11.5px", color: "#6b7280" }}>
                                ${prod.price.toFixed(2)} / {unit}
                              </div>
                            </div>
                          </div>

                          {qty > 0 ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => adjustProductQty(prod, -1)}
                                style={{ width: "26px", height: "26px", border: "1px solid #d1d5db", background: "#fff", borderRadius: "6px", fontWeight: 700, cursor: "pointer" }}
                              >
                                -
                              </button>
                              <span style={{ fontSize: "12.5px", fontWeight: 700, minWidth: "38px", textAlign: "center" }}>
                                {formatQtyUnit(qty, unit)}
                              </span>
                              <button
                                type="button"
                                onClick={() => adjustProductQty(prod, 1)}
                                style={{ width: "26px", height: "26px", border: "1px solid #111827", background: "#1f2937", color: "#fff", borderRadius: "6px", fontWeight: 700, cursor: "pointer" }}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => adjustProductQty(prod, 1)}
                              style={{ padding: "5px 12px", border: "1px solid #d1d5db", background: "#ffffff", borderRadius: "6px", fontSize: "12px", fontWeight: 600, color: "#111827", cursor: "pointer", flexShrink: 0 }}
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Items Summary */}
                {bItems.length > 0 && (
                  <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 700, color: "#111827", marginBottom: "6px" }}>
                      <span>Selected ({bItems.length})</span>
                      <span>Normal Total: ${regularTotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "90px", overflowY: "auto" }}>
                      {bItems.map((it, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            background: "#ffffff",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            padding: "3px 7px",
                            fontSize: "12px",
                          }}
                        >
                          <span>{it.title} ({formatQtyUnit(it.qty, it.unit)})</span>
                          <button
                            type="button"
                            title="Switch kg / pcs / liter"
                            onClick={() => {
                              const next = [...bItems];
                              next[idx] = { ...it, unit: nextUnit(it.unit) };
                              setBItems(next);
                            }}
                            style={{ border: "none", background: "#f3f4f6", color: "#374151", borderRadius: "4px", padding: "1px 5px", fontSize: "10.5px", fontWeight: 700, cursor: "pointer" }}
                          >
                            {it.unit || "pcs"}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItemsAndSyncPrice(bItems.filter((_, i) => i !== idx))}
                            style={{ border: "none", background: "none", color: "#dc2626", fontWeight: 700, cursor: "pointer", padding: 0 }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: PRICE & STOCK */}
            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#4b5563", fontWeight: 600 }}>
                    Normal price ({bItems.length} items individually)
                  </span>
                  <span style={{ fontSize: "16px", fontWeight: 800, color: "#111827" }}>
                    ${regularTotal.toFixed(2)}
                  </span>
                </div>

                {/* Synced Discount % OR Direct Bundle Price */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Discount % (0–99%)</label>
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      max="99"
                      placeholder="0"
                      value={bDiscountPct}
                      onChange={(e) => handleDiscountPctChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Bundle Price ($ USD) *</label>
                    <input
                      style={inputStyle}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={regularTotal > 0 ? regularTotal.toFixed(2) : "0.00"}
                      value={bPrice}
                      onChange={(e) => handleBundlePriceChange(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {savings > 0 && (
                  <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#008060", background: "#f1f8f5", border: "1px solid #bbe5b3", padding: "8px 12px", borderRadius: "8px" }}>
                    Customer pays <strong>${bundlePriceNum.toFixed(2)}</strong> instead of ${regularTotal.toFixed(2)} (Saves ${savings.toFixed(2)})
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignItems: "end" }}>
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
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", cursor: "pointer", paddingBottom: "9px" }}>
                    <input type="checkbox" checked={bActive} onChange={(e) => setBActive(e.target.checked)} />
                    Show on QuickSuuq website
                  </label>
                </div>

                <div style={{ borderTop: "1px solid #f1f2f3", paddingTop: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                    <input type="checkbox" checked={bHasFlash} onChange={(e) => setBHasFlash(e.target.checked)} />
                    Optional: Limited-time offer price
                  </label>
                  {bHasFlash && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
                      <div>
                        <label style={labelStyle}>Offer Price ($)</label>
                        <input style={inputStyle} type="number" step="0.01" min="0" placeholder="e.g. 28.00" value={bPromoPrice} onChange={(e) => setBPromoPrice(e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Ends At</label>
                        <input style={inputStyle} type="datetime-local" value={bPromoEndsAt} onChange={(e) => setBPromoEndsAt(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer Navigation */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", paddingTop: "14px", borderTop: "1px solid #e5e7eb" }}>
              <div>
                {step > 1 ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "8px 14px", borderRadius: "8px" }}
                    onClick={() => setStep((step - 1) as 1 | 2)}
                  >
                    ← Back
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "8px 14px", borderRadius: "8px" }}
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div>
                {step < 3 ? (
                  <button
                    type="button"
                    style={blackBtnStyle}
                    onClick={() => {
                      if (step === 1 && !bTitle.trim()) {
                        alert("Please enter a bundle name.");
                        return;
                      }
                      setStep((step + 1) as 2 | 3);
                    }}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    type="button"
                    style={blackBtnStyle}
                    disabled={saving}
                    onClick={handleSave}
                  >
                    {saving ? "Saving..." : editingId ? "Save Changes" : "Save Bundle"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
