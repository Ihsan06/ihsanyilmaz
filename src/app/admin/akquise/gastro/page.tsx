"use client";
import { Suspense } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { AkquiseCockpit } from "../Cockpit";

// Dasselbe Cockpit wie KFZ, eigene Liste (branche = 'gastro'). Suchlauf und
// Kriterien fuer Cafés werden noch festgelegt.
export default function GastroSeite() {
  return (
    <AdminShell titel="Gastro" eyebrow="Vertrieb" lead="Cafés und Restaurants finden, Websites prüfen, die richtigen ansprechen.">
      <Suspense fallback={<p className="mon-leer">Wird geladen …</p>}>
        <AkquiseCockpit branche="gastro" />
      </Suspense>
    </AdminShell>
  );
}
