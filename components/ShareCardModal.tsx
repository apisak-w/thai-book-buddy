"use client";

import { useRef, useState, useEffect } from "react";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { X, Download } from "lucide-react";
import ShareCard from "./ShareCard";

interface ShareCardModalProps {
  isOpen: boolean;
  stats: {
    purchasedCount: number;
    percentile: number;
    totalSpent: number;
    boothCount: number;
  } | null;
  offscreenRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

export default function ShareCardModal({ isOpen, stats, offscreenRef, onClose }: ShareCardModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    // Reserve space for: close button row (44px), download button (52px), hint (20px), gaps (80px)
    const reserved = 196;
    const scaleByWidth = (window.innerWidth - 64) / 1080;
    const scaleByHeight = (window.innerHeight - reserved) / 1920;
    setScale(Math.min(scaleByWidth, scaleByHeight));
  }, [isOpen]);

  const containerW = Math.round(scale * 1080);
  const containerH = Math.round(scale * 1920);

  async function handleDownload() {
    if (!offscreenRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(offscreenRef.current, {
        scale: 1,
        useCORS: true,
        backgroundColor: "#fafaf8",
        width: 1080,
        height: 1920,
      });
      const link = document.createElement("a");
      link.download = "bookfair-buddy-stats.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  if (!stats) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-black/80" />
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-[16px] px-[32px]">
        {/* Close button */}
        <div className="flex justify-end w-full">
          <button onClick={onClose} aria-label="ปิด" className="active:opacity-60 transition-opacity">
            <X size={28} color="#fafaf8" strokeWidth={1.5} />
          </button>
        </div>

        <DialogPanel className="flex flex-col items-center gap-[16px] w-full">
          {/* Scaled card preview */}
          <div
            style={{ width: containerW, height: containerH, overflow: "hidden", borderRadius: 16, flexShrink: 0 }}
          >
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 1080, height: 1920 }}>
              <ShareCard {...stats} offscreen={false} />
            </div>
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center justify-center gap-[8px] h-[52px] w-full rounded-[16px] bg-[#c4855a] shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:scale-95 transition-all disabled:opacity-50"
          >
            <Download size={18} color="#fafaf8" strokeWidth={2} />
            <span className="font-[family-name:var(--font-sarabun)] font-medium text-[18px] text-[#fafaf8]">
              {downloading ? "กำลังบันทึก..." : "บันทึกรูป"}
            </span>
          </button>

          <p className="font-[family-name:var(--font-sarabun)] text-[13px] text-white/50 text-center">
            หรือ screenshot หน้าจอนี้ได้เลย
          </p>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
