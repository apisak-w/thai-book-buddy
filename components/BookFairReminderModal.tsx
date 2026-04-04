"use client";

import { useState } from "react";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { X } from "lucide-react";

const DISMISSED_KEY = "bookfair_reminder_dismissed";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function BookFairReminderModal({ isOpen, onClose }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  function handleConfirm() {
    if (dontShowAgain) localStorage.setItem(DISMISSED_KEY, "1");
    onClose();
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-black/70" />
      <div className="fixed inset-0 flex items-center justify-center px-[16px]">
        <DialogPanel className="bg-[#fafaf8] rounded-[16px] p-[24px] w-full flex flex-col gap-[32px] items-center">
          {/* Image + close */}
          <div className="flex flex-col gap-[8px] items-center w-full">
            <div className="flex justify-end w-full">
              <button onClick={onClose} aria-label="ปิด" className="active:opacity-60 transition-opacity">
                <X size={24} color="#3d2b1a" strokeWidth={1.5} />
              </button>
            </div>
            <img
              src="/bb-reminder.png"
              alt="BB mascot"
              className="size-[180px] rounded-[40px] object-cover"
            />
          </div>

          {/* Text */}
          <div className="flex flex-col gap-[16px] text-center text-[#3d2b1a] w-full">
            <DialogTitle className="font-[family-name:var(--font-sarabun)] font-semibold text-[24px] leading-tight">
              อย่าลืม screenshot หน้าแผนที่ก่อนไปงานนะ
            </DialogTitle>
            <p className="font-[family-name:var(--font-sarabun)] font-normal text-[16px] leading-normal whitespace-pre-line">
              {`เนื่องจากในวันงานอาจมีคนใช้งานเยอะแล้วระบบเราไม่สามารถรองรับจำนวนคนได้ น้อง BB เลยอยากแนะนำให้ screenshot หน้าจอเก็บไว้ด้วยนะครับ จะได้หาบูธที่อยากไปเจอ\n\nเที่ยวงานหนังสือให้สนุกนะคร้าบบบ 🤎`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-[16px] w-full">
            <button
              onClick={handleConfirm}
              className="h-[56px] w-full rounded-[16px] bg-[#c4855a] shadow-[2px_2px_0px_0px_#e0d0c0] active:scale-95 transition-all"
            >
              <span className="font-[family-name:var(--font-sarabun)] font-medium text-[20px] text-[#fafaf8]">
                เข้าใจแล้ว
              </span>
            </button>

            <label className="flex items-center gap-[12px] cursor-pointer">
              <div className="flex items-center justify-center size-[20px]">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="size-[16px] rounded-[4px] border border-[#e4e4e7] accent-[#c4855a] cursor-pointer"
                />
              </div>
              <span className="font-[family-name:var(--font-sarabun)] text-[14px] text-[#3d2b1a] leading-[20px]">
                ไม่ต้องแสดงข้อความให้เห็นอีก
              </span>
            </label>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
