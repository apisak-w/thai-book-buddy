"use client";
import { Sparkles, ChevronDown } from "lucide-react";
import Link from "next/link";

export default function BrandHeader({ eventName }: { eventName?: string }) {
  return (
    <div className="flex items-center justify-between w-full mb-[4px]">
      <div className="flex items-center gap-[4px]">
        <Sparkles size={20} color="#8fad7a" fill="#8fad7a" />
        <p className="font-[family-name:var(--font-jakarta)] font-bold text-[16px] text-[#8fad7a]">
          BookFair Buddy
        </p>
      </div>
      {eventName ? (
        <Link
          href="/events"
          className="flex items-center gap-0.5 font-[family-name:var(--font-jakarta)] text-[12px] text-[#8B7355] hover:text-[#44240B] transition-colors"
        >
          <span className="max-w-[140px] truncate">{eventName}</span>
          <ChevronDown size={12} />
        </Link>
      ) : (
        <p className="font-[family-name:var(--font-jakarta)] text-[12px] text-[#c4d8b6]">v1.0</p>
      )}
    </div>
  );
}
