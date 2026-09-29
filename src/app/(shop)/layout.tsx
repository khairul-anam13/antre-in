import { CartProvider } from "@/components/cart";
import { AppTabBar } from "@/components/tab-bar";
import { WelcomeScreen } from "@/components/welcome-screen";
import { getSettings } from "@/lib/menu";
import { isOpenNow } from "@/lib/slots";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const open = isOpenNow({ now: new Date(), open: s.open_time, close: s.close_time, isOpen: s.is_open });
  return (
    <CartProvider>
      <WelcomeScreen shopName={s.shop_name} isOpen={open} openTime={s.open_time.slice(0, 5)} closeTime={s.close_time.slice(0, 5)} />
      <div className="app">{children}</div>
      <AppTabBar />
    </CartProvider>
  );
}
