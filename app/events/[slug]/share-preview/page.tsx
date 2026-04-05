"use client";

import { useRef, useState } from "react";
import ShareCard from "@/components/ShareCard";
import ShareCardModal from "@/components/ShareCardModal";
import { useEvent } from "@/providers/event-provider";

const MOCK = {
  purchasedCount: 12,
  percentile: 87,
  totalSpent: 3450,
  boothCount: 5,
};

const MOCK_NO_PERCENTILE = {
  purchasedCount: 1,
  percentile: 0,
  totalSpent: 350,
  boothCount: 1,
};

export default function EventSharePreviewPage() {
  const { event } = useEvent();
  const offscreenRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [emptyModal, setEmptyModal] = useState(false);
  const [noPercentileModal, setNoPercentileModal] = useState(false);
  const offscreenNoPercentileRef = useRef<HTMLDivElement>(null);

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
        onClick={() => setNoPercentileModal(true)}
        className="px-6 py-3 rounded-[16px] bg-[#c4855a] text-white font-[family-name:var(--font-sarabun)] font-medium text-[16px] active:scale-95 transition-all"
      >
        แชร์สถิติของฉัน (percentile = 0)
      </button>
      <button
        onClick={() => setEmptyModal(true)}
        className="px-6 py-3 rounded-[16px] border border-[#c4855a] text-[#c4855a] font-[family-name:var(--font-sarabun)] font-medium text-[16px] active:scale-95 transition-all"
      >
        แชร์สถิติของฉัน (ไม่มีข้อมูล)
      </button>

      {/* Off-screen cards for html2canvas capture */}
      <ShareCard ref={offscreenRef} {...MOCK} offscreen={true} eventName={event?.name_th} />
      <ShareCard ref={offscreenNoPercentileRef} {...MOCK_NO_PERCENTILE} offscreen={true} eventName={event?.name_th} />

      <ShareCardModal
        isOpen={modalOpen}
        stats={MOCK}
        offscreenRef={offscreenRef}
        onClose={() => setModalOpen(false)}
      />
      <ShareCardModal
        isOpen={noPercentileModal}
        stats={MOCK_NO_PERCENTILE}
        offscreenRef={offscreenNoPercentileRef}
        onClose={() => setNoPercentileModal(false)}
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
