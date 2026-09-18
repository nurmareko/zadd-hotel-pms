import { permanentRedirect } from "next/navigation";

export default function HousekeepingCompatibilityPage() {
  permanentRedirect("/app/hk/rooms");
}
