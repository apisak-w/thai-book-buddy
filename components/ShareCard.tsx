"use client";

import { forwardRef } from "react";

interface ShareCardProps {
  purchasedCount: number;
  percentile: number;
  totalSpent: number;
  boothCount: number;
}

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  function ShareCard({ purchasedCount, percentile, totalSpent, boothCount }, ref) {
    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1920,
          background: "#fafaf8",
          padding: "120px 90px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "sans-serif",
          position: "absolute",
          left: "-9999px",
          top: 0,
        }}
      >
        {/* Header with mascot */}
        <div style={{ display: "flex", alignItems: "center", gap: "36px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascot.png"
            alt="BB mascot"
            style={{
              width: 180,
              height: 180,
              borderRadius: 48,
              objectFit: "cover",
            }}
          />
          <div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: "#3d2b1a",
              }}
            >
              BookFair Buddy
            </div>
            <div
              style={{
                fontSize: 36,
                color: "#9c7a5b",
                marginTop: 8,
              }}
            >
              งานสัปดาห์หนังสือ 2569
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 256,
              fontWeight: 900,
              color: "#c4855a",
              lineHeight: 1,
            }}
          >
            {purchasedCount}
          </div>
          <div
            style={{
              fontSize: 56,
              color: "#3d2b1a",
              marginTop: 16,
              fontWeight: 600,
            }}
          >
            เล่มที่ซื้อแล้ว
          </div>

          {/* Percentile badge */}
          <div
            style={{
              marginTop: 80,
              background: "#f3ffeb",
              borderRadius: 48,
              padding: "48px 64px",
              border: "4px solid #c4d8b6",
            }}
          >
            <div style={{ fontSize: 44, color: "#9c7a5b" }}>
              ซื้อหนังสือมากกว่า
            </div>
            <div
              style={{
                fontSize: 112,
                fontWeight: 800,
                color: "#973c00",
              }}
            >
              {percentile}%
            </div>
            <div style={{ fontSize: 44, color: "#9c7a5b" }}>
              ของผู้ใช้ทั้งหมด
            </div>
          </div>

          {/* Secondary stats */}
          <div
            style={{
              marginTop: 64,
              display: "flex",
              justifyContent: "center",
              gap: 64,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 80,
                  fontWeight: 700,
                  color: "#3d2b1a",
                }}
              >
                {boothCount}
              </div>
              <div style={{ fontSize: 36, color: "#9c7a5b" }}>บูธ</div>
            </div>
            <div
              style={{
                width: 4,
                height: 120,
                background: "#e2c9a6",
                alignSelf: "center",
              }}
            />
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 80,
                  fontWeight: 700,
                  color: "#3d2b1a",
                }}
              >
                ฿{totalSpent.toLocaleString()}
              </div>
              <div style={{ fontSize: 36, color: "#9c7a5b" }}>รวมทั้งหมด</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, color: "#a6a09b" }}>
            แชร์จาก BookFair Buddy
          </div>
        </div>
      </div>
    );
  }
);

export default ShareCard;
