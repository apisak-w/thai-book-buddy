import type { Event } from "@/types/events";
import type { Publisher, Book } from "@/types/index";

interface ExportData {
  event: {
    name_th: string;
    name_en: string;
    start_date: string;
    end_date: string;
    location_th: string | null;
    location_en: string | null;
  };
  publishers: Array<{
    name_th: string;
    name_en: string | null;
    booths: Array<{ zone: string; booth_number: string }>;
    books: Array<{
      title: string;
      price: number | null;
      is_purchased: boolean;
    }>;
    note: string | null;
  }>;
  exported_at: string;
}

export function exportAsJSON(
  event: Event,
  publishers: Publisher[],
  books: Book[],
  notesByPublisher: Map<string, string>
) {
  const booksByPublisher = new Map<string, Book[]>();
  for (const book of books) {
    const list = booksByPublisher.get(book.publisher_id) ?? [];
    list.push(book);
    booksByPublisher.set(book.publisher_id, list);
  }

  const data: ExportData = {
    event: {
      name_th: event.name_th,
      name_en: event.name_en,
      start_date: event.start_date,
      end_date: event.end_date,
      location_th: event.location_th,
      location_en: event.location_en,
    },
    publishers: publishers.map((p) => ({
      name_th: p.name_th,
      name_en: p.name_en,
      booths: p.booths,
      books: (booksByPublisher.get(p.id) ?? []).map((b) => ({
        title: b.title,
        price: b.price,
        is_purchased: b.is_purchased,
      })),
      note: notesByPublisher.get(p.id) ?? null,
    })),
    exported_at: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.slug}-my-list.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAsCSV(
  event: Event,
  publishers: Publisher[],
  books: Book[],
  notesByPublisher: Map<string, string>
) {
  const publisherMap = new Map(publishers.map((p) => [p.id, p]));
  const rows = [
    ["Publisher (TH)", "Publisher (EN)", "Booth", "Book Title", "Price", "Purchased", "Note"].join(","),
  ];

  for (const book of books) {
    const pub = publisherMap.get(book.publisher_id);
    if (!pub) continue;
    const booth = pub.booths.map((b) => `${b.zone}${b.booth_number}`).join("; ");
    const note = notesByPublisher.get(book.publisher_id) ?? "";
    rows.push(
      [
        `"${pub.name_th}"`,
        `"${pub.name_en ?? ""}"`,
        `"${booth}"`,
        `"${book.title}"`,
        book.price ?? "",
        book.is_purchased ? "Yes" : "No",
        `"${note.replace(/"/g, '""')}"`,
      ].join(",")
    );
  }

  const blob = new Blob(["\uFEFF" + rows.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.slug}-my-list.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
