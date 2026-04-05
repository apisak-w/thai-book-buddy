"use client";
import { Sparkles, ChevronDown } from "lucide-react";
import Link from "next/link";

export default function BrandHeader({ eventName }: { eventName?: string }) {
  return (
    <div className="flex items-center justify-between gap-[8px] w-full mb-[4px]">
      <div className="shrink-0 flex items-center gap-[4px]">
        <Sparkles size={20} color="#8fad7a" fill="#8fad7a" />
        <p className="font-[family-name:var(--font-jakarta)] font-bold text-[16px] text-[#8fad7a]">
          BookFair Buddy
        </p>
      </div>
      {eventName ? (
        <Link
          href="/events"
          className="flex items-center gap-[4px] px-[12px] py-[4px] rounded-[20px] bg-[#fff8ee] border border-[#f0e4d4] font-[family-name:var(--font-sarabun)] font-light text-[14px] text-[#973C00] hover:bg-[#f0e4d4] transition-all min-w-0"
        >
          <span className="truncate">{eventName}</span>
          <ChevronDown size={10} strokeWidth={2.5} className="shrink-0" />
        </Link>
      ) : (
        <p className="font-[family-name:var(--font-jakarta)] text-[12px] text-[#c4d8b6]">v1.0</p>
      )}
    </div>
  );
}
