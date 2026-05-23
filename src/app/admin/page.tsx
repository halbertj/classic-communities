import { redirect } from "next/navigation";

// There's no dashboard at `/admin` itself yet — communities is the
// natural landing tab, so send admins straight there. When we add an
// actual overview page this redirect can be replaced.
export default function AdminIndexPage() {
  redirect("/admin/communities");
}
