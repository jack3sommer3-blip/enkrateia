import { redirect } from "next/navigation";

export default function ProfileRedirect() {
  redirect("/social?tab=profile");
}
