import { notFound } from "next/navigation";
import { NavigationBar } from "@/components/ios";
import { getMenu, loadProducts } from "@/lib/menu";
import { catColor } from "@/lib/palette";
import { ProductForm } from "./product-form";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [product] = Number.isInteger(id) ? await loadProducts([id]) : [];
  if (!product?.is_active) notFound();
  const { categories } = await getMenu();
  return (
    <>
      <NavigationBar title={product.name} backLabel="Menu" backHref="/" />
      <ProductForm product={product} color={catColor(categories, product.category_id)} />
    </>
  );
}
