"use client";

import { use, useEffect, useState, useCallback } from "react";

interface TrackItem {
  title: string;
  quantity: number;
  price: string;
  image: string | null;
}

interface TrackOrder {
  gid: string;
  order_number: string;
  created_at: string;
  total: string;
  stage: "UNPAID" | "NOT_PREPARED" | "IN_PROCESS" | "OUT_FOR_DELIVERY" | "DELIVERED";
  delivery_status: string;
  delivery_area: string;
  detailed_address: string;
  driver_name: string;
  driver_phone: string;
  vehicle: string;
  items: TrackItem[];
  is_delivered: boolean;
}

export default function OrderTrackPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = use(params);
  const [order, setOrder] = useState<TrackOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fetchOrder = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetch(`/api/track/${orderNumber}?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (isInitial) setError(data.error || "Order not found");
      } else {
        setOrder(data.order);
        setError(null);
      }
    } catch {
      if (isInitial) setError("Could not load order status.");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    fetchOrder(true);
    // Poll every 5 seconds so status updates from Admin appear live
    const interval = setInterval(() => {
      fetchOrder(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  async function handleConfirmDelivery() {
    if (!order) return;
    const ok = window.confirm("Confirm that you have received your order?");
    if (!ok) return;

    try {
      setConfirming(true);
      const res = await fetch(`/api/track/${orderNumber}`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrder({
          ...order,
          stage: "DELIVERED",
          is_delivered: true,
          delivery_status: "5. Delivered",
        });
      } else {
        alert(data.error || "Failed to confirm delivery");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f6f7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: "3px solid #e1e3e5", borderTopColor: "#111827", borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.7s linear infinite" }} />
          <p style={{ color: "#6d7175", fontSize: 13, fontWeight: 500 }}>Loading Order #{orderNumber}...</p>
        </div>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f6f7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: 16 }}>
        <div style={{ maxWidth: 400, width: "100%", background: "#ffffff", borderRadius: 12, border: "1px solid #e1e3e5", padding: 28, textAlign: "center" }}>
          <h2 style={{ fontSize: 18, color: "#111827", margin: "0 0 8px", fontWeight: 600 }}>Order Not Found</h2>
          <p style={{ color: "#6d7175", fontSize: 13, margin: "0 0 20px" }}>{error || `Order #${orderNumber} could not be found.`}</p>
          <a href="https://quicksuuq-test.myshopify.com" style={{ display: "inline-block", background: "#111827", color: "#ffffff", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 13 }}>
            Back to Store
          </a>
        </div>
      </div>
    );
  }

  const steps = [
    { key: "PAID", label: "Paid", somali: "La Bixiyay" },
    { key: "IN_PROCESS", label: "Preparing", somali: "Diyaarin" },
    { key: "OUT_FOR_DELIVERY", label: "On the Way", somali: "Wadada" },
    { key: "DELIVERED", label: "Delivered", somali: "La Helay" },
  ];

  let currentIdx = 0;
  if (order.stage === "DELIVERED") currentIdx = 3;
  else if (order.stage === "OUT_FOR_DELIVERY") currentIdx = 2;
  else if (order.stage === "IN_PROCESS") currentIdx = 1;
  else currentIdx = 0;

  const badgeStyles: Record<string, { label: string; bg: string; color: string }> = {
    UNPAID: { label: "Unpaid", bg: "#fef3c7", color: "#92400e" },
    NOT_PREPARED: { label: "Order Confirmed", bg: "#e0f2fe", color: "#075985" },
    IN_PROCESS: { label: "Preparing Order", bg: "#ede9fe", color: "#5b21b6" },
    OUT_FOR_DELIVERY: { label: "Out for Delivery", bg: "#dcfce7", color: "#166534" },
    DELIVERED: { label: "Delivered", bg: "#d1fae5", color: "#065f46" },
  };
  const badge = badgeStyles[order.stage] || badgeStyles.NOT_PREPARED;

  return (
    <div style={{ minHeight: "100vh", background: "#f6f6f7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#202223", padding: "24px 16px 48px" }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>

        {/* Top Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: -0.4 }}>QuickSuuq</span>
          <span style={{ fontSize: 12, color: "#6d7175", fontWeight: 500 }}>Live Order Status</span>
        </div>

        {/* Main Order Status Card */}
        <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e1e3e5", padding: "20px", marginBottom: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 12, color: "#6d7175", fontWeight: 500 }}>Order {order.order_number}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginTop: 2 }}>{order.total}</div>
            </div>
            <span style={{ background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999 }}>
              {badge.label}
            </span>
          </div>

          {/* Clean Horizontal Progress Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 20 }}>
            {steps.map((st, idx) => {
              const done = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              return (
                <div key={st.key}>
                  <div style={{ height: 5, borderRadius: 99, background: done ? "#008060" : "#e1e3e5", marginBottom: 8, transition: "background 0.3s ease" }} />
                  <div style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: done ? "#111827" : "#8c9196" }}>
                    {st.label}
                  </div>
                  <div style={{ fontSize: 10, color: "#8c9196" }}>{st.somali}</div>
                </div>
              );
            })}
          </div>

          {/* 1-Click Confirm Delivery Button */}
          {order.stage === "DELIVERED" ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>✓</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>Order Delivered</div>
                <div style={{ fontSize: 12, color: "#15803d" }}>Mahadsanid! Delivery confirmed.</div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConfirmDelivery}
              disabled={confirming}
              style={{
                width: "100%",
                background: "#008060",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: confirming ? "wait" : "pointer",
              }}
            >
              {confirming ? "Confirming..." : "✓ I Received My Order (Waxaan Helay Dalabkayga)"}
            </button>
          )}
        </div>

        {/* Driver Card (Shown when driver is assigned) */}
        {order.driver_name && (
          <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e1e3e5", padding: "16px 20px", marginBottom: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6d7175", marginBottom: 10 }}>Delivery Driver</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{order.driver_name}</div>
                <div style={{ fontSize: 12, color: "#6d7175", marginTop: 2 }}>
                  {order.vehicle} {order.driver_phone ? `· ${order.driver_phone}` : ""}
                </div>
              </div>
              {order.driver_phone && (
                <a
                  href={`tel:${order.driver_phone}`}
                  style={{
                    background: "#111827",
                    color: "#ffffff",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Call Driver
                </a>
              )}
            </div>
          </div>
        )}

        {/* Delivery Address */}
        <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e1e3e5", padding: "16px 20px", marginBottom: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6d7175", marginBottom: 6 }}>Delivery Address</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{order.delivery_area}</div>
          {order.detailed_address && (
            <div style={{ fontSize: 12, color: "#6d7175", marginTop: 2 }}>{order.detailed_address}</div>
          )}
        </div>

        {/* Order Items */}
        <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e1e3e5", padding: "16px 20px", marginBottom: 20, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6d7175", marginBottom: 12 }}>Items ({order.items.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {order.items.map((it, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: idx < order.items.length - 1 ? "1px solid #f1f2f3" : "none", paddingBottom: idx < order.items.length - 1 ? 10 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {it.image ? (
                    <img src={it.image} alt={it.title} style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", border: "1px solid #e1e3e5" }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 6, background: "#f6f6f7", border: "1px solid #e1e3e5" }} />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{it.title}</div>
                    <div style={{ fontSize: 12, color: "#6d7175" }}>Qty: {it.quantity}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  ${(Number(it.price) * it.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Support Footer */}
        <div style={{ textAlign: "center" }}>
          <a
            href="https://wa.me/252611024055?text=Asc%20QuickSuuq%20Support"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: "#008060", fontWeight: 600, textDecoration: "none" }}
          >
            Need help? Message QuickSuuq Support →
          </a>
        </div>

      </div>
    </div>
  );
}
