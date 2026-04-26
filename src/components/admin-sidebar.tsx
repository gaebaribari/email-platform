"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail, Users, List, Send } from "lucide-react";

const navItems = [
  { href: "/admin", label: "대시보드", icon: Mail },
  { href: "/admin/lists", label: "이메일 리스트", icon: List },
  { href: "/admin/subscribers", label: "구독자 관리", icon: Users },
  { href: "/admin/campaigns", label: "캠페인", icon: Send },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <div className="w-52 border-r border-border bg-muted/30 flex flex-col shrink-0 h-screen">
      <div className="px-4 py-4 border-b border-border">
        <Link href="/admin" className="text-sm font-bold tracking-tight">
          Email Platform
        </Link>
        <p className="text-[10px] text-muted-foreground">관리자</p>
      </div>

      <nav className="flex-1 py-3 px-2">
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <Link href="/subscribe" className="text-[11px] text-primary hover:underline">
          구독 페이지 보기
        </Link>
      </div>
    </div>
  );
}
