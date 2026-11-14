"use client";

import { use, useEffect, useState } from "react";

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
  const [deliveredSuccess, setDeliveredSuccess] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        setLoading(true);
        const res = await fetch(`/api/track/${orderNumber}`);
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error || "Dalabka lama helin (Order not found)");
        } else {
          setOrder(data.order);
          if (data.order.is_delivered) {
            setDeliveredSuccess(true);
          }
        }
      } catch {
        setError("Khalad ayaa dhacay intii dalabka la raadinayay.");
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderNumber]);

  async function handleConfirmDelivery() {
    if (!order) return;
    const ok = window.confirm("Ma xaqiijinaysaa inaad heshay alaabtii laguu siday? (Confirm order received?)");
    if (!ok) return;

    try {
      setConfirming(true);
      const res = await fetch(`/api/track/${orderNumber}`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeliveredSuccess(true);
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
      alert("Khalad ayaa dhacay intii la xaqiijinayay dalabka.");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ width: 44, height: 44, border: "4px solid #2BB686", borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#475569", fontWeight: 600 }}>Raadinta Dalabka #{orderNumber}...</p>
        </div>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", padding: 20 }}>
        <div style={{ maxWidth: 420, width: "100%", background: "#ffffff", borderRadius: 16, padding: 32, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 8, fontWeight: 700 }}>Dalabka Lama Helin</h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>{error || `Dalab lambarkiisu yahay #${orderNumber} lagama helin diiwaanka QuickSuuq.`}</p>
          <a href="https://quicksuuq-test.myshopify.com" style={{ display: "inline-block", background: "#2BB686", color: "#ffffff", padding: "12px 24px", borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
            Ku Noqo Dukaanka (Shop Now)
          </a>
        </div>
      </div>
    );
  }

  const steps = [
    { key: "PAID", label: "Dalabka Waa La Bixiyay", sub: "Order Placed & Paid", icon: "✓" },
    { key: "IN_PROCESS", label: "Diyaarin / Baakayn", sub: "Packing & Preparing", icon: "📦" },
    { key: "OUT_FOR_DELIVERY", label: "Wadada Ayuu Ku Jiraa", sub: "On the Road / Courier Out", icon: "🚚" },
    { key: "DELIVERED", label: "Waa La Gaarsiiyay", sub: "Delivered", icon: "🎉" },
  ];

  let currentStepIndex = 0;
  if (order.stage === "DELIVERED") currentStepIndex = 3;
  else if (order.stage === "OUT_FOR_DELIVERY") currentStepIndex = 2;
  else if (order.stage === "IN_PROCESS") currentStepIndex = 1;
  else currentStepIndex = 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#ffffff", padding: "8px 18px", borderRadius: 999, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: "#2BB686", letterSpacing: -0.5 }}>QuickSuuq</span>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>•</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Raadinta Dalabka (Order Tracking)</span>
          </div>
        </div>

        {/* Main Status Card */}
        <div style={{ background: "#ffffff", borderRadius: 20, padding: "24px 20px", boxShadow: "0 4px 20px rgba(15,23,42,0.06)", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: "1px solid #f1f5f9", paddingBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2BB686", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Dalabka</div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0 }}>{order.order_number}</h1>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Wadarta (Total)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{order.total}</div>
            </div>
          </div>

          {/* Stepper */}
          <div style={{ margin: "24px 0 8px" }}>
            {steps.map((st, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              const isFuture = idx > currentStepIndex;

              return (
                <div key={st.key} style={{ display: "flex", alignItems: "flex-start", position: "relative", marginBottom: idx < steps.length - 1 ? 24 : 0 }}>
                  {/* Vertical connector line */}
                  {idx < steps.length - 1 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 17,
                        top: 36,
                        bottom: -16,
                        width: 3,
                        background: idx < currentStepIndex ? "#2BB686" : "#e2e8f0",
                        zIndex: 1,
                      }}
                    />
                  )}

                  {/* Icon Circle */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: isPast ? "#2BB686" : isCurrent ? (order.stage === "DELIVERED" ? "#2BB686" : "#1E1B5E") : "#f8fafc",
                      border: isFuture ? "2px solid #cbd5e1" : "none",
                      color: isFuture ? "#94a3b8" : "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      marginRight: 16,
                      zIndex: 2,
                      boxShadow: isCurrent ? "0 0 0 4px rgba(43,182,134,0.2)" : "none",
                      flexShrink: 0,
                    }}
                  >
                    {isPast ? "✓" : st.icon}
                  </div>

                  {/* Label */}
                  <div style={{ flex: 1, paddingTop: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: isCurrent ? 800 : 600, color: isCurrent ? "#0f172a" : isPast ? "#1e293b" : "#94a3b8" }}>
                      {st.label}
                    </div>
                    <div style={{ fontSize: 11, color: isCurrent ? "#2BB686" : "#64748b", marginTop: 2 }}>
                      {isCurrent ? `Hadda (Current): ${st.sub}` : st.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 1-CLICK CONFIRM DELIVERED BUTTON */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px dashed #e2e8f0" }}>
            {deliveredSuccess || order.stage === "DELIVERED" ? (
              <div style={{ background: "#ecfdf5", border: "1.5px solid #a7f3d0", borderRadius: 14, padding: "16px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>🎉</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#065f46" }}>Waa La Gaarsiiyay!</div>
                <div style={{ fontSize: 12, color: "#047857", marginTop: 4 }}>
                  Mahadsanid! Waxaad xaqiijisay inaad heshay dalabkaagii QuickSuuq.
                </div>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={handleConfirmDelivery}
                  disabled={confirming}
                  style={{
                    width: "100%",
                    background: "#2BB686",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 14,
                    padding: "16px 20px",
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: confirming ? "wait" : "pointer",
                    boxShadow: "0 6px 18px rgba(43, 182, 134, 0.35)",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18 }}>✓</span>
                  <span>{confirming ? "Fadlan sug..." : "Waxaan Helay Dalabkayga (Confirm Received)"}</span>
                </button>
                <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 8 }}>
                  Guji batoonkaan markii uu darawalku alaabta gacanta kuugu dhiibo
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Driver Card (If Driver is Assigned) */}
        {order.driver_name && (
          <div style={{ background: "#ffffff", borderRadius: 18, padding: "18px 20px", boxShadow: "0 4px 16px rgba(0,0,0,0.04)", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Darawalka Kugu Soo Wada
              </div>
              <span style={{ fontSize: 11, background: "#f1f5f9", padding: "3px 8px", borderRadius: 99, color: "#475569", fontWeight: 600 }}>
                Gaariga: {order.vehicle}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  🛵
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{order.driver_name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{order.driver_phone || "Taleefan lama diiwaangelin"}</div>
                </div>
              </div>

              {order.driver_phone && (
                <a
                  href={`tel:${order.driver_phone}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#16a34a",
                    color: "#ffffff",
                    padding: "10px 16px",
                    borderRadius: 10,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span>📞</span> Wac
                </a>
              )}
            </div>
          </div>
        )}

        {/* Delivery Destination Card */}
        <div style={{ background: "#ffffff", borderRadius: 18, padding: "18px 20px", boxShadow: "0 4px 16px rgba(0,0,0,0.04)", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Goobta Gaarsiinta (Destination)
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📍</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{order.delivery_area}</div>
              {order.detailed_address && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{order.detailed_address}</div>
              )}
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div style={{ background: "#ffffff", borderRadius: 18, padding: "18px 20px", boxShadow: "0 4px 16px rgba(0,0,0,0.04)", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>
            Alaabta Dalabka ({order.items.length} items)
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {order.items.map((it, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: idx < order.items.length - 1 ? "1px solid #f1f5f9" : "none", paddingBottom: idx < order.items.length - 1 ? 10 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {it.image ? (
                    <img src={it.image} alt={it.title} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", background: "#f8fafc" }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🛒</div>
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>Tirada: {it.quantity}x</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                  ${(Number(it.price) * it.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Need Help Footer */}
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Ma qabtaa su'aal ama caawimaad ma u baahan tahay?</div>
          <a
            href="https://wa.me/252611024055?text=Asc%20QuickSuuq%20Support!%20Waxaan%20caawimaad%20uga%20baahanahay%20dalabkayga"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              padding: "8px 16px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <span>💬</span> QuickSuuq Customer Support (WhatsApp)
          </a>
        </div>

      </div>
    </div>
  );
}
