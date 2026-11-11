import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

export const runtime = "nodejs";

const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "quicksuuq-test.myshopify.com";
const ACCESS_TOKEN =
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "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";
const DEFAULT_THEME_ID = 196285956462;

const DEFAULT_SLIDE_IMAGES: Record<number, string> = {
  0: "https://cdn.shopify.com/s/files/1/1033/7402/9166/t/3/assets/quicksuuq-hero-slide-1-v2.png",
  1: "https://cdn.shopify.com/s/files/1/1033/7402/9166/t/3/assets/quicksuuq-hero-slide-2.png",
  2: "https://cdn.shopify.com/s/files/1/1033/7402/9166/t/3/assets/quicksuuq-hero-slide-3.png",
};

const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  "midho-miro-cusub":
    "https://freshcart.codescandy.com/assets/images/category/category-fruits-vegetables.jpg",
  vegetables:
    "https://cdn.shopify.com/s/files/1/1033/7402/9166/files/barbarooni_2_ae19ed78-7946-4aa6-9b06-4f6383453649.jpg?v=1794312657&width=220&format=webp",
  cerealsbadar:
    "https://cdn.shopify.com/s/files/1/1033/7402/9166/files/AlFanarSellaRice_1_b3f41b50-8b1f-43ab-b8f7-cab8da0049c9.webp?v=1794312638&width=220&format=webp",
  dairy:
    "https://cdn.shopify.com/s/files/1/1033/7402/9166/files/AlmaraiFullFatMilkSplashBottle_b374f1bf-d24b-41ff-9f15-e4f5df6ff155.png?v=1794311599&width=220&format=webp",
  spices:
    "https://cdn.shopify.com/s/files/1/1033/7402/9166/files/BayaraGaramMasalaSpiceTrio_a4a81a3e-35c7-42c3-a5fb-3bbb5e819d41.png?v=1794311536&width=220&format=webp",
  "saliida-cuntada":
    "https://cdn.shopify.com/s/files/1/1033/7402/9166/files/3ltr-sunflower-oil_1.webp?v=1794312650&width=220&format=webp",
  cabitan:
    "https://cdn.shopify.com/s/files/1/1033/7402/9166/files/baraka-chai-57.png?v=1794311184&width=220&format=webp",
  "spreads-breakfast":
    "https://cdn.shopify.com/s/files/1/1033/7402/9166/files/american-nutberry-17.png?v=1794311289&width=220&format=webp",
  "baby-care":
    "https://freshcart.codescandy.com/assets/images/category/category-baby-care.jpg",
  clearning:
    "https://freshcart.codescandy.com/assets/images/category/category-cleaning-essentials.jpg",
  protein:
    "https://cdn.shopify.com/s/files/1/1033/7402/9166/files/ChatGPTImageNov1_2026_01_26_31PM.png?v=1794311421&width=220&format=webp",
};

const DEFAULT_PROMO_IMAGES: Record<number, string> = {
  0: "https://freshcart.codescandy.com/assets/images/banner/grocery-banner.png",
  1: "https://freshcart.codescandy.com/assets/images/banner/grocery-banner-2.jpg",
};

async function shopifyFetch(path: string, init?: RequestInit) {
  const url = `https://${SHOP_DOMAIN}/admin/api/2024-10${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": ACCESS_TOKEN,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [indexRes, customColsRes, smartColsRes] = await Promise.all([
      shopifyFetch(
        `/themes/${DEFAULT_THEME_ID}/assets.json?asset[key]=${encodeURIComponent(
          "templates/index.json"
        )}`
      ),
      shopifyFetch("/custom_collections.json?limit=250"),
      shopifyFetch("/smart_collections.json?limit=250"),
    ]);

    const indexData = indexRes.ok ? await indexRes.json() : null;
    const rawJson = indexData?.asset?.value;
    const indexObj = rawJson ? JSON.parse(rawJson) : { sections: {}, order: [] };

    const customColsData = customColsRes.ok ? await customColsRes.json() : { custom_collections: [] };
    const smartColsData = smartColsRes.ok ? await smartColsRes.json() : { smart_collections: [] };

    const allCollections = [
      ...(customColsData.custom_collections || []).map((c: any) => ({
        id: c.id,
        handle: c.handle,
        title: c.title,
        image_src: c.image?.src || DEFAULT_CATEGORY_IMAGES[c.handle] || "",
        is_custom: true,
      })),
      ...(smartColsData.smart_collections || []).map((c: any) => ({
        id: c.id,
        handle: c.handle,
        title: c.title,
        image_src: c.image?.src || DEFAULT_CATEGORY_IMAGES[c.handle] || "",
        is_custom: false,
      })),
    ];

    const colMap = new Map<string, { id: number; title: string; image_src: string }>();
    for (const c of allCollections) {
      colMap.set(c.handle, c);
    }

    // 1. Parse Hero Slider
    const heroSec = indexObj.sections?.quicksuuq_hero_slider || {
      settings: {
        show_section: true,
        autoplay: true,
        autoplay_interval: 5,
        show_arrows: true,
        show_dots: true,
      },
      blocks: {},
      block_order: [],
    };
    const slideOrder: string[] =
      heroSec.block_order && heroSec.block_order.length > 0
        ? heroSec.block_order
        : Object.keys(heroSec.blocks || {});

    const slides = slideOrder.map((blockId, idx) => {
      const b = heroSec.blocks?.[blockId]?.settings || {};
      const previewUrl =
        b.custom_image_url || DEFAULT_SLIDE_IMAGES[idx] || DEFAULT_SLIDE_IMAGES[0];
      return {
        id: blockId,
        enable_slide: b.enable_slide !== false,
        show_badge: b.show_badge !== false,
        badge: b.badge ?? "Fresh Groceries • Fast Delivery",
        badge_bg_color: b.badge_bg_color || "#FFC107",
        badge_text_color: b.badge_text_color || "#001E2B",
        heading: b.heading ?? "Your Daily Groceries Delivered to Your Door",
        description:
          b.description ??
          "Shop fresh fruits, vegetables, grains, dairy and home essentials at great prices on QuickSuuq.",
        show_button: b.show_button !== false,
        button_text: b.button_text ?? "Shop Now",
        button_url: b.button_url || "/collections/all",
        button_style: b.button_style || "navy",
        image_desktop: b.image_desktop || "",
        custom_image_url: b.custom_image_url || "",
        image_preview_url: previewUrl,
        image_position: b.image_position || (idx === 1 ? "left" : "right"),
        focal_point: b.focal_point || "center center",
        background_color: b.background_color || "#CFE9DF",
        show_green_circle: b.show_green_circle !== false,
        circle_color: b.circle_color || "#167A62",
        show_float_card_1: b.show_float_card_1 !== false,
        float_card_1_title: b.float_card_1_title || "Bananas - 1kg",
        float_card_1_sub: b.float_card_1_sub || "Fresh Daily",
        show_float_pill: b.show_float_pill !== false,
        float_pill_text: b.float_pill_text || "Delivery Done!",
        show_float_card_2: Boolean(b.show_float_card_2),
        float_card_2_title: b.float_card_2_title || "Avocado",
        float_card_2_price: b.float_card_2_price || "$1.80",
        float_card_2_badge: b.float_card_2_badge || "-15%",
      };
    });

    // 2. Parse Featured Categories
    const catSec = indexObj.sections?.freshcart_categories || {
      settings: { show_section: true, heading: "Featured Categories" },
      blocks: {},
      block_order: [],
    };
    const catOrder: string[] =
      catSec.block_order && catSec.block_order.length > 0
        ? catSec.block_order
        : Object.keys(catSec.blocks || {});

    const categories = catOrder.map((blockId) => {
      const b = catSec.blocks?.[blockId]?.settings || {};
      const handle = b.collection || "";
      const matchedCol = colMap.get(handle);
      const previewUrl =
        b.custom_image_url ||
        matchedCol?.image_src ||
        DEFAULT_CATEGORY_IMAGES[handle] ||
        DEFAULT_CATEGORY_IMAGES["midho-miro-cusub"];
      return {
        id: blockId,
        enable_category: b.enable_category !== false,
        title: b.title || matchedCol?.title || "Category",
        collection: handle,
        custom_url: b.custom_url || "",
        custom_image_url: b.custom_image_url || "",
        image_preview_url: previewUrl,
      };
    });

    // 3. Parse Promo Banners
    const promoSec = indexObj.sections?.freshcart_promos || {
      settings: { show_section: true },
      blocks: {},
      block_order: [],
    };
    const promoOrder: string[] =
      promoSec.block_order && promoSec.block_order.length > 0
        ? promoSec.block_order
        : Object.keys(promoSec.blocks || {});

    const banners = promoOrder.map((blockId, idx) => {
      const b = promoSec.blocks?.[blockId]?.settings || {};
      const previewUrl =
        b.custom_image_url || DEFAULT_PROMO_IMAGES[idx] || DEFAULT_PROMO_IMAGES[0];
      return {
        id: blockId,
        enable_banner: b.enable_banner !== false,
        heading: b.heading ?? (idx === 0 ? "Fruits & Vegetables" : "Freshly Baked Buns"),
        subheading: b.subheading ?? (idx === 0 ? "Get Upto 30% Off" : "Get Upto 25% Off"),
        show_button: b.show_button !== false,
        button_text: b.button_text ?? "Shop Now",
        button_url: b.button_url || "/collections/all",
        bg_color: b.bg_color || "#F0F3F2",
        custom_image_url: b.custom_image_url || "",
        image_preview_url: previewUrl,
      };
    });

    // 4. Parse Popular Products
    const prodSec = indexObj.sections?.freshcart_popular_products || {
      settings: {
        show_section: true,
        heading: "Popular Products",
        products_limit: 10,
        show_badges: true,
      },
    };

    return NextResponse.json({
      heroSlider: {
        show_section: heroSec.settings?.show_section !== false,
        autoplay: heroSec.settings?.autoplay !== false,
        autoplay_interval: Number(heroSec.settings?.autoplay_interval ?? 5),
        show_arrows: heroSec.settings?.show_arrows !== false,
        show_dots: heroSec.settings?.show_dots !== false,
        slides,
      },
      featuredCategories: {
        show_section: catSec.settings?.show_section !== false,
        heading: catSec.settings?.heading || "Featured Categories",
        categories,
      },
      promoBanners: {
        show_section: promoSec.settings?.show_section !== false,
        banners,
      },
      popularProducts: {
        show_section: prodSec.settings?.show_section !== false,
        heading: prodSec.settings?.heading || "Popular Products",
        products_limit: Number(prodSec.settings?.products_limit ?? 10),
        show_badges: prodSec.settings?.show_badges !== false,
      },
      collections: allCollections,
    });
  } catch (error) {
    console.error("Failed to fetch storefront CMS config:", error);
    return NextResponse.json(
      { error: "Failed to load storefront CMS configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Action A: Upload an image to Shopify Theme Assets (and optionally Collection Cover Image)
    if (body.action === "upload_image") {
      const rawName = String(body.filename || "upload.png")
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "-");
      const assetKey = `assets/cms-${Date.now()}-${rawName}`;
      const base64 = String(body.base64 || "").replace(/^data:image\/\w+;base64,/, "");

      if (!base64) {
        return NextResponse.json({ error: "Missing image data" }, { status: 400 });
      }

      const uploadRes = await shopifyFetch(`/themes/${DEFAULT_THEME_ID}/assets.json`, {
        method: "PUT",
        body: JSON.stringify({
          asset: {
            key: assetKey,
            attachment: base64,
          },
        }),
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        return NextResponse.json(
          { error: `Shopify upload failed: ${errText}` },
          { status: 422 }
        );
      }

      const uploadData = await uploadRes.json();
      const publicUrl = uploadData?.asset?.public_url || "";

      // If this upload is for a collection category, also update the collection's main image
      if (body.collectionHandle) {
        const customColsRes = await shopifyFetch("/custom_collections.json?limit=250");
        if (customColsRes.ok) {
          const colsData = await customColsRes.json();
          const matched = (colsData.custom_collections || []).find(
            (c: any) => c.handle === body.collectionHandle
          );
          if (matched) {
            await shopifyFetch(`/custom_collections/${matched.id}.json`, {
              method: "PUT",
              body: JSON.stringify({
                custom_collection: {
                  id: matched.id,
                  image: {
                    attachment: base64,
                    filename: rawName,
                  },
                },
              }),
            });
          }
        }
      }

      return NextResponse.json({ url: publicUrl, key: assetKey });
    }

    // Action B: Save Storefront CMS Configuration to templates/index.json
    if (body.action === "save_storefront") {
      const { heroSlider, featuredCategories, promoBanners, popularProducts } = body;

      const heroBlocks: Record<string, any> = {};
      const heroBlockOrder: string[] = [];

      (heroSlider?.slides || []).forEach((s: any, i: number) => {
        const id = s.id || `slide_${i + 1}`;
        heroBlockOrder.push(id);
        heroBlocks[id] = {
          type: "slide",
          settings: {
            enable_slide: Boolean(s.enable_slide),
            show_badge: Boolean(s.show_badge),
            badge: String(s.badge || ""),
            badge_bg_color: String(s.badge_bg_color || "#FFC107"),
            badge_text_color: String(s.badge_text_color || "#001E2B"),
            heading: String(s.heading || ""),
            description: String(s.description || ""),
            show_button: Boolean(s.show_button),
            button_text: String(s.button_text || "Shop Now"),
            button_url: String(s.button_url || "shopify://collections/all"),
            button_style: String(s.button_style || "navy"),
            ...(s.image_desktop ? { image_desktop: s.image_desktop } : {}),
            custom_image_url: String(s.custom_image_url || ""),
            image_position: String(s.image_position || "right"),
            focal_point: String(s.focal_point || "center center"),
            background_color: String(s.background_color || "#CFE9DF"),
            show_green_circle: Boolean(s.show_green_circle),
            circle_color: String(s.circle_color || "#167A62"),
            show_float_card_1: Boolean(s.show_float_card_1),
            float_card_1_title: String(s.float_card_1_title || ""),
            float_card_1_sub: String(s.float_card_1_sub || ""),
            show_float_pill: Boolean(s.show_float_pill),
            float_pill_text: String(s.float_pill_text || ""),
            show_float_card_2: Boolean(s.show_float_card_2),
            float_card_2_title: String(s.float_card_2_title || ""),
            float_card_2_price: String(s.float_card_2_price || ""),
            float_card_2_badge: String(s.float_card_2_badge || ""),
          },
        };
      });

      const catBlocks: Record<string, any> = {};
      const catBlockOrder: string[] = [];

      (featuredCategories?.categories || []).forEach((c: any, i: number) => {
        const id = c.id || `cat_${i + 1}`;
        catBlockOrder.push(id);
        catBlocks[id] = {
          type: "category",
          settings: {
            enable_category: Boolean(c.enable_category),
            title: String(c.title || ""),
            collection: String(c.collection || ""),
            custom_image_url: String(c.custom_image_url || ""),
            ...(c.custom_url ? { custom_url: String(c.custom_url) } : {}),
          },
        };
      });

      const bannerBlocks: Record<string, any> = {};
      const bannerBlockOrder: string[] = [];

      (promoBanners?.banners || []).forEach((b: any, i: number) => {
        const id = b.id || `banner_${i + 1}`;
        bannerBlockOrder.push(id);
        bannerBlocks[id] = {
          type: "banner",
          settings: {
            enable_banner: Boolean(b.enable_banner),
            heading: String(b.heading || ""),
            subheading: String(b.subheading || ""),
            show_button: Boolean(b.show_button),
            button_text: String(b.button_text || "Shop Now"),
            button_url: String(b.button_url || "shopify://collections/all"),
            custom_image_url: String(b.custom_image_url || ""),
            bg_color: String(b.bg_color || "#F0F3F2"),
          },
        };
      });

      const updatedIndexObj = {
        sections: {
          quicksuuq_hero_slider: {
            type: "quicksuuq-hero-slider",
            blocks: heroBlocks,
            block_order: heroBlockOrder,
            settings: {
              show_section: Boolean(heroSlider?.show_section),
              autoplay: Boolean(heroSlider?.autoplay),
              autoplay_interval: Number(heroSlider?.autoplay_interval || 5),
              slider_height: 460,
              content_width: 1280,
              border_radius: 8,
              show_arrows: Boolean(heroSlider?.show_arrows),
              show_dots: Boolean(heroSlider?.show_dots),
            },
          },
          freshcart_categories: {
            type: "freshcart-categories",
            blocks: catBlocks,
            block_order: catBlockOrder,
            settings: {
              show_section: Boolean(featuredCategories?.show_section),
              heading: String(featuredCategories?.heading || "Featured Categories"),
            },
          },
          freshcart_promos: {
            type: "freshcart-promos",
            blocks: bannerBlocks,
            block_order: bannerBlockOrder,
            settings: {
              show_section: Boolean(promoBanners?.show_section),
            },
          },
          freshcart_popular_products: {
            type: "freshcart-products",
            settings: {
              show_section: Boolean(popularProducts?.show_section ?? true),
              heading: String(popularProducts?.heading || "Popular Products"),
              products_limit: Number(popularProducts?.products_limit || 10),
              show_badges: Boolean(popularProducts?.show_badges ?? true),
            },
          },
        },
        order: [
          "quicksuuq_hero_slider",
          "freshcart_categories",
          "freshcart_promos",
          "freshcart_popular_products",
        ],
      };

      const putRes = await shopifyFetch(`/themes/${DEFAULT_THEME_ID}/assets.json`, {
        method: "PUT",
        body: JSON.stringify({
          asset: {
            key: "templates/index.json",
            value: JSON.stringify(updatedIndexObj, null, 2),
          },
        }),
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        return NextResponse.json(
          { error: `Failed to update Shopify homepage: ${errText}` },
          { status: 422 }
        );
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to save storefront CMS:", error);
    return NextResponse.json(
      { error: "Failed to save storefront configuration" },
      { status: 500 }
    );
  }
}
