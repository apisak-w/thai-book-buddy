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
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#44240B]/8 font-[family-name:var(--font-jakarta)] text-[11px] font-medium text-[#44240B] hover:bg-[#44240B]/15 transition-colors"
        >
          <span className="max-w-[140px] truncate">{eventName}</span>
          <ChevronDown size={10} strokeWidth={2.5} />
        </Link>
      ) : (
        <p className="font-[family-name:var(--font-jakarta)] text-[12px] text-[#c4d8b6]">v1.0</p>
      )}
    </div>
  );
}
