import { redirect } from "next/navigation";

export const metadata = {
  title: "Conocer más",
};

export default function ConocerMasPage() {
  redirect("/entiendelo-facil#conocer-mas");
}
