"use client";

import { useRef, useState } from "react";
import type { BannerElementConfig, BundleBannerRecord, BundleRecord } from "@/lib/promotions";

interface BundleBannersTabProps {
  banners: BundleBannerRecord[];
  bundles: BundleRecord[];
  adminFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onRefresh: () => Promise<void>;
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

function defaultElements(bundle?: BundleRecord): BannerElementConfig[] {
  return [
    {
      id: "title",
      text: bundle?.title || "Xirmada Qudaarta",
      x: 6,
      y: 16,
      fontSize: 28,
      fontWeight: "800",
      fontFamily: "sans",
      color: "#ffffff",
      visible: true,
    },
    {
      id: "subtitle",
      text: bundle?.description || "Fresh weekly family pack · Delivered fast",
      x: 6,
      y: 38,
      fontSize: 15,
      fontWeight: "400",
      fontFamily: "sans",
      color: "#ecfdf5",
      visible: true,
    },
    {
      id: "price",
      text: "",
      x: 6,
      y: 55,
      fontSize: 22,
      fontWeight: "800",
      fontFamily: "sans",
      color: "#ffffff",
      visible: true,
    },
    {
      id: "button",
      text: "Buy Now",
      x: 6,
      y: 74,
      fontSize: 14,
      fontWeight: "700",
      fontFamily: "sans",
      color: "#111827",
      bgColor: "#ffffff",
      visible: true,
    },
  ];
}

function fontCss(fam: BannerElementConfig["fontFamily"]) {
  if (fam === "serif") return "Georgia, Cambria, serif";
  if (fam === "mono") return "ui-monospace, SFMono-Regular, Menlo, monospace";
  return "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
}

export default function BundleBannersTab({
  banners,
  bundles,
  adminFetch,
  onRefresh,
  onFeedback,
}: BundleBannersTabProps) {
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bundleId, setBundleId] = useState<string>(bundles[0]?.id || "");
  const [bgImage, setBgImage] = useState<string>("");
  const [bgColor, setBgColor] = useState<string>("#0e8a60");
  const [elements, setElements] = useState<BannerElementConfig[]>(defaultElements(bundles[0]));
  const [selectedId, setSelectedId] = useState<BannerElementConfig["id"]>("title");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{
    id: BannerElementConfig["id"];
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const isAllBundles = bundleId === "ALL_BUNDLES";
  const linkedBundle = isAllBundles ? undefined : bundles.find((b) => b.id === bundleId);
  const selectedEl = elements.find((e) => e.id === selectedId) || elements[0];

  function openNew() {
    const first = bundles[0];
    setEditingId(null);
    setBundleId(first?.id || "");
    setBgImage("");
    setBgColor("#0e8a60");
    setElements(defaultElements(first));
    setSelectedId("title");
    setIsActive(true);
    setEditing(true);
  }

  function openEdit(bn: BundleBannerRecord) {
    setEditingId(bn.id);
    setBundleId(bn.bundle_id);
    setBgImage(bn.bg_image || "");
    setBgColor(bn.bg_color || "#0e8a60");
    setElements(bn.elements.length > 0 ? bn.elements : defaultElements(bundles.find((b) => b.id === bn.bundle_id)));
    setSelectedId("title");
    setIsActive(bn.is_active);
    setEditing(true);
  }

  function updateElement(id: BannerElementConfig["id"], patch: Partial<BannerElementConfig>) {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...patch } : el)));
  }

  function onPointerDownElement(e: React.PointerEvent, el: BannerElementConfig) {
    e.stopPropagation();
    setSelectedId(el.id);
    draggingRef.current = {
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMoveElement(e: React.PointerEvent) {
    const d = draggingRef.current;
    const box = canvasRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dxPct = ((e.clientX - d.startX) / box.width) * 100;
    const dyPct = ((e.clientY - d.startY) / box.height) * 100;
    const nextX = Math.max(2, Math.min(85, Math.round((d.origX + dxPct) * 10) / 10));
    const nextY = Math.max(4, Math.min(86, Math.round((d.origY + dyPct) * 10) / 10));
    updateElement(d.id, { x: nextX, y: nextY });
  }

  function onPointerUpElement() {
    draggingRef.current = null;
  }

  async function handleSave() {
    if (!bundleId) {
      alert("Please select a bundle.");
      return;
    }
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/bundle-banners", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId || undefined,
          bundle_id: bundleId,
          bg_image: bgImage.trim() || null,
          bg_color: bgColor,
          elements,
          is_active: isActive,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to save banner");
        return;
      }
      setEditing(false);
      await onRefresh();
      onFeedback(editingId ? "Banner updated!" : "Banner created!");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this bundle banner?")) return;
    const res = await adminFetch(`/api/admin/bundle-banners?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await onRefresh();
      onFeedback("Banner deleted.");
    }
  }

  if (editing) {
    const reg = linkedBundle ? Number(linkedBundle.regular_price || 0) : 20;
    const hasFlash =
      linkedBundle?.promo_price &&
      linkedBundle.promo_price > 0 &&
      (!linkedBundle.promo_ends_at || new Date(linkedBundle.promo_ends_at).getTime() > Date.now());
    const eff = linkedBundle ? Number(hasFlash ? linkedBundle.promo_price : linkedBundle.bundle_price) : 15;
    const saveAmt = Math.max(0, reg - eff);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "12px 4px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#111827" }}>
              {editingId ? "Edit Bundle Banner" : "Design Bundle Banner"}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#6b7280" }}>
              Drag any text or button on the preview to position it, then click it to style font, bold & color.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="btn-secondary" style={{ padding: "8px 14px", borderRadius: "8px" }} onClick={() => setEditing(false)}>
              ← Back
            </button>
            <button type="button" style={blackBtnStyle} disabled={saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save Banner"}
            </button>
          </div>
        </div>

        {/* Bundle & Background Controls */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", background: "#f9fafb", padding: "14px", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Link Banner To</label>
            <select
              style={inputStyle}
              value={bundleId}
              onChange={(e) => {
                const nextId = e.target.value;
                setBundleId(nextId);
                if (nextId === "ALL_BUNDLES") {
                  updateElement("title", { text: "Shop All Bundles" });
                  updateElement("subtitle", { text: "Explore all fresh combo packs & save" });
                  updateElement("button", { text: "View All Bundles" });
                  return;
                }
                const found = bundles.find((b) => b.id === nextId);
                if (found) {
                  updateElement("title", { text: found.title });
                  if (found.description) updateElement("subtitle", { text: found.description });
                  updateElement("button", { text: "Buy Now" });
                }
              }}
            >
              <option value="ALL_BUNDLES">All Bundles Page (/pages/bundles)</option>
              {bundles.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} (${b.bundle_price.toFixed(2)})
                </option>
              ))}
            </select>
            <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
              {isAllBundles
                ? "Clicking the button opens /pages/bundles (all bundles)."
                : "Auto-removed if this bundle is deleted."}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Background Color</label>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ width: "40px", height: "36px", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer" }} />
              <input style={inputStyle} value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Background Image (optional)</label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="URL or Upload" value={bgImage} onChange={(e) => setBgImage(e.target.value)} />
              <label style={{ cursor: "pointer", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "8px", background: "#fff", fontSize: "12px", fontWeight: 600 }}>
                Upload
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => { if (typeof r.result === "string") setBgImage(r.result); };
                    r.readAsDataURL(f);
                  }}
                />
              </label>
            </div>
            <div style={{ fontSize: "11px", color: "#008060", fontWeight: 600, marginTop: "4px" }}>
              Recommended size: 1200 × 280 px (4:1 wide banner, JPG/PNG/WebP)
            </div>
          </div>
        </div>

        {/* DRAG & DROP LIVE CANVAS */}
        <div
          ref={canvasRef}
          onPointerMove={onPointerMoveElement}
          onPointerUp={onPointerUpElement}
          style={{
            position: "relative",
            width: "100%",
            height: "280px",
            borderRadius: "14px",
            overflow: "hidden",
            backgroundColor: bgColor,
            backgroundImage: bgImage ? `linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.28)), url(${bgImage})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            border: "2px dashed #cbd5e1",
            userSelect: "none",
          }}
        >
          {elements.map((el) => {
            if (!el.visible) return null;
            const isSel = selectedId === el.id;
            const commonStyle: React.CSSProperties = {
              position: "absolute",
              left: `${el.x}%`,
              top: `${el.y}%`,
              fontSize: `${el.fontSize}px`,
              fontWeight: el.fontWeight,
              fontFamily: fontCss(el.fontFamily),
              color: el.color,
              cursor: "grab",
              outline: isSel ? "2px dashed #facc15" : "1px dashed transparent",
              outlineOffset: "4px",
              padding: el.id === "button" ? "9px 20px" : "2px 4px",
              borderRadius: el.id === "button" ? "9px" : "4px",
              background: el.id === "button" ? el.bgColor || "#ffffff" : "transparent",
              whiteSpace: "nowrap",
            };

            if (el.id === "price") {
              if (isAllBundles) return null;
              return (
                <div
                  key={el.id}
                  onPointerDown={(e) => onPointerDownElement(e, el)}
                  style={commonStyle}
                >
                  <span>${eff.toFixed(2)}</span>{" "}
                  {reg > eff && (
                    <>
                      <span style={{ fontSize: `${Math.max(12, el.fontSize - 6)}px`, opacity: 0.78, textDecoration: "line-through", fontWeight: "400" }}>
                        ${reg.toFixed(2)}
                      </span>{" "}
                      <span style={{ fontSize: "12px", background: "rgba(255,255,255,0.22)", padding: "3px 8px", borderRadius: "999px", fontWeight: 700 }}>
                        Save ${saveAmt.toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
              );
            }

            return (
              <div
                key={el.id}
                onPointerDown={(e) => onPointerDownElement(e, el)}
                style={commonStyle}
              >
                {el.text}
              </div>
            );
          })}
        </div>

        {/* SELECTED ELEMENT STYLE TOOLBAR */}
        {selectedEl && (
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "#4b5563", marginBottom: "4px" }}>
                Selected: {selectedEl.id.toUpperCase()}
              </label>
              {selectedEl.id !== "price" ? (
                <input
                  style={inputStyle}
                  value={selectedEl.text}
                  onChange={(e) => updateElement(selectedEl.id, { text: e.target.value })}
                />
              ) : (
                <div style={{ fontSize: "12px", color: "#6b7280", padding: "8px 0" }}>Auto-synced from bundle</div>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, marginBottom: "4px" }}>Font Size (px)</label>
              <input
                style={inputStyle}
                type="number"
                min="11"
                max="44"
                value={selectedEl.fontSize}
                onChange={(e) => updateElement(selectedEl.id, { fontSize: Number(e.target.value) || 14 })}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, marginBottom: "4px" }}>Weight</label>
              <button
                type="button"
                onClick={() => updateElement(selectedEl.id, { fontWeight: selectedEl.fontWeight === "800" || selectedEl.fontWeight === "700" ? "400" : "800" })}
                style={{
                  ...inputStyle,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: selectedEl.fontWeight === "400" ? "#fff" : "#1f2937",
                  color: selectedEl.fontWeight === "400" ? "#111827" : "#fff",
                }}
              >
                {selectedEl.fontWeight === "400" ? "Normal" : "Bold (B)"}
              </button>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, marginBottom: "4px" }}>Font Style</label>
              <select
                style={inputStyle}
                value={selectedEl.fontFamily}
                onChange={(e) => updateElement(selectedEl.id, { fontFamily: e.target.value as BannerElementConfig["fontFamily"] })}
              >
                <option value="sans">Modern Sans</option>
                <option value="serif">Classic Serif</option>
                <option value="mono">Clean Mono</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, marginBottom: "4px" }}>Text Color</label>
              <input
                type="color"
                value={selectedEl.color}
                onChange={(e) => updateElement(selectedEl.id, { color: e.target.value })}
                style={{ width: "100%", height: "36px", border: "1px solid #d1d5db", borderRadius: "8px", cursor: "pointer" }}
              />
            </div>

            {selectedEl.id === "button" && (
              <div>
                <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, marginBottom: "4px" }}>Button Color</label>
                <input
                  type="color"
                  value={selectedEl.bgColor || "#ffffff"}
                  onChange={(e) => updateElement("button", { bgColor: e.target.value })}
                  style={{ width: "100%", height: "36px", border: "1px solid #d1d5db", borderRadius: "8px", cursor: "pointer" }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 4px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
          Design slideable Home Page Bundle Banners with drag-and-drop text, fonts, prices & Buy Now buttons.
        </p>
        <button type="button" style={blackBtnStyle} onClick={openNew}>
          + New Bundle Banner
        </button>
      </div>

      {banners.length === 0 ? (
        <div className="empty-state">No bundle banners yet. Click <strong>+ New Bundle Banner</strong> to design one.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
          {banners.map((bn) => {
            const isAll = bn.bundle_id === "ALL_BUNDLES";
            const b = isAll ? null : bundles.find((x) => x.id === bn.bundle_id);
            const titleEl = bn.elements?.find((e) => e.id === "title");
            return (
              <div key={bn.id} style={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden", background: "#fff" }}>
                <div
                  style={{
                    height: "130px",
                    backgroundColor: bn.bg_color,
                    backgroundImage: bn.bg_image ? `linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.28)), url(${bn.bg_image})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    padding: "14px",
                    color: "#fff",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ fontSize: "16px", fontWeight: 800 }}>{b?.title || titleEl?.text || "Bundle Banner"}</div>
                  {isAll ? (
                    <div style={{ fontSize: "12.5px", marginTop: "4px", opacity: 0.92 }}>
                      Links to /pages/bundles (All Bundles)
                    </div>
                  ) : b ? (
                    <div style={{ fontSize: "13px", marginTop: "4px" }}>
                      ${b.bundle_price.toFixed(2)} {b.regular_price > b.bundle_price ? `(was $${b.regular_price.toFixed(2)})` : ""}
                    </div>
                  ) : null}
                </div>
                <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb", borderTop: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: bn.is_active ? "#008060" : "#6b7280" }}>
                    {bn.is_active ? "Active Slide" : "Hidden"}
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button type="button" style={{ ...blackBtnStyle, padding: "5px 12px", fontSize: "12px", borderRadius: "6px" }} onClick={() => openEdit(bn)}>
                      Edit
                    </button>
                    <button type="button" className="btn-small" style={{ color: "#dc2626" }} onClick={() => handleDelete(bn.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
