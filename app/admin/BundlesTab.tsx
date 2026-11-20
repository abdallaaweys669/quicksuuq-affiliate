"use client";

import { useState } from "react";
import type { BundleItem, BundleRecord } from "@/lib/promotions";

interface StoreProduct {
  id: string;
  variantId: string;
  title: string;
  price: number;
  image: string | null;
}

interface BundlesTabProps {
  bundles: BundleRecord[];
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

export default function BundlesTab({
  bundles,
  adminFetch,
  onRefresh,
  onFeedback,
}: BundlesTabProps) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Store products cache
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productQuery, setProductQuery] = useState("");

  // Bundle builder fields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bTitle, setBTitle] = useState("");
  const [bDesc, setBDesc] = useState("");
  const [bPoster, setBPoster] = useState("");
  const [bItems, setBItems] = useState<BundleItem[]>([]);
  const [bPrice, setBPrice] = useState("");
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

  function openNewBuilder() {
    setEditingId(null);
    setBTitle("");
    setBDesc("");
    setBPoster("");
    setBItems([]);
    setBPrice("");
    setBPriceManual(false);
    setBHasFlash(false);
    setBPromoPrice("");
    setBPromoEndsAt("");
    setBStock("30");
    setBActive(true);
    setProductQuery("");
    setBuilderOpen(true);
    ensureProductsLoaded();
  }

  function openEditBuilder(b: BundleRecord) {
    setEditingId(b.id);
    setBTitle(b.title);
    setBDesc(b.description || "");
    setBPoster(b.poster_url || "");
    setBItems(b.items.length > 0 ? b.items : []);
    setBPrice(b.bundle_price.toFixed(2));
    setBPriceManual(true);
    setBHasFlash(Boolean(b.promo_price && b.promo_price > 0));
    setBPromoPrice(b.promo_price ? b.promo_price.toFixed(2) : "");
    setBPromoEndsAt(b.promo_ends_at ? b.promo_ends_at.slice(0, 16) : "");
    setBStock(String(b.stock));
    setBActive(b.is_active);
    setProductQuery("");
    setBuilderOpen(true);
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

  function getSelectedQty(title: string): number {
    const found = bItems.find((it) => it.title.toLowerCase() === title.toLowerCase());
    return found ? found.qty : 0;
  }

  function adjustProductQty(prod: StoreProduct, delta: number) {
    const idx = bItems.findIndex((it) => it.title.toLowerCase() === prod.title.toLowerCase());
    if (idx === -1 && delta > 0) {
      updateItemsAndSyncPrice([
        ...bItems,
        { title: prod.title, qty: 1, unitPrice: prod.price, image: prod.image },
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

  function applyDiscountPercent(pct: number) {
    if (regularTotal <= 0) return;
    setBPriceManual(true);
    setBPrice((regularTotal * (1 - pct / 100)).toFixed(2));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!bTitle.trim()) return;
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
      setBuilderOpen(false);
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
    .filter((p) => !productQuery.trim() || p.title.toLowerCase().includes(productQuery.trim().toLowerCase()))
    .slice(0, 40);

  // FULL-WIDTH 3-STEP BUILDER VIEW
  if (builderOpen) {
    return (
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Header Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            paddingBottom: "12px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#111827" }}>
              {editingId ? "Edit Bundle" : "Create New Bundle"}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#6b7280" }}>
              Simple 3-step builder — works with or without a poster photo.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: "8px 14px", borderRadius: "8px" }}
              onClick={() => setBuilderOpen(false)}
            >
              ← Back to Bundles
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: "8px 18px", borderRadius: "8px", background: "#16b981", borderColor: "#16b981" }}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Bundle"}
            </button>
          </div>
        </div>

        {/* STEP 1: Name, Short Description & Optional Poster */}
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0e8a60", marginBottom: "10px" }}>
            STEP 1 · Name, Short Description & Optional Poster
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Bundle Name *</label>
              <input
                style={inputStyle}
                type="text"
                placeholder="e.g. Xirmada Qudaarta - Set B"
                value={bTitle}
                onChange={(e) => setBTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Short Description (shown below products)</label>
              <input
                style={inputStyle}
                type="text"
                placeholder="e.g. Ku filan 3-4 qof · 1 isbuuc · ~20 kg"
                value={bDesc}
                onChange={(e) => setBDesc(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Poster Photo (Optional)</label>
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
                    style={{ border: "none", background: "#fee2e2", color: "#dc2626", borderRadius: "7px", padding: "8px 10px", fontSize: "12px", cursor: "pointer" }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2 & 3: 2-Column Visual Product Picker + Pricing Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(300px, 1fr)", gap: "16px", alignItems: "start" }}>
          {/* LEFT: Visual Store Product Grid */}
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#0e8a60", marginBottom: "10px" }}>
              STEP 2 · Tap Real Store Products & Choose Quantity
            </div>
            <input
              type="search"
              style={{ ...inputStyle, marginBottom: "12px" }}
              placeholder="Search your Shopify products (e.g. Yaanyo, Baradho, Milk)..."
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />

            {productsLoading ? (
              <div style={{ padding: "28px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
                Loading products from your Shopify store...
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))",
                  gap: "10px",
                  maxHeight: "420px",
                  overflowY: "auto",
                  paddingRight: "4px",
                }}
              >
                {filteredProducts.map((prod) => {
                  const qty = getSelectedQty(prod.title);
                  const isSelected = qty > 0;
                  return (
                    <div
                      key={prod.id}
                      style={{
                        border: isSelected ? "2px solid #16b981" : "1px solid #e5e7eb",
                        background: isSelected ? "#f0fdf4" : "#ffffff",
                        borderRadius: "10px",
                        padding: "10px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {prod.image ? (
                          <img
                            src={prod.image}
                            alt=""
                            style={{ width: "38px", height: "38px", borderRadius: "7px", objectFit: "cover", flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ width: "38px", height: "38px", borderRadius: "7px", background: "#f3f4f6", flexShrink: 0 }} />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#111827", lineHeight: 1.25 }}>
                            {prod.title}
                          </div>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#0e8a60" }}>
                            ${prod.price.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {isSelected ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", border: "1px solid #a7f3d0", borderRadius: "7px", padding: "3px 6px" }}>
                          <button
                            type="button"
                            onClick={() => adjustProductQty(prod, -1)}
                            style={{ width: "26px", height: "26px", border: "none", background: "#f3f4f6", borderRadius: "6px", fontWeight: 700, cursor: "pointer" }}
                          >
                            -
                          </button>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>{qty}</span>
                          <button
                            type="button"
                            onClick={() => adjustProductQty(prod, 1)}
                            style={{ width: "26px", height: "26px", border: "none", background: "#16b981", color: "#fff", borderRadius: "6px", fontWeight: 700, cursor: "pointer" }}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => adjustProductQty(prod, 1)}
                          style={{
                            width: "100%",
                            padding: "6px",
                            border: "1px solid #d1d5db",
                            borderRadius: "7px",
                            background: "#f9fafb",
                            color: "#111827",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Selected Items + Step 3 Price & Save */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>
                  Selected Items ({bItems.length})
                </span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0e8a60" }}>
                  Normal Total: ${regularTotal.toFixed(2)}
                </span>
              </div>

              {bItems.length === 0 ? (
                <p style={{ margin: "8px 0", fontSize: "12.5px", color: "#6b7280" }}>
                  Tap products on the left to add them to this bundle.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "200px", overflowY: "auto" }}>
                  {bItems.map((it, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        padding: "6px 8px",
                        background: "#f9fafb",
                        borderRadius: "8px",
                        fontSize: "12.5px",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "#111827", flex: 1 }}>
                        {it.title} <span style={{ color: "#0e8a60" }}>×{it.qty}</span>
                      </span>
                      <span style={{ color: "#4b5563", fontWeight: 600 }}>
                        ${(it.qty * it.unitPrice).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateItemsAndSyncPrice(bItems.filter((_, i) => i !== idx))}
                        style={{ border: "none", background: "none", color: "#dc2626", fontWeight: 700, cursor: "pointer", fontSize: "14px" }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STEP 3: Pricing & Optional Limited-Time Deal */}
            <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0e8a60" }}>
                STEP 3 · Set Bundle Price & Stock
              </div>

              {regularTotal > 0 && (
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>Quick discount:</span>
                  {[10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyDiscountPercent(pct)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        border: "1px solid #a7f3d0",
                        background: "#ecfdf5",
                        color: "#0e8a60",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      -{pct}%
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
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

              {savings > 0 && (
                <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#0e8a60", background: "#ecfdf5", padding: "8px 10px", borderRadius: "8px" }}>
                  Customer saves ${savings.toFixed(2)} compared to buying individually!
                </div>
              )}

              {/* Optional Limited-Time Price Drop */}
              <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                  <input type="checkbox" checked={bHasFlash} onChange={(e) => setBHasFlash(e.target.checked)} />
                  Optional: Run a limited-time offer price on this bundle
                </label>
                {bHasFlash && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
                    <div>
                      <label style={labelStyle}>Offer Price ($ USD)</label>
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 30.00"
                        value={bPromoPrice}
                        onChange={(e) => setBPromoPrice(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Offer Ends At</label>
                      <input
                        style={inputStyle}
                        type="datetime-local"
                        value={bPromoEndsAt}
                        onChange={(e) => setBPromoEndsAt(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", cursor: "pointer" }}>
                <input type="checkbox" checked={bActive} onChange={(e) => setBActive(e.target.checked)} />
                Show on QuickSuuq website
              </label>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: "100%", padding: "11px", borderRadius: "9px", background: "#16b981", borderColor: "#16b981", fontSize: "14px" }}
                disabled={saving}
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Bundle"}
              </button>
            </div>
          </div>
        </div>
      </form>
    );
  }

  // BUNDLES LIST VIEW
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#6b7280" }}>
          Manage combo packs (Set A, B, C, family packs). Works with or without poster photos.
        </p>
        <button
          type="button"
          className="btn-primary"
          style={{ whiteSpace: "nowrap", padding: "9px 16px", background: "#16b981", borderColor: "#16b981" }}
          onClick={openNewBuilder}
        >
          + New Bundle
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: "16px" }}>
        {bundles.length === 0 && (
          <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
            No bundles yet. Click <strong>+ New Bundle</strong> to create one.
          </div>
        )}

        {bundles.map((b) => {
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
                    style={{ width: "100%", height: "220px", objectFit: "contain", background: "#eef6f0", display: "block" }}
                  />
                ) : (
                  <div
                    style={{
                      padding: "16px",
                      background: "linear-gradient(135deg, #0e8a60 0%, #16b981 100%)",
                      color: "#ffffff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 700, opacity: 0.9, textTransform: "uppercase" }}>
                        QuickSuuq Bundle
                      </div>
                      <div style={{ fontSize: "17px", fontWeight: 800 }}>{b.title}</div>
                    </div>
                    {saveAmt > 0 && (
                      <span style={{ background: "#ffffff", color: "#0e8a60", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 }}>
                        Save ${saveAmt.toFixed(2)}
                      </span>
                    )}
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

                  {/* Exact products & quantities */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "10px" }}>
                    {b.items.slice(0, 6).map((it, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: "11.5px",
                          background: "#f3f4f6",
                          color: "#374151",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontWeight: 500,
                        }}
                      >
                        {it.title} <strong>×{it.qty}</strong>
                      </span>
                    ))}
                    {b.items.length > 6 && (
                      <span style={{ fontSize: "11.5px", color: "#0e8a60", fontWeight: 700, padding: "3px 4px" }}>
                        +{b.items.length - 6} more
                      </span>
                    )}
                  </div>

                  {/* Short description below products */}
                  {b.description && (
                    <p style={{ margin: "0 0 10px", fontSize: "12.5px", color: "#4b5563", lineHeight: 1.4 }}>
                      {b.description}
                    </p>
                  )}

                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "20px", fontWeight: 800, color: "#111827" }}>
                      ${displayPrice.toFixed(2)}
                    </span>
                    {b.regular_price > displayPrice && (
                      <>
                        <span style={{ fontSize: "13px", color: "#9ca3af", textDecoration: "line-through" }}>
                          ${b.regular_price.toFixed(2)}
                        </span>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#0e8a60", background: "#ecfdf5", padding: "2px 6px", borderRadius: "6px" }}>
                          Save ${saveAmt.toFixed(2)}
                        </span>
                      </>
                    )}
                    {hasValidFlash && (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309", background: "#fef3c7", padding: "2px 6px", borderRadius: "6px" }}>
                        Limited Offer
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    Stock: <strong>{b.stock}</strong> · Sold: <strong>{b.sold_count}</strong>
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
                <button type="button" className="btn-small" onClick={() => handleToggle(b)}>
                  {b.is_active ? "Hide" : "Show"}
                </button>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button type="button" className="btn-small" onClick={() => openEditBuilder(b)}>
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
    </div>
  );
}
