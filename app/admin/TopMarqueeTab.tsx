"use client";

import { useEffect, useState } from "react";
import type { MarqueeItem, PromotionRecord } from "@/lib/promotions";

interface TopMarqueeTabProps {
  promotions: PromotionRecord[];
  adminFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onFeedback: (msg: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "13px",
  color: "#111827",
  background: "#ffffff",
  boxSizing: "border-box",
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

export default function TopMarqueeTab({
  promotions,
  adminFetch,
  onFeedback,
}: TopMarqueeTabProps) {
  const [items, setItems] = useState<MarqueeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminFetch("/api/admin/bundle-banners")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.marquee_items) && d.marquee_items.length > 0) {
          setItems(d.marquee_items);
        } else {
          // Starter breaking-news ticker items if none saved yet
          const firstPromo = promotions[0];
          const starter: MarqueeItem[] = [
            {
              id: "mq_fast_delivery",
              text: "Fast Mogadishu Delivery · Fresh Groceries Daily",
              promotion_id: null,
              is_active: true,
            },
            {
              id: "mq_evc_plus",
              text: "Pay Easily & Securely with EVC Plus",
              promotion_id: null,
              is_active: true,
            },
          ];
          if (firstPromo) {
            starter.unshift({
              id: `mq_promo_${firstPromo.id}`,
              text: firstPromo.title,
              promotion_id: firstPromo.id,
              is_active: true,
            });
          }
          setItems(starter);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `mq_${Date.now().toString(36)}`,
        text: "",
        promotion_id: null,
        is_active: true,
      },
    ]);
  }

  function updateItem(id: string, patch: Partial<MarqueeItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function saveAll() {
    setSaving(true);
    try {
      const cleaned = items.filter((it) => it.text.trim().length > 0);
      const res = await adminFetch("/api/admin/bundle-banners", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marquee_items: cleaned }),
      });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.marquee_items)) setItems(d.marquee_items);
        onFeedback("Top Marquee saved & live!");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: "24px", fontSize: "13px", color: "#6b7280" }}>Loading marquee items...</div>;
  }

  return (
    <div style={{ padding: "12px 4px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#111827" }}>
            Top-of-Site Breaking News Marquee
          </h3>
          <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#6b7280" }}>
            Add multiple messages that scroll across the very top of your website. Link any message to a Promotion so it automatically hides when that promotion ends or is paused.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" className="btn-small" onClick={addItem}>
            + Add Ticker Message
          </button>
          <button type="button" style={blackBtnStyle} disabled={saving} onClick={saveAll}>
            {saving ? "Saving..." : "Save Marquee"}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          No marquee messages yet. Click <strong>+ Add Ticker Message</strong> to add one.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {items.map((item, idx) => {
            const linkedPromo = item.promotion_id
              ? promotions.find((p) => p.id === item.promotion_id)
              : null;
            return (
              <div
                key={item.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1.1fr auto",
                  gap: "10px",
                  alignItems: "center",
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#4b5563", marginBottom: "4px" }}>
                    Message #{idx + 1}
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. First 20 Customers Free Delivery!"
                    value={item.text}
                    onChange={(e) => updateItem(item.id, { text: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#4b5563", marginBottom: "4px" }}>
                    Visibility Rule
                  </label>
                  <select
                    style={inputStyle}
                    value={item.promotion_id || ""}
                    onChange={(e) => {
                      const pid = e.target.value || null;
                      const p = pid ? promotions.find((x) => x.id === pid) : null;
                      updateItem(item.id, {
                        promotion_id: pid,
                        text: p && !item.text.trim() ? p.title : item.text,
                      });
                    }}
                  >
                    <option value="">Always Show</option>
                    {promotions.map((p) => (
                      <option key={p.id} value={p.id}>
                        Only While Promo Live: {p.title}
                      </option>
                    ))}
                  </select>
                  {linkedPromo && !linkedPromo.is_active && (
                    <div style={{ fontSize: "11px", color: "#d97706", marginTop: "3px" }}>
                      Hidden right now (linked promotion is paused)
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "18px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={item.is_active}
                      onChange={(e) => updateItem(item.id, { is_active: e.target.checked })}
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    className="btn-small"
                    style={{ color: "#dc2626" }}
                    onClick={() => removeItem(item.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
