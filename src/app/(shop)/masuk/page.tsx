import { NavigationBar } from "@/components/ios";
import { StaffLogin } from "./staff-login";

export const metadata = { title: "Masuk staf" };

const ERR: Record<string, string> = {
  google: "Login Google gagal. Coba lagi.", state: "Sesi login kedaluwarsa. Coba lagi.", staff: "Email ini terdaftar sebagai staf. Gunakan form di bawah.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <>
      <NavigationBar large title="Masuk staf" />
      <div className="page stack-lg">
        {e && ERR[e] && <p className="notice notice--err" role="alert">{ERR[e]}</p>}
        <StaffLogin />
      </div>
    </>
  );
}
