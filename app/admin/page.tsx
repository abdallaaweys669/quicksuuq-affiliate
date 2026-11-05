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

interface DeliveryArea {
  id: number;
  name: string;
  category: string;
  fee_usd: number;
  is_active: boolean;
  sort_order: number;
}

interface DeliveryVehicle {
  id: number;
  name: string;
  min_weight_kg: number;
  max_weight_kg: number;
  is_active: boolean;
}

interface DeliveryDriver {
  id: number;
  name: string;
  phone: string;
  vehicle_type: string;
  plate_number: string;
  status: string;
  is_active: boolean;
}

export default function AdminDashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<"commissions" | "salespeople" | "payouts" | "delivery">("commissions");
  const [deliverySubTab, setDeliverySubTab] = useState<"areas" | "vehicles" | "drivers">("areas");

  // Data states
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>([]);
  const [deliveryVehicles, setDeliveryVehicles] = useState<DeliveryVehicle[]>([]);
  const [deliveryDrivers, setDeliveryDrivers] = useState<DeliveryDriver[]>([]);
  const [heavyWeightKg, setHeavyWeightKg] = useState("100");
  const [heavySurchargeUsd, setHeavySurchargeUsd] = useState("1.00");

  // Delivery CRUD form states
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaCategory, setNewAreaCategory] = useState("A");
  const [newAreaFee, setNewAreaFee] = useState("1.50");
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [editAreaName, setEditAreaName] = useState("");
  const [editAreaCategory, setEditAreaCategory] = useState("A");
  const [editAreaFee, setEditAreaFee] = useState("");

  const [newVehicleName, setNewVehicleName] = useState("");
  const [newVehicleMinKg, setNewVehicleMinKg] = useState("0");
  const [newVehicleMaxKg, setNewVehicleMaxKg] = useState("20");
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [editVehicleName, setEditVehicleName] = useState("");
  const [editVehicleMinKg, setEditVehicleMinKg] = useState("");
  const [editVehicleMaxKg, setEditVehicleMaxKg] = useState("");

  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newDriverVehicle, setNewDriverVehicle] = useState("Bajaj");
  const [newDriverPlate, setNewDriverPlate] = useState("");
  const [editingDriverId, setEditingDriverId] = useState<number | null>(null);
  const [editDriverName, setEditDriverName] = useState("");
  const [editDriverPhone, setEditDriverPhone] = useState("");
  const [editDriverVehicle, setEditDriverVehicle] = useState("");
  const [editDriverPlate, setEditDriverPlate] = useState("");
  const [editDriverStatus, setEditDriverStatus] = useState("Available");

  // Delivery Search, Filter & Modal states
  const [showAddAreaModal, setShowAddAreaModal] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [areaSearch, setAreaSearch] = useState("");
  const [areaCatFilter, setAreaCatFilter] = useState("ALL");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [driverVehicleFilter, setDriverVehicleFilter] = useState("ALL");
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
      const [repsRes, commsRes, paysRes, delivRes] = await Promise.all([
        adminFetch("/api/admin/salespeople"),
        adminFetch("/api/admin/commissions"),
        adminFetch("/api/admin/payouts"),
        adminFetch("/api/admin/delivery"),
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
      if (delivRes.ok) {
        const d = await delivRes.json();
        setDeliveryAreas(d.areas || []);
        setDeliveryVehicles(d.vehicles || []);
        setDeliveryDrivers(d.drivers || []);
        if (d.settings) {
          setHeavyWeightKg(String(d.settings.heavy_weight_threshold_kg ?? 100));
          setHeavySurchargeUsd(Number(d.settings.heavy_surcharge_usd ?? 1).toFixed(2));
        }
      }
    } catch (e) {
      console.error("Error loading admin data:", e);
    }
  }

  async function handleSaveHeavySettings(e: React.FormEvent) {
    e.preventDefault();
    const res = await adminFetch("/api/admin/delivery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "settings",
        heavy_weight_threshold_kg: parseFloat(heavyWeightKg) || 100,
        heavy_surcharge_usd: parseFloat(heavySurchargeUsd) || 1.0,
      }),
    });
    if (res.ok) {
      showFeedback("Saved Heavy Order Surcharge rule!");
      await loadAllData();
    } else {
      alert("Failed to save heavy order settings.");
    }
  }

  async function handleAddArea(e: React.FormEvent) {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    const res = await adminFetch("/api/admin/delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "area",
        name: newAreaName.trim(),
        category: newAreaCategory,
        fee_usd: parseFloat(newAreaFee) || 1.5,
      }),
    });
    if (res.ok) {
      setShowAddAreaModal(false);
      setNewAreaName("");
      await loadAllData();
      showFeedback(`Added delivery area ${newAreaName}!`);
    } else {
      const d = await res.json();
      alert(d.error || "Failed to add area");
    }
  }

  async function handleSaveAreaEdit(area: DeliveryArea) {
    const res = await adminFetch("/api/admin/delivery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "area",
        id: area.id,
        name: editAreaName.trim() || area.name,
        category: editAreaCategory,
        fee_usd: parseFloat(editAreaFee) || area.fee_usd,
        is_active: area.is_active,
      }),
    });
    if (res.ok) {
      setEditingAreaId(null);
      await loadAllData();
      showFeedback(`Updated area ${editAreaName}!`);
    }
  }

  async function handleToggleAreaActive(area: DeliveryArea) {
    const res = await adminFetch("/api/admin/delivery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "area",
        id: area.id,
        name: area.name,
        category: area.category,
        fee_usd: area.fee_usd,
        is_active: !area.is_active,
      }),
    });
    if (res.ok) {
      await loadAllData();
      showFeedback(`${area.name} is now ${!area.is_active ? "Active" : "Disabled"}`);
    }
  }

  async function handleDeleteArea(area: DeliveryArea) {
    if (!confirm(`Delete delivery area "${area.name}"?`)) return;
    const res = await adminFetch(`/api/admin/delivery?entity=area&id=${area.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await loadAllData();
      showFeedback(`Deleted area ${area.name}`);
    }
  }

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!newVehicleName.trim()) return;
    const res = await adminFetch("/api/admin/delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "vehicle",
        name: newVehicleName.trim(),
        min_weight_kg: parseFloat(newVehicleMinKg) || 0,
        max_weight_kg: parseFloat(newVehicleMaxKg) || 20,
      }),
    });
    if (res.ok) {
      setShowAddVehicleModal(false);
      setNewVehicleName("");
      await loadAllData();
      showFeedback(`Added vehicle ${newVehicleName}!`);
    }
  }

  async function handleSaveVehicleEdit(v: DeliveryVehicle) {
    const res = await adminFetch("/api/admin/delivery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "vehicle",
        id: v.id,
        name: editVehicleName.trim() || v.name,
        min_weight_kg: parseFloat(editVehicleMinKg) || 0,
        max_weight_kg: parseFloat(editVehicleMaxKg) || v.max_weight_kg,
        is_active: v.is_active,
      }),
    });
    if (res.ok) {
      setEditingVehicleId(null);
      await loadAllData();
      showFeedback(`Updated vehicle ${editVehicleName}!`);
    }
  }

  async function handleDeleteVehicle(v: DeliveryVehicle) {
    if (!confirm(`Delete vehicle "${v.name}"?`)) return;
    const res = await adminFetch(`/api/admin/delivery?entity=vehicle&id=${v.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await loadAllData();
      showFeedback(`Deleted vehicle ${v.name}`);
    }
  }

  async function handleAddDriver(e: React.FormEvent) {
    e.preventDefault();
    if (!newDriverName.trim() || !newDriverPhone.trim()) return;
    const res = await adminFetch("/api/admin/delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "driver",
        name: newDriverName.trim(),
        phone: newDriverPhone.trim(),
        vehicle_type: newDriverVehicle,
        plate_number: newDriverPlate.trim(),
        status: "Available",
      }),
    });
    if (res.ok) {
      setShowAddDriverModal(false);
      setNewDriverName("");
      setNewDriverPhone("");
      setNewDriverPlate("");
      await loadAllData();
      showFeedback(`Added driver ${newDriverName} & synced to Shopify Orders!`);
    }
  }

  async function handleSaveDriverEdit(d: DeliveryDriver) {
    const res = await adminFetch("/api/admin/delivery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "driver",
        id: d.id,
        name: editDriverName.trim() || d.name,
        phone: editDriverPhone.trim() || d.phone,
        vehicle_type: editDriverVehicle || d.vehicle_type,
        plate_number: editDriverPlate.trim(),
        status: editDriverStatus || d.status,
        is_active: d.is_active,
      }),
    });
    if (res.ok) {
      setEditingDriverId(null);
      await loadAllData();
      showFeedback(`Updated driver ${editDriverName} & synced to Shopify Orders!`);
    }
  }

  async function handleDeleteDriver(d: DeliveryDriver) {
    if (!confirm(`Delete driver "${d.name}"?`)) return;
    const res = await adminFetch(`/api/admin/delivery?entity=driver&id=${d.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await loadAllData();
      showFeedback(`Deleted driver ${d.name} & updated Shopify Orders dropdown!`);
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
            <button
              className={`tab-btn ${activeTab === "delivery" ? "active" : ""}`}
              onClick={() => setActiveTab("delivery")}
            >
              🚚 Delivery & Logistics ({deliveryAreas.length} Areas · {deliveryDrivers.length} Drivers)
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

        {/* Tab 4: Delivery & Logistics CRUD */}
        {activeTab === "delivery" && (
          <div style={{ padding: "20px 24px" }}>
            {/* Heavy Order Rule Box */}
            <form
              onSubmit={handleSaveHeavySettings}
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "16px 20px",
                marginBottom: "22px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                gap: "16px",
              }}
            >
              <div style={{ flex: "1 1 220px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                  ⚖️ Heavy Order Surcharge Rule
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                  Adds an extra fee automatically on checkout when total cart weight exceeds the limit.
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Weight Limit (kg)
                </label>
                <input
                  type="number"
                  step="1"
                  value={heavyWeightKg}
                  onChange={(e) => setHeavyWeightKg(e.target.value)}
                  style={{ width: "110px", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Extra Fee ($)
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={heavySurchargeUsd}
                  onChange={(e) => setHeavySurchargeUsd(e.target.value)}
                  style={{ width: "110px", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <button type="submit" className="btn-action primary" style={{ height: "36px" }}>
                Save Heavy Rule
              </button>
            </form>

            {/* Sub-navigation for Areas / Vehicles / Drivers */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "18px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
              <button
                type="button"
                onClick={() => setDeliverySubTab("areas")}
                className={`btn-action ${deliverySubTab === "areas" ? "primary" : "secondary"}`}
              >
                📍 Delivery Areas & Prices ({deliveryAreas.length})
              </button>
              <button
                type="button"
                onClick={() => setDeliverySubTab("vehicles")}
                className={`btn-action ${deliverySubTab === "vehicles" ? "primary" : "secondary"}`}
              >
                🛵 Vehicles & Weight Limits ({deliveryVehicles.length})
              </button>
              <button
                type="button"
                onClick={() => setDeliverySubTab("drivers")}
                className={`btn-action ${deliverySubTab === "drivers" ? "primary" : "secondary"}`}
              >
                👨‍✈️ Drivers Registry ({deliveryDrivers.length})
              </button>
            </div>

            {/* SUB-TAB 1: DELIVERY AREAS CRUD */}
            {deliverySubTab === "areas" && (
              <div>
                {/* Search & Filter Bar + Add Area Button */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                    background: "#f8fafc",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", flex: "1 1 320px" }}>
                    <input
                      type="text"
                      placeholder="🔍 Search area name (e.g. Hodan, Garasbaaley)..."
                      value={areaSearch}
                      onChange={(e) => setAreaSearch(e.target.value)}
                      style={{ flex: "1 1 220px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    />
                    <select
                      value={areaCatFilter}
                      onChange={(e) => setAreaCatFilter(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                    >
                      <option value="ALL">All Categories</option>
                      <option value="A">Category A ($1.50)</option>
                      <option value="B">Category B ($2.00)</option>
                      <option value="C">Category C ($3.00)</option>
                      <option value="D">Category D ($3.50)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddAreaModal(true)}
                    className="btn-action primary"
                    style={{ height: "36px" }}
                  >
                    + Add Area
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Area Name</th>
                        <th>Category</th>
                        <th>Delivery Fee ($)</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryAreas
                        .filter((a) => {
                          const matchSearch =
                            !areaSearch.trim() ||
                            a.name.toLowerCase().includes(areaSearch.trim().toLowerCase());
                          const matchCat = areaCatFilter === "ALL" || a.category === areaCatFilter;
                          return matchSearch && matchCat;
                        })
                        .map((a) => (
                          <tr key={a.id}>
                            <td className="bold-cell">
                              {editingAreaId === a.id ? (
                                <input
                                  type="text"
                                  value={editAreaName}
                                  onChange={(e) => setEditAreaName(e.target.value)}
                                  style={{ padding: "5px 8px", borderRadius: "5px", border: "1px solid #94a3b8" }}
                                />
                              ) : (
                                a.name
                              )}
                            </td>
                            <td>
                              {editingAreaId === a.id ? (
                                <select
                                  value={editAreaCategory}
                                  onChange={(e) => setEditAreaCategory(e.target.value)}
                                  style={{ padding: "5px 8px", borderRadius: "5px", border: "1px solid #94a3b8" }}
                                >
                                  <option value="A">Category A</option>
                                  <option value="B">Category B</option>
                                  <option value="C">Category C</option>
                                  <option value="D">Category D</option>
                                </select>
                              ) : (
                                <span style={{ fontSize: "14px", fontWeight: 500, color: "#334155" }}>
                                  Category {a.category}
                                </span>
                              )}
                            </td>
                            <td className="bold-cell green-cell">
                              {editingAreaId === a.id ? (
                                <input
                                  type="number"
                                  step="0.25"
                                  value={editAreaFee}
                                  onChange={(e) => setEditAreaFee(e.target.value)}
                                  style={{ width: "90px", padding: "5px 8px", borderRadius: "5px", border: "1px solid #94a3b8" }}
                                />
                              ) : (
                                `$${Number(a.fee_usd).toFixed(2)}`
                              )}
                            </td>
                            <td>
                              <span className={`status-pill ${a.is_active ? "active-pill" : "voided"}`}>
                                {a.is_active ? "Active" : "Disabled"}
                              </span>
                            </td>
                            <td>
                              <div className="btn-group">
                                {editingAreaId === a.id ? (
                                  <>
                                    <button onClick={() => handleSaveAreaEdit(a)} className="btn-tiny approve">
                                      Save
                                    </button>
                                    <button onClick={() => setEditingAreaId(null)} className="btn-tiny">
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingAreaId(a.id);
                                        setEditAreaName(a.name);
                                        setEditAreaCategory(a.category);
                                        setEditAreaFee(Number(a.fee_usd).toFixed(2));
                                      }}
                                      className="btn-tiny"
                                    >
                                      Edit
                                    </button>
                                    <button onClick={() => handleToggleAreaActive(a)} className="btn-tiny">
                                      {a.is_active ? "Disable" : "Enable"}
                                    </button>
                                    <button onClick={() => handleDeleteArea(a)} className="btn-tiny" style={{ color: "#dc2626" }}>
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: VEHICLES CRUD */}
            {deliverySubTab === "vehicles" && (
              <div>
                {/* Search Bar + Add Vehicle Button */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                    background: "#f8fafc",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <input
                    type="text"
                    placeholder="🔍 Search vehicle type (e.g. Fekon, Bajaj)..."
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    style={{ flex: "1 1 240px", maxWidth: "380px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddVehicleModal(true)}
                    className="btn-action primary"
                    style={{ height: "36px" }}
                  >
                    + Add Vehicle
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Vehicle Name</th>
                        <th>Min Weight (kg)</th>
                        <th>Max Capacity (kg)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryVehicles
                        .filter(
                          (v) =>
                            !vehicleSearch.trim() ||
                            v.name.toLowerCase().includes(vehicleSearch.trim().toLowerCase())
                        )
                        .map((v) => (
                          <tr key={v.id}>
                            <td className="bold-cell">
                              {editingVehicleId === v.id ? (
                                <input
                                  type="text"
                                  value={editVehicleName}
                                  onChange={(e) => setEditVehicleName(e.target.value)}
                                  style={{ padding: "5px 8px", borderRadius: "5px", border: "1px solid #94a3b8" }}
                                />
                              ) : (
                                v.name
                              )}
                            </td>
                            <td>
                              {editingVehicleId === v.id ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  value={editVehicleMinKg}
                                  onChange={(e) => setEditVehicleMinKg(e.target.value)}
                                  style={{ width: "90px", padding: "5px 8px", borderRadius: "5px", border: "1px solid #94a3b8" }}
                                />
                              ) : (
                                `${v.min_weight_kg} kg`
                              )}
                            </td>
                            <td className="bold-cell teal-cell">
                              {editingVehicleId === v.id ? (
                                <input
                                  type="number"
                                  step="1"
                                  value={editVehicleMaxKg}
                                  onChange={(e) => setEditVehicleMaxKg(e.target.value)}
                                  style={{ width: "100px", padding: "5px 8px", borderRadius: "5px", border: "1px solid #94a3b8" }}
                                />
                              ) : (
                                `Up to ${v.max_weight_kg} kg`
                              )}
                            </td>
                            <td>
                              <div className="btn-group">
                                {editingVehicleId === v.id ? (
                                  <>
                                    <button onClick={() => handleSaveVehicleEdit(v)} className="btn-tiny approve">
                                      Save
                                    </button>
                                    <button onClick={() => setEditingVehicleId(null)} className="btn-tiny">
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingVehicleId(v.id);
                                        setEditVehicleName(v.name);
                                        setEditVehicleMinKg(String(v.min_weight_kg));
                                        setEditVehicleMaxKg(String(v.max_weight_kg));
                                      }}
                                      className="btn-tiny"
                                    >
                                      Edit
                                    </button>
                                    <button onClick={() => handleDeleteVehicle(v)} className="btn-tiny" style={{ color: "#dc2626" }}>
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB 3: DRIVERS REGISTRY CRUD (AUTO-SYNCS TO SHOPIFY ORDERS DROPDOWN) */}
            {deliverySubTab === "drivers" && (
              <div>
                <div style={{ fontSize: "13px", color: "#0f766e", background: "#f0fdfa", border: "1px solid #99f6e4", padding: "10px 14px", borderRadius: "8px", marginBottom: "14px" }}>
                  ✓ <strong>Auto-Synced with Shopify Orders:</strong> Any driver you add, edit, or delete here automatically updates the <strong>Assigned Driver &amp; Vehicle</strong> dropdown inside your Shopify Orders page!
                </div>

                {/* Search & Vehicle Filter Bar + Register Driver Button */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                    background: "#f8fafc",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", flex: "1 1 320px" }}>
                    <input
                      type="text"
                      placeholder="🔍 Search driver name, phone, or plate..."
                      value={driverSearch}
                      onChange={(e) => setDriverSearch(e.target.value)}
                      style={{ flex: "1 1 220px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    />
                    <select
                      value={driverVehicleFilter}
                      onChange={(e) => setDriverVehicleFilter(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                    >
                      <option value="ALL">All Vehicles</option>
                      {deliveryVehicles.map((v) => (
                        <option key={v.id} value={v.name}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddDriverModal(true)}
                    className="btn-action primary"
                    style={{ height: "36px" }}
                  >
                    + Register Driver
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Driver Name</th>
                        <th>Phone</th>
                        <th>Vehicle</th>
                        <th>Plate / ID</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryDrivers
                        .filter((d) => {
                          const q = driverSearch.trim().toLowerCase();
                          const matchSearch =
                            !q ||
                            d.name.toLowerCase().includes(q) ||
                            d.phone.toLowerCase().includes(q) ||
                            (d.plate_number || "").toLowerCase().includes(q);
                          const matchVehicle =
                            driverVehicleFilter === "ALL" || d.vehicle_type === driverVehicleFilter;
                          return matchSearch && matchVehicle;
                        })
                        .map((d) => (
                          <tr key={d.id}>
                            <td className="bold-cell">
                              {editingDriverId === d.id ? (
                                <input
                                  type="text"
                                  value={editDriverName}
                                  onChange={(e) => setEditDriverName(e.target.value)}
                                  style={{ padding: "5px 8px", borderRadius: "5px", border: "1px solid #94a3b8" }}
                                />
                              ) : (
                                d.name
                              )}
                            </td>
                            <td className="mono-cell">
                              {editingDriverId === d.id ? (
                                <input
                                  type="text"
                                  value={editDriverPhone}
                                  onChange={(e) => setEditDriverPhone(e.target.value)}
                                  style={{ padding: "5px 8px", borderRadius: "5px", border: "1px solid #94a3b8" }}
                                />
                              ) : (
                                d.phone
                              )}
                            </td>
                            <td>
                              {editingDriverId === d.id ? (
                                <input
                                  type="text"
                                  value={editDriverVehicle}
                                  onChange={(e) => setEditDriverVehicle(e.target.value)}
                                  style={{ padding: "5px 8px", borderRadius: "5px", border: "1px solid #94a3b8" }}
                                />
                              ) : (
                                <span style={{ fontSize: "14px", fontWeight: 500, color: "#334155" }}>
                                  {d.vehicle_type}
                                </span>
                              )}
                            </td>
                            <td>
                              {editingDriverId === d.id ? (
                                <input
                                  type="text"
                                  value={editDriverPlate}
                                  onChange={(e) => setEditDriverPlate(e.target.value)}
                                  style={{ width: "90px", padding: "5px 8px", borderRadius: "5px", border: "1px solid #94a3b8" }}
                                />
                              ) : (
                                d.plate_number || "—"
                              )}
                            </td>
                            <td>
                              {editingDriverId === d.id ? (
                                <select
                                  value={editDriverStatus}
                                  onChange={(e) => setEditDriverStatus(e.target.value)}
                                  style={{ padding: "5px 8px", borderRadius: "5px", border: "1px solid #94a3b8" }}
                                >
                                  <option value="Available">Available</option>
                                  <option value="On Delivery">On Delivery</option>
                                  <option value="Off Duty">Off Duty</option>
                                </select>
                              ) : (
                                <span className="status-pill active-pill">{d.status}</span>
                              )}
                            </td>
                            <td>
                              <div className="btn-group">
                                {editingDriverId === d.id ? (
                                  <>
                                    <button onClick={() => handleSaveDriverEdit(d)} className="btn-tiny approve">
                                      Save
                                    </button>
                                    <button onClick={() => setEditingDriverId(null)} className="btn-tiny">
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingDriverId(d.id);
                                        setEditDriverName(d.name);
                                        setEditDriverPhone(d.phone);
                                        setEditDriverVehicle(d.vehicle_type);
                                        setEditDriverPlate(d.plate_number || "");
                                        setEditDriverStatus(d.status || "Available");
                                      }}
                                      className="btn-tiny"
                                    >
                                      Edit
                                    </button>
                                    <button onClick={() => handleDeleteDriver(d)} className="btn-tiny" style={{ color: "#dc2626" }}>
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Modal: Add Delivery Area */}
      {showAddAreaModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Add New Delivery Area</h3>
            <p className="modal-sub">Add a Mogadishu district and set its delivery category &amp; fee.</p>
            <form onSubmit={handleAddArea} className="modal-form">
              <div className="form-group">
                <label>Area / District Name</label>
                <input
                  type="text"
                  placeholder="e.g. KM4 or Darusalaam"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-grid-2">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={newAreaCategory}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setNewAreaCategory(cat);
                      if (cat === "A") setNewAreaFee("1.50");
                      if (cat === "B") setNewAreaFee("2.00");
                      if (cat === "C") setNewAreaFee("3.00");
                      if (cat === "D") setNewAreaFee("3.50");
                    }}
                  >
                    <option value="A">Category A ($1.50)</option>
                    <option value="B">Category B ($2.00)</option>
                    <option value="C">Category C ($3.00)</option>
                    <option value="D">Category D ($3.50)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Delivery Fee ($)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={newAreaFee}
                    onChange={(e) => setNewAreaFee(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddAreaModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ height: "40px", padding: "0 20px" }}>
                  Save Area
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Vehicle */}
      {showAddVehicleModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Add New Delivery Vehicle</h3>
            <p className="modal-sub">Define a vehicle type and its minimum/maximum weight capacity in kg.</p>
            <form onSubmit={handleAddVehicle} className="modal-form">
              <div className="form-group">
                <label>Vehicle Type Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mini Truck or Damas"
                  value={newVehicleName}
                  onChange={(e) => setNewVehicleName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-grid-2">
                <div className="form-group">
                  <label>Min Weight (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newVehicleMinKg}
                    onChange={(e) => setNewVehicleMinKg(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Max Capacity (kg)</label>
                  <input
                    type="number"
                    step="1"
                    value={newVehicleMaxKg}
                    onChange={(e) => setNewVehicleMaxKg(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddVehicleModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ height: "40px", padding: "0 20px" }}>
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register Driver */}
      {showAddDriverModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Register New Driver</h3>
            <p className="modal-sub">Add a delivery driver and automatically sync them to your Shopify Orders dropdown.</p>
            <form onSubmit={handleAddDriver} className="modal-form">
              <div className="modal-grid-2">
                <div className="form-group">
                  <label>Driver Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Yusuf Ali"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +252615009988"
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-grid-2">
                <div className="form-group">
                  <label>Vehicle Type</label>
                  <select
                    value={newDriverVehicle}
                    onChange={(e) => setNewDriverVehicle(e.target.value)}
                  >
                    {deliveryVehicles.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                    {deliveryVehicles.length === 0 && (
                      <>
                        <option value="Fekon (Motorbike)">Fekon (Motorbike)</option>
                        <option value="Bajaj">Bajaj</option>
                        <option value="Fekon Cargo">Fekon Cargo</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label>Plate / Vehicle ID</label>
                  <input
                    type="text"
                    placeholder="e.g. BJJ-05"
                    value={newDriverPlate}
                    onChange={(e) => setNewDriverPlate(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddDriverModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ height: "40px", padding: "0 20px" }}>
                  Save Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
