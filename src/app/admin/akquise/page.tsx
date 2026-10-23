"use client";
import { Suspense } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { AkquiseCockpit } from "./Cockpit";

export default function KfzSeite() {
  return (
    <AdminShell titel="KFZ" eyebrow="Vertrieb" lead="Autohäuser finden, Websites prüfen, die richtigen ansprechen.">
      <Suspense fallback={<p className="mon-leer">Wird geladen …</p>}>
        <AkquiseCockpit branche="kfz" />
      </Suspense>
    </AdminShell>
  );
}
