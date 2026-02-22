import LoginModal from "@/components/auth/LoginModal";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const router = useRouter();
  return (
    <LoginModal
      visible
      onClose={() => {
        router.back();
      }}
      onSuccess={() => {
        // nothing extra on page success
      }}
    />
  );
}
