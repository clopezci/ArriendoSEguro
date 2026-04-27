import { redirect } from "next/navigation";

/** Alias público sugerido: misma versión comercial alojada en /interno/landing-principal. */
export default function LandingComercialRedirect() {
  redirect("/interno/landing-principal");
}
