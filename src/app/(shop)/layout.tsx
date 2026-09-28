import { CartProvider } from "@/components/cart";
import { AppTabBar } from "@/components/tab-bar";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="app">{children}</div>
      <AppTabBar />
    </CartProvider>
  );
}
