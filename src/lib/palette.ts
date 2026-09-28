/** Warna sistem DS per kategori (urutan tetap agar konsisten di daftar menu & halaman produk). */
export const CAT_COLORS = ["--system-brown", "--system-pink", "--system-orange", "--system-teal", "--system-indigo", "--system-purple"];

export const catColor = (categories: { id: number }[], id: number | null) =>
  CAT_COLORS[Math.max(0, categories.findIndex((c) => c.id === id)) % CAT_COLORS.length];
