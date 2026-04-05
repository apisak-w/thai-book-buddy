"use client";

import { useEvent } from "@/providers/event-provider";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function EventBar() {
  const { event, isLoading } = useEvent();

  if (isLoading || !event) return null;

  return (
    <Link
      href="/events"
      className="flex items-center gap-1.5 px-3 py-2 bg-[#44240B] text-white shrink-0"
    >
      <ChevronLeft size={16} strokeWidth={2.5} />
      <span className="text-sm font-medium truncate">{event.name_th}</span>
    </Link>
  );
}
