"use client";
import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bookmark, Map } from "lucide-react";

const tabs = [
  {
    href: "/map",
    label: "ผังงาน",
    icon: (active: boolean) => (
      <Map size={24} color={active ? "#973c00" : "#a6a09b"} strokeWidth={1.8} />
    ),
  },
  {
    href: "/browse",
    label: "ค้นหา",
    icon: (active: boolean) => (
      <Search size={24} color={active ? "#973c00" : "#a6a09b"} strokeWidth={1.8} />
    ),
  },
  {
    href: "/my-list",
    label: "รายการของฉัน",
    icon: (active: boolean) => (
      <Bookmark size={24} color={active ? "#973c00" : "#a6a09b"} strokeWidth={1.8} />
    ),
  },
];

export default memo(function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="เมนูหลัก" className="shrink-0 border-t border-[#f0e4d4] bg-[#fafaf8]">
      <div className="flex pt-[8px] px-[24px] justify-between" style={{ paddingBottom: "calc(12px + var(--sab))" }}>
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-[8px] w-[80px]"
            >
              {tab.icon(active)}
              <span
                className={`font-[family-name:var(--font-sarabun)] text-[14px] leading-none whitespace-nowrap ${
                  active ? "font-semibold text-[#973c00]" : "text-[#a6a09b]"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
});
