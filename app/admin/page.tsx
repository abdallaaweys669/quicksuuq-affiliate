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

type OrderWorkflowStage =
  | "UNPAID"
  | "NOT_PREPARED"
  | "IN_PROCESS"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";

interface DispatchOrder {
  gid: string;
  shopify_id: string;
  order_number: string;
  created_at: string;
  financial_status: string;
  fulfillment_status: string;
  subtotal_usd: number;
  shipping_usd: number;
  total_usd: number;
  customer_name: string;
  phone: string;
  delivery_area: string;
  detailed_address: string;
  order_weight: string;
  recommended_vehicle: string;
  assigned_driver: string;
  delivery_status: string;
  referral_code: string;
  workflow_stage: OrderWorkflowStage;
  items: Array<{
    title: string;
    quantity: number;
    unit_price: number;
    image_url: string;
  }>;
}

interface HeroSlideItem {
  id: string;
  enable_slide: boolean;
  show_badge: boolean;
  badge: string;
  badge_bg_color: string;
  badge_text_color: string;
  heading: string;
  description: string;
  show_button: boolean;
  button_text: string;
  button_url: string;
  button_style: string;
  image_desktop: string;
  custom_image_url: string;
  image_preview_url: string;
  image_position: string;
  focal_point: string;
  background_color: string;
  show_green_circle: boolean;
  circle_color: string;
  show_float_card_1: boolean;
  float_card_1_title: string;
  float_card_1_sub: string;
  show_float_pill: boolean;
  float_pill_text: string;
  show_float_card_2: boolean;
  float_card_2_title: string;
  float_card_2_price: string;
  float_card_2_badge: string;
}

interface CategoryCardItem {
  id: string;
  enable_category: boolean;
  title: string;
  collection: string;
  custom_url: string;
  custom_image_url: string;
  image_preview_url: string;
}

interface PromoBannerItem {
  id: string;
  enable_banner: boolean;
  heading: string;
  subheading: string;
  show_button: boolean;
  button_text: string;
  button_url: string;
  bg_color: string;
  custom_image_url: string;
  image_preview_url: string;
}

interface StoreCollectionOption {
  id: number;
  handle: string;
  title: string;
  image_src: string;
}

export default function AdminDashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<
    "orders" | "commissions" | "salespeople" | "payouts" | "delivery" | "storefront"
  >("commissions");
  const [deliverySubTab, setDeliverySubTab] = useState<"areas" | "vehicles" | "drivers">("areas");
  const [storefrontSubTab, setStorefrontSubTab] = useState<
    "hero" | "categories" | "promos" | "products"
  >("hero");

  // Storefront CMS CRUD states
  const [heroSlider, setHeroSlider] = useState<{
    show_section: boolean;
    autoplay: boolean;
    autoplay_interval: number;
    show_arrows: boolean;
    show_dots: boolean;
    slides: HeroSlideItem[];
  }>({
    show_section: true,
    autoplay: true,
    autoplay_interval: 5,
    show_arrows: true,
    show_dots: true,
    slides: [],
  });

  const [featuredCategories, setFeaturedCategories] = useState<{
    show_section: boolean;
    heading: string;
    categories: CategoryCardItem[];
  }>({
    show_section: true,
    heading: "Featured Categories",
    categories: [],
  });

  const [promoBanners, setPromoBanners] = useState<{
    show_section: boolean;
    banners: PromoBannerItem[];
  }>({
    show_section: true,
    banners: [],
  });

  const [popularProducts, setPopularProducts] = useState<{
    show_section: boolean;
    heading: string;
    products_limit: number;
    show_badges: boolean;
  }>({
    show_section: true,
    heading: "Popular Products",
    products_limit: 10,
    show_badges: true,
  });

  const [storeCollections, setStoreCollections] = useState<StoreCollectionOption[]>([]);
  const [savingStorefront, setSavingStorefront] = useState(false);
  const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(null);

  // Orders & Dispatch 5-Tab state
  const [ordersList, setOrdersList] = useState<DispatchOrder[]>([]);
  const [orderStageTab, setOrderStageTab] = useState<"ALL" | OrderWorkflowStage>("ALL");
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
  const [savingOrderDispatch, setSavingOrderDispatch] = useState(false);

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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (
        tabParam === "commissions" ||
        tabParam === "salespeople" ||
        tabParam === "payouts" ||
        tabParam === "delivery" ||
        tabParam === "orders" ||
        tabParam === "storefront"
      ) {
        setActiveTab(tabParam);
      }
      const subParam = params.get("sub");
      if (
        subParam === "hero" ||
        subParam === "categories" ||
        subParam === "promos" ||
        subParam === "products"
      ) {
        setStorefrontSubTab(subParam);
      }

      // If embedded in Shopify with id_token, inject App Bridge v4 so <ui-nav-menu> renders under QuickSuuq Affiliate in Shopify's left sidebar
      const idToken = params.get("id_token");
      if (idToken && !document.querySelector('meta[name="shopify-api-key"]')) {
        try {
          const payload = JSON.parse(atob(idToken.split(".")[1]));
          if (payload?.aud) {
            const meta = document.createElement("meta");
            meta.name = "shopify-api-key";
            meta.content = payload.aud;
            document.head.appendChild(meta);
            const script = document.createElement("script");
            script.src = "https://cdn.shopify.com/shopifycloud/app-bridge.js";
            document.head.appendChild(script);
          }
        } catch {
          // ignore
        }
      }
    }
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
      const [repsRes, commsRes, paysRes, delivRes, ordsRes, sfRes] = await Promise.all([
        adminFetch("/api/admin/salespeople"),
        adminFetch("/api/admin/commissions"),
        adminFetch("/api/admin/payouts"),
        adminFetch("/api/admin/delivery"),
        adminFetch("/api/admin/orders"),
        adminFetch("/api/admin/storefront"),
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
      if (ordsRes.ok) {
        const d = await ordsRes.json();
        setOrdersList(d.orders || []);
      }
      if (sfRes.ok) {
        const d = await sfRes.json();
        if (d.heroSlider) setHeroSlider(d.heroSlider);
        if (d.featuredCategories) setFeaturedCategories(d.featuredCategories);
        if (d.promoBanners) setPromoBanners(d.promoBanners);
        if (d.popularProducts) setPopularProducts(d.popularProducts);
        if (d.collections) setStoreCollections(d.collections);
      }
    } catch (e) {
      console.error("Error loading admin data:", e);
    }
  }

  async function handleSaveStorefront() {
    setSavingStorefront(true);
    try {
      const res = await adminFetch("/api/admin/storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_storefront",
          heroSlider,
          featuredCategories,
          promoBanners,
          popularProducts,
        }),
      });
      if (res.ok) {
        showFeedback("Saved & Published Website Content to Shopify!");
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to publish storefront changes.");
      }
    } catch {
      alert("Network error while saving storefront configuration.");
    } finally {
      setSavingStorefront(false);
    }
  }

  async function handleUploadCmsImage(
    file: File,
    uploadKey: string,
    onUploaded: (cdnUrl: string) => void,
    collectionHandle?: string
  ) {
    setUploadingImageKey(uploadKey);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await adminFetch("/api/admin/storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_image",
          filename: file.name,
          base64,
          collectionHandle,
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        onUploaded(data.url);
        showFeedback("Image uploaded to Shopify CDN! Click 'Save & Publish' to apply.");
      } else {
        alert(data.error || "Failed to upload image");
      }
    } catch {
      alert("Error uploading image file");
    } finally {
      setUploadingImageKey(null);
    }
  }

  async function handleUpdateOrderDispatch(
    order: DispatchOrder,
    updates: { workflow_stage?: OrderWorkflowStage; assigned_driver?: string }
  ) {
    setSavingOrderDispatch(true);
    try {
      const res = await adminFetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gid: order.gid,
          ...updates,
        }),
      });
      if (res.ok) {
        const nextStage = updates.workflow_stage ?? order.workflow_stage;
        const nextDriver = updates.assigned_driver ?? order.assigned_driver;
        const updatedOrder: DispatchOrder = {
          ...order,
          workflow_stage: nextStage,
          assigned_driver: nextDriver,
        };
        setOrdersList((prev) =>
          prev.map((o) => (o.gid === order.gid ? updatedOrder : o))
        );
        setSelectedOrder(updatedOrder);
        showFeedback(`Updated ${order.order_number} & synced with Shopify!`);
      } else {
        alert("Failed to update order status.");
      }
    } finally {
      setSavingOrderDispatch(false);
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

  const activeSlidesCount = heroSlider.slides.filter((s) => s.enable_slide).length;
  const activeCategoriesCount = featuredCategories.categories.filter((c) => c.enable_category).length;
  const activeBannersCount = promoBanners.banners.filter((b) => b.enable_banner).length;
  const isAffiliateSection =
    activeTab === "commissions" || activeTab === "salespeople" || activeTab === "payouts";

  return (
    <div className="polaris-admin-shell">
      {/* Main Polaris Content Area */}
      <main className="polaris-main admin-view">
        {feedbackMsg && <div className="toast-notification">{feedbackMsg}</div>}

        <header className="dashboard-topbar">
          <div className="brand-group">
            <Link href="/" className="brand-logo-wrap" style={{ marginRight: "12px" }}>
              <Image
                src="/logo.png"
                alt="QuickSuuq"
                width={120}
                height={28}
                priority
                className="brand-logo-img"
                style={{ height: "24px" }}
              />
            </Link>
            <div className="rep-header-info">
              <h2 className="rep-name">
                {activeTab === "orders" && "Orders & Dispatch"}
                {isAffiliateSection && "Affiliate & Partner Network"}
                {activeTab === "delivery" && "Delivery & Logistics"}
                {activeTab === "storefront" && "Website Content (CMS)"}
              </h2>
              <div className="rep-meta">
                <span>
                  {activeTab === "orders" && "Track, prepare, and assign Mogadishu deliveries directly to drivers"}
                  {isAffiliateSection && "Sales team commissions, customer tracking, and EVC Plus batch payouts"}
                  {activeTab === "delivery" && "Mogadishu delivery zones, vehicle weight capacities, and driver registry"}
                  {activeTab === "storefront" && "Hero Slider, Featured Categories, Promo Banners, and Popular Products"}
                </span>
              </div>
            </div>
          </div>
          <div className="topbar-actions">
            {activeTab === "storefront" && (
              <button
                type="button"
                onClick={handleSaveStorefront}
                disabled={savingStorefront}
                className="btn-action brand"
              >
                {savingStorefront ? "Publishing..." : "✓ Save & Publish to Store"}
              </button>
            )}
            <a
              href="https://quicksuuq-test.myshopify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-action secondary"
              style={{ textDecoration: "none" }}
            >
              View Store ↗
            </a>
            <span className="rate-badge live">● Live Sync</span>
            <button onClick={handleLogout} className="btn-logout">
              Exit
            </button>
          </div>
        </header>

        {/* Context-Aware Top Summary Cards (Only show Sales Cards on Affiliate Tabs!) */}
        {isAffiliateSection && (
          <section className="metrics-grid admin-metrics">
            <div className="metric-card">
              <span className="metric-label">Total Merchandise</span>
              <div className="metric-value">${totalSalesDriven.toFixed(2)}</div>
              <span className="metric-sub">{totalOrders} affiliate orders</span>
            </div>
            <div className="metric-card highlight-pending">
              <span className="metric-label">Pending Approval</span>
              <div className="metric-value yellow">${pendingAmount.toFixed(2)}</div>
              <span className="metric-sub">
                {commissions.filter((c) => c.status === "PENDING").length} orders pending
              </span>
            </div>
            <div className="metric-card highlight">
              <span className="metric-label">Ready for Payout</span>
              <div className="metric-value teal">${approvedUnpaid.toFixed(2)}</div>
              <span className="metric-sub">Approved commissions</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Total Paid Out</span>
              <div className="metric-value">${totalPaidOut.toFixed(2)}</div>
              <span className="metric-sub">{payouts.length} payout batches</span>
            </div>
          </section>
        )}

        {activeTab === "delivery" && (
          <section className="metrics-grid admin-metrics">
            <div className="metric-card">
              <span className="metric-label">Delivery Zones</span>
              <div className="metric-value">
                {deliveryAreas.filter((a) => a.is_active).length} / {deliveryAreas.length}
              </div>
              <span className="metric-sub">Active Mogadishu districts</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Registered Drivers</span>
              <div className="metric-value teal">{deliveryDrivers.length}</div>
              <span className="metric-sub">Synced with Shopify Orders</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Vehicle Tiers</span>
              <div className="metric-value">{deliveryVehicles.length}</div>
              <span className="metric-sub">Weight-based dispatch</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Heavy Order Surcharge</span>
              <div className="metric-value">+${heavySurchargeUsd}</div>
              <span className="metric-sub">Orders over {heavyWeightKg} kg</span>
            </div>
          </section>
        )}

        {activeTab === "storefront" && (
          <section className="metrics-grid admin-metrics">
            <div
              className="metric-card"
              style={{ cursor: "pointer" }}
              onClick={() => setStorefrontSubTab("hero")}
            >
              <span className="metric-label">Hero Carousel Slider</span>
              <div className="metric-value teal">
                {heroSlider.show_section ? `${activeSlidesCount} Active` : "Hidden"}
              </div>
              <span className="metric-sub">
                {heroSlider.slides.length} total slides configured
              </span>
            </div>
            <div
              className="metric-card"
              style={{ cursor: "pointer" }}
              onClick={() => setStorefrontSubTab("categories")}
            >
              <span className="metric-label">Featured Categories</span>
              <div className="metric-value">
                {featuredCategories.show_section ? `${activeCategoriesCount} Visible` : "Hidden"}
              </div>
              <span className="metric-sub">Main category cover photos</span>
            </div>
            <div
              className="metric-card"
              style={{ cursor: "pointer" }}
              onClick={() => setStorefrontSubTab("promos")}
            >
              <span className="metric-label">Promo Banners</span>
              <div className="metric-value">
                {promoBanners.show_section
                  ? `${activeBannersCount} / ${promoBanners.banners.length} Active`
                  : "Hidden"}
              </div>
              <span className="metric-sub">Fruits &amp; Veg / Baked Buns</span>
            </div>
            <div
              className="metric-card"
              style={{ cursor: "pointer" }}
              onClick={() => setStorefrontSubTab("products")}
            >
              <span className="metric-label">Popular Products</span>
              <div className="metric-value">
                {popularProducts.show_section
                  ? `${popularProducts.products_limit} Items`
                  : "Hidden"}
              </div>
              <span className="metric-sub">Homepage product grid</span>
            </div>
          </section>
        )}

        {/* Top Horizontal Tabs + Context Toolbar */}
        <section className="content-card">
          <div className="admin-toolbar">
            <div className="tabs-header">
              <button
                className={`tab-btn ${activeTab === "orders" ? "active" : ""}`}
                onClick={() => setActiveTab("orders")}
              >
                📦 Orders &amp; Dispatch ({ordersList.length})
              </button>
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
                Payouts &amp; Mobile Money ({payouts.length})
              </button>
              <button
                className={`tab-btn ${activeTab === "delivery" ? "active" : ""}`}
                onClick={() => setActiveTab("delivery")}
              >
                🚚 Delivery &amp; Logistics ({deliveryAreas.length})
              </button>
              <button
                className={`tab-btn ${activeTab === "storefront" ? "active" : ""}`}
                onClick={() => setActiveTab("storefront")}
              >
                🎨 Website Content (CMS)
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
                    <button onClick={handleBatchApprovePending} className="btn-action primary">
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
                  <a
                    href="/api/admin/payouts/export?scope=approved"
                    className="btn-action secondary"
                    download
                  >
                    📥 Export EVC Plus CSV
                  </a>
                  <button onClick={() => setShowPayoutModal(true)} className="btn-action primary">
                    💸 Record Payout Batch
                  </button>
                </div>
              )}

              {activeTab === "storefront" && (
                <div className="action-row">
                  <button
                    type="button"
                    onClick={loadAllData}
                    className="btn-action secondary"
                  >
                    ↻ Reload from Store
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveStorefront}
                    disabled={savingStorefront}
                    className="btn-action brand"
                  >
                    {savingStorefront ? "Publishing..." : "✓ Save & Publish"}
                  </button>
                </div>
              )}
            </div>
          </div>

        {/* Tab 0: Orders & Dispatch (5-Tab Workflow Board) */}
        {activeTab === "orders" && (
          <div style={{ padding: "20px 24px" }}>
            {/* Top 5 Workflow Stage Filter Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
                gap: "10px",
                marginBottom: "18px",
              }}
            >
              {[
                {
                  key: "ALL" as const,
                  label: "All Orders",
                  sub: "Dhammaan Dalabyada",
                  color: "#0f172a",
                  bg: "#f8fafc",
                },
                {
                  key: "UNPAID" as const,
                  label: "1. Unpaid",
                  sub: "Lacag La'aan",
                  color: "#b45309",
                  bg: "#fffbeb",
                },
                {
                  key: "NOT_PREPARED" as const,
                  label: "2. Paid (Not Prepared)",
                  sub: "Aan Weli La Diyaarin",
                  color: "#1d4ed8",
                  bg: "#eff6ff",
                },
                {
                  key: "IN_PROCESS" as const,
                  label: "3. In Process",
                  sub: "Diyaarin / Laguuda Jiraa",
                  color: "#7c3aed",
                  bg: "#f5f3ff",
                },
                {
                  key: "OUT_FOR_DELIVERY" as const,
                  label: "4. Out for Delivery",
                  sub: "Wadada Ku Jira",
                  color: "#0369a1",
                  bg: "#f0f9ff",
                },
                {
                  key: "DELIVERED" as const,
                  label: "5. Delivered",
                  sub: "La Gaarsiiyay",
                  color: "#15803d",
                  bg: "#f0fdf4",
                },
              ].map((st) => {
                const count =
                  st.key === "ALL"
                    ? ordersList.length
                    : ordersList.filter((o) => o.workflow_stage === st.key).length;
                const isSelected = orderStageTab === st.key;
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setOrderStageTab(st.key)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: isSelected ? `2px solid ${st.color}` : "1px solid #e2e8f0",
                      background: isSelected ? st.bg : "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: st.color }}>{st.label}</span>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 800,
                          color: st.color,
                          background: "#fff",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        {count}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{st.sub}</div>
                  </button>
                );
              })}
            </div>

            {/* Search & Refresh Bar */}
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
                placeholder="🔍 Search order (#1048), customer name, phone, or area..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                style={{
                  flex: "1 1 280px",
                  maxWidth: "460px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                }}
              />
              <button
                type="button"
                onClick={loadAllData}
                className="btn-action secondary"
                style={{ height: "36px" }}
              >
                ↻ Refresh Orders
              </button>
            </div>

            {/* Clean Orders Table */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer &amp; Phone</th>
                    <th>Delivery Area</th>
                    <th>Weight &amp; Vehicle</th>
                    <th>Assigned Driver</th>
                    <th>Total</th>
                    <th>Stage</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersList
                    .filter((o) => {
                      const matchTab = orderStageTab === "ALL" || o.workflow_stage === orderStageTab;
                      const q = orderSearch.trim().toLowerCase();
                      const matchSearch =
                        !q ||
                        o.order_number.toLowerCase().includes(q) ||
                        o.customer_name.toLowerCase().includes(q) ||
                        o.phone.toLowerCase().includes(q) ||
                        o.delivery_area.toLowerCase().includes(q);
                      return matchTab && matchSearch;
                    })
                    .map((o) => {
                      const stageBadges: Record<
                        OrderWorkflowStage,
                        { label: string; bg: string; color: string }
                      > = {
                        UNPAID: { label: "1. Unpaid", bg: "#fef3c7", color: "#b45309" },
                        NOT_PREPARED: { label: "2. Not Prepared", bg: "#dbeafe", color: "#1d4ed8" },
                        IN_PROCESS: { label: "3. In Process", bg: "#ede9fe", color: "#6d28d9" },
                        OUT_FOR_DELIVERY: { label: "4. Out for Delivery", bg: "#e0f2fe", color: "#0369a1" },
                        DELIVERED: { label: "5. Delivered", bg: "#dcfce7", color: "#15803d" },
                      };
                      const b = stageBadges[o.workflow_stage];
                      return (
                        <tr key={o.gid}>
                          <td className="bold-cell">{o.order_number}</td>
                          <td>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>{o.customer_name}</div>
                            <div style={{ fontSize: "12px", color: "#64748b" }}>{o.phone}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500, color: "#0f172a" }}>
                              {o.delivery_area.split("—")[0].trim()}
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {o.detailed_address}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: "#0f766e", fontSize: "13px" }}>
                              {o.order_weight.split("(")[0].trim()}
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b" }}>
                              {o.recommended_vehicle.split("(")[0].trim()}
                            </div>
                          </td>
                          <td style={{ fontSize: "13px", color: o.assigned_driver.includes("Unassigned") ? "#94a3b8" : "#0f172a", fontWeight: 500 }}>
                            {o.assigned_driver.includes("Unassigned") ? "Unassigned" : o.assigned_driver}
                          </td>
                          <td className="bold-cell">${o.total_usd.toFixed(2)}</td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 10px",
                                borderRadius: "999px",
                                fontSize: "12px",
                                fontWeight: 700,
                                background: b.bg,
                                color: b.color,
                              }}
                            >
                              {b.label}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(o)}
                              className="btn-tiny approve"
                            >
                              Open / Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

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

        {/* Tab 5: Website Content (CMS) CRUD */}
        {activeTab === "storefront" && (
          <div style={{ padding: "18px 20px" }}>
            {/* Sub-navigation for Hero Slider / Featured Categories / Promo Banners / Popular Products */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                marginBottom: "18px",
                borderBottom: "1px solid #e3e3e3",
                paddingBottom: "12px",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setStorefrontSubTab("hero")}
                  className={`btn-action ${storefrontSubTab === "hero" ? "primary" : "secondary"}`}
                >
                  🖼️ Hero Carousel Slider ({activeSlidesCount}/{heroSlider.slides.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStorefrontSubTab("categories")}
                  className={`btn-action ${storefrontSubTab === "categories" ? "primary" : "secondary"}`}
                >
                  🗂️ Featured Categories ({activeCategoriesCount}/{featuredCategories.categories.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStorefrontSubTab("promos")}
                  className={`btn-action ${storefrontSubTab === "promos" ? "primary" : "secondary"}`}
                >
                  🏷️ Promo Banners ({activeBannersCount}/{promoBanners.banners.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStorefrontSubTab("products")}
                  className={`btn-action ${storefrontSubTab === "products" ? "primary" : "secondary"}`}
                >
                  🛍️ Popular Products
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveStorefront}
                disabled={savingStorefront}
                className="btn-action brand"
              >
                {savingStorefront ? "Publishing to Shopify..." : "✓ Save & Publish Changes"}
              </button>
            </div>

            {/* ==============================================================
                CMS SUB-TAB 1: HERO CAROUSEL SLIDER CRUD
               ============================================================== */}
            {storefrontSubTab === "hero" && (
              <div>
                {/* Global Hero Slider Controls Bar */}
                <div
                  style={{
                    background: "#f7f7f7",
                    border: "1px solid #e3e3e3",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    marginBottom: "18px",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "14px",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "18px" }}>
                    <label className="polaris-switch">
                      <input
                        type="checkbox"
                        checked={heroSlider.show_section}
                        onChange={(e) =>
                          setHeroSlider((prev) => ({ ...prev, show_section: e.target.checked }))
                        }
                      />
                      <span className="polaris-switch-track">
                        <span className="polaris-switch-thumb" />
                      </span>
                      <span>
                        <strong>Show Hero Slider Section</strong>{" "}
                        <span style={{ color: "#616161", fontWeight: 400 }}>
                          ({heroSlider.show_section ? "Visible on Homepage" : "Hidden"})
                        </span>
                      </span>
                    </label>

                    <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px" }}>
                      <input
                        type="checkbox"
                        checked={heroSlider.autoplay}
                        onChange={(e) =>
                          setHeroSlider((prev) => ({ ...prev, autoplay: e.target.checked }))
                        }
                      />
                      <span>Autoplay Slides</span>
                    </label>

                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px" }}>
                      <span>Interval (sec):</span>
                      <input
                        type="number"
                        min={3}
                        max={12}
                        value={heroSlider.autoplay_interval}
                        onChange={(e) =>
                          setHeroSlider((prev) => ({
                            ...prev,
                            autoplay_interval: Number(e.target.value) || 5,
                          }))
                        }
                        style={{
                          width: "58px",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: "1px solid #cccccc",
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-action primary"
                    onClick={() => {
                      const nextIdx = heroSlider.slides.length + 1;
                      const newSlide: HeroSlideItem = {
                        id: `slide_${Date.now()}`,
                        enable_slide: true,
                        show_badge: true,
                        badge: "Fresh Groceries • Fast Delivery",
                        badge_bg_color: "#FFC107",
                        badge_text_color: "#001E2B",
                        heading: `New Hero Slide ${nextIdx}`,
                        description:
                          "Shop fresh fruits, vegetables, grains, dairy and home essentials at great prices on QuickSuuq.",
                        show_button: true,
                        button_text: "Shop Now",
                        button_url: "/collections/all",
                        button_style: "navy",
                        image_desktop: "",
                        custom_image_url: "",
                        image_preview_url:
                          "https://cdn.shopify.com/s/files/1/1033/7402/9166/t/3/assets/quicksuuq-hero-slide-1-v2.png",
                        image_position: "right",
                        focal_point: "center center",
                        background_color: "#CFE9DF",
                        show_green_circle: true,
                        circle_color: "#167A62",
                        show_float_card_1: true,
                        float_card_1_title: "Bananas - 1kg",
                        float_card_1_sub: "Fresh Daily",
                        show_float_pill: true,
                        float_pill_text: "Delivery Done!",
                        show_float_card_2: false,
                        float_card_2_title: "Avocado",
                        float_card_2_price: "$1.80",
                        float_card_2_badge: "-15%",
                      };
                      setHeroSlider((prev) => ({
                        ...prev,
                        slides: [...prev.slides, newSlide],
                      }));
                    }}
                  >
                    + Add New Slide
                  </button>
                </div>

                {/* Individual Slide CRUD Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {heroSlider.slides.map((slide, idx) => {
                    const updateSlide = (patch: Partial<HeroSlideItem>) => {
                      setHeroSlider((prev) => ({
                        ...prev,
                        slides: prev.slides.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
                      }));
                    };

                    return (
                      <div
                        key={slide.id}
                        style={{
                          background: "#ffffff",
                          border: slide.enable_slide ? "1px solid #cccccc" : "1px dashed #cccccc",
                          borderRadius: "12px",
                          overflow: "hidden",
                          opacity: slide.enable_slide ? 1 : 0.72,
                        }}
                      >
                        {/* Slide Card Header */}
                        <div
                          style={{
                            background: "#f7f7f7",
                            padding: "10px 16px",
                            borderBottom: "1px solid #e3e3e3",
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span
                              style={{
                                fontWeight: 650,
                                fontSize: "13.5px",
                                color: "#1a1a1a",
                              }}
                            >
                              Slide {idx + 1}: {slide.heading || "Untitled Slide"}
                            </span>
                            <span
                              className={`status-pill ${
                                slide.enable_slide ? "active-pill" : "voided"
                              }`}
                            >
                              {slide.enable_slide ? "Visible" : "Hidden"}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <label className="polaris-switch">
                              <input
                                type="checkbox"
                                checked={slide.enable_slide}
                                onChange={(e) => updateSlide({ enable_slide: e.target.checked })}
                              />
                              <span className="polaris-switch-track">
                                <span className="polaris-switch-thumb" />
                              </span>
                              <span>{slide.enable_slide ? "Show Slide" : "Hidden"}</span>
                            </label>

                            {idx > 0 && (
                              <button
                                type="button"
                                className="btn-tiny"
                                title="Move Slide Up"
                                onClick={() => {
                                  setHeroSlider((prev) => {
                                    const arr = [...prev.slides];
                                    const temp = arr[idx - 1];
                                    arr[idx - 1] = arr[idx];
                                    arr[idx] = temp;
                                    return { ...prev, slides: arr };
                                  });
                                }}
                              >
                                ↑
                              </button>
                            )}
                            {idx < heroSlider.slides.length - 1 && (
                              <button
                                type="button"
                                className="btn-tiny"
                                title="Move Slide Down"
                                onClick={() => {
                                  setHeroSlider((prev) => {
                                    const arr = [...prev.slides];
                                    const temp = arr[idx + 1];
                                    arr[idx + 1] = arr[idx];
                                    arr[idx] = temp;
                                    return { ...prev, slides: arr };
                                  });
                                }}
                              >
                                ↓
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-tiny"
                              style={{ color: "#8e1f0b" }}
                              onClick={() => {
                                if (!confirm(`Delete Slide ${idx + 1}?`)) return;
                                setHeroSlider((prev) => ({
                                  ...prev,
                                  slides: prev.slides.filter((_, i) => i !== idx),
                                }));
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Slide Card Body (2 Columns: Visual Image + Text/Buttons) */}
                        <div
                          style={{
                            padding: "16px",
                            display: "grid",
                            gridTemplateColumns: "minmax(250px, 310px) 1fr",
                            gap: "20px",
                          }}
                        >
                          {/* Column 1: Image Preview & Upload */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div
                              style={{
                                background: slide.background_color || "#CFE9DF",
                                borderRadius: "10px",
                                border: "1px solid #e3e3e3",
                                height: "190px",
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                              }}
                            >
                              {slide.show_green_circle && (
                                <div
                                  style={{
                                    width: "130px",
                                    height: "130px",
                                    borderRadius: "50%",
                                    background: slide.circle_color || "#167A62",
                                    position: "absolute",
                                  }}
                                />
                              )}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={slide.custom_image_url || slide.image_preview_url}
                                alt={slide.heading}
                                style={{
                                  position: "relative",
                                  zIndex: 2,
                                  maxHeight: "175px",
                                  maxWidth: "90%",
                                  objectFit: "contain",
                                }}
                              />
                            </div>

                            <label
                              className="btn-action secondary"
                              style={{
                                justifyContent: "center",
                                cursor: "pointer",
                                width: "100%",
                              }}
                            >
                              {uploadingImageKey === slide.id
                                ? "Uploading to Shopify..."
                                : "📷 Upload New Slide Image"}
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                disabled={uploadingImageKey === slide.id}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    handleUploadCmsImage(f, slide.id, (cdnUrl) => {
                                      updateSlide({
                                        custom_image_url: cdnUrl,
                                        image_preview_url: cdnUrl,
                                      });
                                    });
                                  }
                                }}
                              />
                            </label>

                            <div className="modal-grid-2">
                              <div className="form-group">
                                <label>Image Side</label>
                                <select
                                  value={slide.image_position}
                                  onChange={(e) => updateSlide({ image_position: e.target.value })}
                                >
                                  <option value="right">Image on Right</option>
                                  <option value="left">Image on Left</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label>Slide Background</label>
                                <input
                                  type="color"
                                  value={slide.background_color || "#CFE9DF"}
                                  onChange={(e) => updateSlide({ background_color: e.target.value })}
                                  style={{ width: "100%", height: "36px", padding: "2px 4px" }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Column 2: Text, Badge, Button & Floating Callouts */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div className="modal-grid-2">
                              <div className="form-group">
                                <label>Heading</label>
                                <input
                                  type="text"
                                  value={slide.heading}
                                  onChange={(e) => updateSlide({ heading: e.target.value })}
                                  placeholder="Your Daily Groceries Delivered..."
                                />
                              </div>
                              <div className="form-group">
                                <div className="form-label-row">
                                  <label>Promotional Badge</label>
                                  <label style={{ fontSize: "11.5px", fontWeight: 500 }}>
                                    <input
                                      type="checkbox"
                                      checked={slide.show_badge}
                                      onChange={(e) => updateSlide({ show_badge: e.target.checked })}
                                    />{" "}
                                    Show
                                  </label>
                                </div>
                                <input
                                  type="text"
                                  value={slide.badge}
                                  onChange={(e) => updateSlide({ badge: e.target.value })}
                                  placeholder="Fresh Groceries • Fast Delivery"
                                />
                              </div>
                            </div>

                            <div className="form-group">
                              <label>Description</label>
                              <textarea
                                rows={2}
                                value={slide.description}
                                onChange={(e) => updateSlide({ description: e.target.value })}
                                placeholder="Shop fresh fruits, vegetables, grains, dairy..."
                              />
                            </div>

                            <div className="modal-grid-2">
                              <div className="form-group">
                                <div className="form-label-row">
                                  <label>Button Text</label>
                                  <label style={{ fontSize: "11.5px", fontWeight: 500 }}>
                                    <input
                                      type="checkbox"
                                      checked={slide.show_button}
                                      onChange={(e) =>
                                        updateSlide({ show_button: e.target.checked })
                                      }
                                    />{" "}
                                    Show Button
                                  </label>
                                </div>
                                <input
                                  type="text"
                                  value={slide.button_text}
                                  onChange={(e) => updateSlide({ button_text: e.target.value })}
                                />
                              </div>
                              <div className="form-group">
                                <label>Button Link URL</label>
                                <input
                                  type="text"
                                  value={slide.button_url}
                                  onChange={(e) => updateSlide({ button_url: e.target.value })}
                                  placeholder="/collections/all"
                                />
                              </div>
                            </div>

                            {/* Floating Callouts Controls */}
                            <div
                              style={{
                                background: "#f7f7f7",
                                border: "1px solid #e3e3e3",
                                borderRadius: "8px",
                                padding: "10px 12px",
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                gap: "10px",
                              }}
                            >
                              <div>
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    marginBottom: "4px",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={slide.show_float_card_1}
                                    onChange={(e) =>
                                      updateSlide({ show_float_card_1: e.target.checked })
                                    }
                                  />
                                  Floating Card 1
                                </label>
                                <input
                                  type="text"
                                  value={slide.float_card_1_title}
                                  onChange={(e) =>
                                    updateSlide({ float_card_1_title: e.target.value })
                                  }
                                  placeholder="Bananas - 1kg"
                                  style={{
                                    width: "100%",
                                    padding: "5px 8px",
                                    fontSize: "12px",
                                    borderRadius: "6px",
                                    border: "1px solid #cccccc",
                                  }}
                                />
                              </div>

                              <div>
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    marginBottom: "4px",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={slide.show_float_pill}
                                    onChange={(e) =>
                                      updateSlide({ show_float_pill: e.target.checked })
                                    }
                                  />
                                  Bottom Delivery Pill
                                </label>
                                <input
                                  type="text"
                                  value={slide.float_pill_text}
                                  onChange={(e) => updateSlide({ float_pill_text: e.target.value })}
                                  placeholder="Delivery Done!"
                                  style={{
                                    width: "100%",
                                    padding: "5px 8px",
                                    fontSize: "12px",
                                    borderRadius: "6px",
                                    border: "1px solid #cccccc",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==============================================================
                CMS SUB-TAB 2: FEATURED CATEGORIES CRUD
               ============================================================== */}
            {storefrontSubTab === "categories" && (
              <div>
                <div
                  style={{
                    background: "#f7f7f7",
                    border: "1px solid #e3e3e3",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    marginBottom: "18px",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "14px",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "18px" }}>
                    <label className="polaris-switch">
                      <input
                        type="checkbox"
                        checked={featuredCategories.show_section}
                        onChange={(e) =>
                          setFeaturedCategories((prev) => ({
                            ...prev,
                            show_section: e.target.checked,
                          }))
                        }
                      />
                      <span className="polaris-switch-track">
                        <span className="polaris-switch-thumb" />
                      </span>
                      <span>
                        <strong>Show Featured Categories Section</strong>
                      </span>
                    </label>

                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 600 }}>Section Heading:</span>
                      <input
                        type="text"
                        value={featuredCategories.heading}
                        onChange={(e) =>
                          setFeaturedCategories((prev) => ({ ...prev, heading: e.target.value }))
                        }
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          border: "1px solid #cccccc",
                          fontSize: "13px",
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-action primary"
                    onClick={() => {
                      const firstCol = storeCollections[0];
                      const newCat: CategoryCardItem = {
                        id: `cat_${Date.now()}`,
                        enable_category: true,
                        title: firstCol?.title || "New Category",
                        collection: firstCol?.handle || "all",
                        custom_url: "",
                        custom_image_url: "",
                        image_preview_url:
                          firstCol?.image_src ||
                          "https://freshcart.codescandy.com/assets/images/category/category-fruits-vegetables.jpg",
                      };
                      setFeaturedCategories((prev) => ({
                        ...prev,
                        categories: [...prev.categories, newCat],
                      }));
                    }}
                  >
                    + Add Category Card
                  </button>
                </div>

                {/* Grid of Category CRUD Cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {featuredCategories.categories.map((cat, idx) => {
                    const updateCat = (patch: Partial<CategoryCardItem>) => {
                      setFeaturedCategories((prev) => ({
                        ...prev,
                        categories: prev.categories.map((c, i) =>
                          i === idx ? { ...c, ...patch } : c
                        ),
                      }));
                    };

                    return (
                      <div
                        key={cat.id}
                        style={{
                          background: "#ffffff",
                          border: cat.enable_category
                            ? "1px solid #cccccc"
                            : "1px dashed #cccccc",
                          borderRadius: "10px",
                          padding: "14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          opacity: cat.enable_category ? 1 : 0.65,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <label className="polaris-switch">
                            <input
                              type="checkbox"
                              checked={cat.enable_category}
                              onChange={(e) =>
                                updateCat({ enable_category: e.target.checked })
                              }
                            />
                            <span className="polaris-switch-track">
                              <span className="polaris-switch-thumb" />
                            </span>
                            <span style={{ fontSize: "12px" }}>
                              {cat.enable_category ? "Visible" : "Hidden"}
                            </span>
                          </label>

                          <button
                            type="button"
                            className="btn-tiny"
                            style={{ color: "#8e1f0b", padding: "2px 7px" }}
                            onClick={() => {
                              if (!confirm(`Remove category "${cat.title}"?`)) return;
                              setFeaturedCategories((prev) => ({
                                ...prev,
                                categories: prev.categories.filter((_, i) => i !== idx),
                              }));
                            }}
                          >
                            ✕
                          </button>
                        </div>

                        {/* Category Main Cover Image Preview */}
                        <div
                          style={{
                            height: "110px",
                            background: "#f7f7f7",
                            borderRadius: "8px",
                            border: "1px solid #ebebeb",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "8px",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cat.custom_image_url || cat.image_preview_url}
                            alt={cat.title}
                            style={{
                              maxHeight: "94px",
                              maxWidth: "100%",
                              objectFit: "contain",
                            }}
                          />
                        </div>

                        <label
                          className="btn-action secondary"
                          style={{
                            justifyContent: "center",
                            cursor: "pointer",
                            width: "100%",
                            fontSize: "12px",
                          }}
                        >
                          {uploadingImageKey === cat.id
                            ? "Uploading..."
                            : "📷 Change Main Image"}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            disabled={uploadingImageKey === cat.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                handleUploadCmsImage(
                                  f,
                                  cat.id,
                                  (cdnUrl) => {
                                    updateCat({
                                      custom_image_url: cdnUrl,
                                      image_preview_url: cdnUrl,
                                    });
                                  },
                                  cat.collection
                                );
                              }
                            }}
                          />
                        </label>

                        <div className="form-group">
                          <label>Category Title</label>
                          <input
                            type="text"
                            value={cat.title}
                            onChange={(e) => updateCat({ title: e.target.value })}
                          />
                        </div>

                        <div className="form-group">
                          <label>Linked Collection</label>
                          <select
                            value={cat.collection}
                            onChange={(e) => {
                              const nextHandle = e.target.value;
                              const found = storeCollections.find(
                                (sc) => sc.handle === nextHandle
                              );
                              updateCat({
                                collection: nextHandle,
                                title: found ? found.title : cat.title,
                                image_preview_url:
                                  found?.image_src || cat.image_preview_url,
                              });
                            }}
                          >
                            <option value="">-- Select Collection --</option>
                            {storeCollections.map((sc) => (
                              <option key={sc.handle} value={sc.handle}>
                                {sc.title} ({sc.handle})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==============================================================
                CMS SUB-TAB 3: PROMO BANNERS CRUD ("Fruits & Veg" / "Baked Buns")
               ============================================================== */}
            {storefrontSubTab === "promos" && (
              <div>
                <div
                  style={{
                    background: "#f7f7f7",
                    border: "1px solid #e3e3e3",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    marginBottom: "18px",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "14px",
                  }}
                >
                  <label className="polaris-switch">
                    <input
                      type="checkbox"
                      checked={promoBanners.show_section}
                      onChange={(e) =>
                        setPromoBanners((prev) => ({
                          ...prev,
                          show_section: e.target.checked,
                        }))
                      }
                    />
                    <span className="polaris-switch-track">
                      <span className="polaris-switch-thumb" />
                    </span>
                    <span>
                      <strong>Show Promo Banners Section</strong>{" "}
                      <span style={{ color: "#616161", fontWeight: 400 }}>
                        (Toggle individual cards below to show 1, show 2, or hide all)
                      </span>
                    </span>
                  </label>

                  <button
                    type="button"
                    className="btn-action primary"
                    onClick={() => {
                      const newBanner: PromoBannerItem = {
                        id: `banner_${Date.now()}`,
                        enable_banner: true,
                        heading: "Special Grocery Offer",
                        subheading: "Get Upto 20% Off",
                        show_button: true,
                        button_text: "Shop Now",
                        button_url: "/collections/all",
                        bg_color: "#F0F3F2",
                        custom_image_url: "",
                        image_preview_url:
                          "https://freshcart.codescandy.com/assets/images/banner/grocery-banner.png",
                      };
                      setPromoBanners((prev) => ({
                        ...prev,
                        banners: [...prev.banners, newBanner],
                      }));
                    }}
                  >
                    + Add Promo Banner
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {promoBanners.banners.map((banner, idx) => {
                    const updateBanner = (patch: Partial<PromoBannerItem>) => {
                      setPromoBanners((prev) => ({
                        ...prev,
                        banners: prev.banners.map((b, i) =>
                          i === idx ? { ...b, ...patch } : b
                        ),
                      }));
                    };

                    return (
                      <div
                        key={banner.id}
                        style={{
                          background: "#ffffff",
                          border: banner.enable_banner
                            ? "1px solid #cccccc"
                            : "1px dashed #cccccc",
                          borderRadius: "12px",
                          padding: "16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          opacity: banner.enable_banner ? 1 : 0.65,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom: "1px solid #ebebeb",
                            paddingBottom: "10px",
                          }}
                        >
                          <label className="polaris-switch">
                            <input
                              type="checkbox"
                              checked={banner.enable_banner}
                              onChange={(e) =>
                                updateBanner({ enable_banner: e.target.checked })
                              }
                            />
                            <span className="polaris-switch-track">
                              <span className="polaris-switch-thumb" />
                            </span>
                            <span>
                              <strong>Banner {idx + 1}:</strong>{" "}
                              {banner.enable_banner ? "Visible" : "Hidden"}
                            </span>
                          </label>

                          <button
                            type="button"
                            className="btn-tiny"
                            style={{ color: "#8e1f0b" }}
                            onClick={() => {
                              if (!confirm(`Delete Promo Banner "${banner.heading}"?`)) return;
                              setPromoBanners((prev) => ({
                                ...prev,
                                banners: prev.banners.filter((_, i) => i !== idx),
                              }));
                            }}
                          >
                            Delete
                          </button>
                        </div>

                        {/* Live Promo Banner Preview */}
                        <div
                          style={{
                            height: "145px",
                            borderRadius: "8px",
                            border: "1px solid #e3e3e3",
                            backgroundColor: banner.bg_color || "#F0F3F2",
                            backgroundImage: `url('${
                              banner.custom_image_url || banner.image_preview_url
                            }')`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            padding: "20px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "16px",
                              color: "#001e2b",
                              marginBottom: "4px",
                            }}
                          >
                            {banner.heading}
                          </div>
                          <div
                            style={{
                              fontSize: "12.5px",
                              color: "#5c6c75",
                              marginBottom: "10px",
                            }}
                          >
                            {banner.subheading}
                          </div>
                          {banner.show_button && (
                            <span
                              style={{
                                alignSelf: "flex-start",
                                background: "#001e2b",
                                color: "#ffffff",
                                fontSize: "11.5px",
                                fontWeight: 600,
                                padding: "5px 12px",
                                borderRadius: "6px",
                              }}
                            >
                              {banner.button_text}
                            </span>
                          )}
                        </div>

                        <label
                          className="btn-action secondary"
                          style={{
                            justifyContent: "center",
                            cursor: "pointer",
                            width: "100%",
                          }}
                        >
                          {uploadingImageKey === banner.id
                            ? "Uploading Banner Image..."
                            : "📷 Upload / Change Banner Image"}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            disabled={uploadingImageKey === banner.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                handleUploadCmsImage(f, banner.id, (cdnUrl) => {
                                  updateBanner({
                                    custom_image_url: cdnUrl,
                                    image_preview_url: cdnUrl,
                                  });
                                });
                              }
                            }}
                          />
                        </label>

                        <div className="modal-grid-2">
                          <div className="form-group">
                            <label>Banner Heading</label>
                            <input
                              type="text"
                              value={banner.heading}
                              onChange={(e) => updateBanner({ heading: e.target.value })}
                            />
                          </div>
                          <div className="form-group">
                            <label>Offer / Discount Text</label>
                            <input
                              type="text"
                              value={banner.subheading}
                              onChange={(e) => updateBanner({ subheading: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="modal-grid-2">
                          <div className="form-group">
                            <div className="form-label-row">
                              <label>Button Text</label>
                              <label style={{ fontSize: "11.5px", fontWeight: 500 }}>
                                <input
                                  type="checkbox"
                                  checked={banner.show_button}
                                  onChange={(e) =>
                                    updateBanner({ show_button: e.target.checked })
                                  }
                                />{" "}
                                Show
                              </label>
                            </div>
                            <input
                              type="text"
                              value={banner.button_text}
                              onChange={(e) => updateBanner({ button_text: e.target.value })}
                            />
                          </div>
                          <div className="form-group">
                            <label>Button Link URL</label>
                            <input
                              type="text"
                              value={banner.button_url}
                              onChange={(e) => updateBanner({ button_url: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==============================================================
                CMS SUB-TAB 4: POPULAR PRODUCTS SETTINGS
               ============================================================== */}
            {storefrontSubTab === "products" && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #cccccc",
                  borderRadius: "12px",
                  padding: "20px",
                  maxWidth: "560px",
                }}
              >
                <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 650 }}>
                  Homepage Popular Products Section
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <label className="polaris-switch">
                    <input
                      type="checkbox"
                      checked={popularProducts.show_section}
                      onChange={(e) =>
                        setPopularProducts((prev) => ({
                          ...prev,
                          show_section: e.target.checked,
                        }))
                      }
                    />
                    <span className="polaris-switch-track">
                      <span className="polaris-switch-thumb" />
                    </span>
                    <span>Show Popular Products Section on Homepage</span>
                  </label>

                  <div className="form-group">
                    <label>Section Heading</label>
                    <input
                      type="text"
                      value={popularProducts.heading}
                      onChange={(e) =>
                        setPopularProducts((prev) => ({ ...prev, heading: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Number of Products to Display (4 – 20)</label>
                    <input
                      type="number"
                      min={4}
                      max={20}
                      value={popularProducts.products_limit}
                      onChange={(e) =>
                        setPopularProducts((prev) => ({
                          ...prev,
                          products_limit: Number(e.target.value) || 10,
                        }))
                      }
                    />
                  </div>

                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      checked={popularProducts.show_badges}
                      onChange={(e) =>
                        setPopularProducts((prev) => ({
                          ...prev,
                          show_badges: e.target.checked,
                        }))
                      }
                    />
                    <span>Show &quot;Sale&quot; badges on discounted items</span>
                  </label>
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

      {/* Modal: Clean 1-Screen Order Details & Dispatch Manager */}
      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "740px", width: "96%", maxHeight: "90vh", overflowY: "auto", padding: "22px" }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>
                  Order {selectedOrder.order_number}
                </h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {new Date(selectedOrder.created_at).toLocaleString()} · Total: <strong>${selectedOrder.total_usd.toFixed(2)}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="btn-secondary"
                style={{ padding: "6px 14px", fontSize: "13px" }}
              >
                ✕ Close
              </button>
            </div>

            {/* 5-Stage Progress Switcher (1-Click) */}
            <div style={{ marginBottom: "18px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "8px", textTransform: "uppercase" }}>
                1-Click Order Status (Marxaladda Dalabka)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))", gap: "8px" }}>
                {(
                  [
                    { key: "UNPAID", label: "1. Unpaid", sub: "Lacag La'aan" },
                    { key: "NOT_PREPARED", label: "2. Not Prepared", sub: "Aan La Diyaarin" },
                    { key: "IN_PROCESS", label: "3. In Process", sub: "Diyaarin" },
                    { key: "OUT_FOR_DELIVERY", label: "4. Out for Delivery", sub: "Wadada" },
                    { key: "DELIVERED", label: "5. Delivered", sub: "La Gaarsiiyay" },
                  ] as Array<{ key: OrderWorkflowStage; label: string; sub: string }>
                ).map((st) => {
                  const active = selectedOrder.workflow_stage === st.key;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      disabled={savingOrderDispatch}
                      onClick={() => handleUpdateOrderDispatch(selectedOrder, { workflow_stage: st.key })}
                      style={{
                        padding: "9px 10px",
                        borderRadius: "8px",
                        border: active ? "2px solid #0d9488" : "1px solid #cbd5e1",
                        background: active ? "#f0fdfa" : "#fff",
                        color: active ? "#0f766e" : "#334155",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: 700 }}>{st.label}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{st.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2 Clean Side-by-Side Cards: Customer/Address + Logistics/Driver */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", marginBottom: "18px" }}>
              {/* Card 1: Customer & Address */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f766e", textTransform: "uppercase", marginBottom: "10px" }}>
                  👤 Customer &amp; Delivery Address
                </div>
                <div style={{ fontSize: "14px", marginBottom: "6px" }}>
                  <strong>Name:</strong> {selectedOrder.customer_name}
                </div>
                <div style={{ fontSize: "14px", marginBottom: "6px" }}>
                  <strong>Phone:</strong> {selectedOrder.phone}
                </div>
                <div style={{ fontSize: "14px", marginBottom: "6px" }}>
                  <strong>Area &amp; Fee:</strong> {selectedOrder.delivery_area}
                </div>
                <div style={{ fontSize: "14px" }}>
                  <strong>Detailed Address:</strong> {selectedOrder.detailed_address}
                </div>
              </div>

              {/* Card 2: Weight, Vehicle & Driver Assignment */}
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#15803d", textTransform: "uppercase", marginBottom: "10px" }}>
                  🚚 Logistics &amp; Driver Assignment
                </div>
                <div style={{ fontSize: "14px", marginBottom: "6px" }}>
                  <strong>Total Weight:</strong> {selectedOrder.order_weight}
                </div>
                <div style={{ fontSize: "14px", marginBottom: "10px" }}>
                  <strong>Recommended Vehicle:</strong> {selectedOrder.recommended_vehicle}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>
                    Assigned Driver &amp; Vehicle:
                  </label>
                  <select
                    value={selectedOrder.assigned_driver}
                    disabled={savingOrderDispatch}
                    onChange={(e) => {
                      const nextDriver = e.target.value;
                      const nextStage =
                        !nextDriver.includes("Unassigned") && selectedOrder.workflow_stage === "NOT_PREPARED"
                          ? "IN_PROCESS"
                          : selectedOrder.workflow_stage;
                      handleUpdateOrderDispatch(selectedOrder, {
                        assigned_driver: nextDriver,
                        workflow_stage: nextStage,
                      });
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #86efac",
                      background: "#fff",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    <option value="Unassigned (Pending Dispatch)">Unassigned (Pending Dispatch)</option>
                    {deliveryDrivers.map((d) => {
                      const platePart = d.plate_number ? ` [${d.plate_number}]` : "";
                      const label = `${d.vehicle_type}${platePart} — ${d.name} (${d.phone})`;
                      return (
                        <option key={d.id} value={label}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Clean Ordered Items Table */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
              <div style={{ background: "#f8fafc", padding: "10px 14px", fontSize: "12px", fontWeight: 700, color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                🛒 Ordered Items ({selectedOrder.items.reduce((s, i) => s + i.quantity, 0)} items)
              </div>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="bold-cell">{it.title}</td>
                      <td>× {it.quantity}</td>
                      <td>${it.unit_price.toFixed(2)}</td>
                      <td className="bold-cell">${(it.unit_price * it.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ background: "#f8fafc", padding: "12px 16px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
                <span>
                  Subtotal: <strong>${selectedOrder.subtotal_usd.toFixed(2)}</strong> · Delivery: <strong>${selectedOrder.shipping_usd.toFixed(2)}</strong>
                </span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                  Total: ${selectedOrder.total_usd.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
