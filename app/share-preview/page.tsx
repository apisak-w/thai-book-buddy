"use client";

import { useRef, useState } from "react";
import ShareCard from "../../components/ShareCard";
import ShareCardModal from "../../components/ShareCardModal";

const MOCK = {
  purchasedCount: 12,
  percentile: 87,
  totalSpent: 3450,
  boothCount: 5,
};

export default function SharePreviewPage() {
  const offscreenRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [emptyModal, setEmptyModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#fafaf8] flex flex-col items-center justify-center gap-6 p-8">
      <p className="text-[#9c7a5b] text-sm">Share card preview (mock data)</p>
      <button
        onClick={() => setModalOpen(true)}
        className="px-6 py-3 rounded-[16px] bg-[#c4855a] text-white font-[family-name:var(--font-sarabun)] font-medium text-[16px] active:scale-95 transition-all"
      >
        แชร์สถิติของฉัน (มีข้อมูล)
      </button>
      <button
        onClick={() => setEmptyModal(true)}
        className="px-6 py-3 rounded-[16px] border border-[#c4855a] text-[#c4855a] font-[family-name:var(--font-sarabun)] font-medium text-[16px] active:scale-95 transition-all"
      >
        แชร์สถิติของฉัน (ไม่มีข้อมูล)
      </button>

      {/* Off-screen card for html2canvas capture */}
      <ShareCard ref={offscreenRef} {...MOCK} offscreen={true} />

      <ShareCardModal
        isOpen={modalOpen}
        stats={MOCK}
        offscreenRef={offscreenRef}
        onClose={() => setModalOpen(false)}
      />
      <ShareCardModal
        isOpen={emptyModal}
        stats={null}
        offscreenRef={offscreenRef}
        onClose={() => setEmptyModal(false)}
      />
    </div>
  );
}
