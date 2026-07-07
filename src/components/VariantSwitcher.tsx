"use client";
import { useEffect, useState } from "react";

// Temporärer Vorschau-Umschalter (oben rechts), um zwei Design-Varianten
// live zu vergleichen. Vor dem Finalisieren wieder entfernen.
const VARIANTS = [
  { id: "kontrast", label: "Kontrast" },
  { id: "hell", label: "Hell" },
];

export default function VariantSwitcher() {
  const [variant, setVariant] = useState("kontrast");

  useEffect(() => {
    const saved = localStorage.getItem("variant") || "kontrast";
    setVariant(saved);
    document.documentElement.dataset.variant = saved;
  }, []);

  const choose = (id: string) => {
    setVariant(id);
    document.documentElement.dataset.variant = id;
    localStorage.setItem("variant", id);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 76,
        right: 16,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "#FFFFFF",
        border: "1px solid #E6E6E6",
        borderRadius: 9999,
        padding: "5px 6px",
        boxShadow: "0 6px 20px rgba(10,10,10,0.14)",
      }}
    >
      <span style={{ fontSize: 12, color: "#737373", padding: "0 6px", fontWeight: 600 }}>
        Design
      </span>
      {VARIANTS.map((v) => {
        const active = variant === v.id;
        return (
          <button
            key={v.id}
            data-vbtn={v.id}
            onClick={() => choose(v.id)}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              background: active ? "#0E9BB0" : "transparent",
              color: active ? "#FFFFFF" : "#3F3F3F",
              transition: "background-color .2s ease, color .2s ease",
            }}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
