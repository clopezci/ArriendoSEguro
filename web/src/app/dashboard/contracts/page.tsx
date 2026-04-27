import { redirect } from "next/navigation";

export default function ContractsIndexRedirectPage() {
  redirect("/dashboard/leases");
}
