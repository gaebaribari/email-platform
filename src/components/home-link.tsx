import Link from "next/link";
import { Mail } from "lucide-react";

export function HomeLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <Mail className="w-3.5 h-3.5" />
      <span className="font-medium">Email Platform</span>
    </Link>
  );
}
