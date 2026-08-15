import type { Metadata } from "next";

// Der Adminbereich soll niemals in Suchmaschinen auftauchen.
export const metadata: Metadata = {
  title: "Adminbereich | AIY",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
