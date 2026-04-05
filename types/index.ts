export interface Booth {
  zone: string;
  booth_number: string;
}

export interface Publisher {
  id: string;
  name_th: string;
  name_en: string | null;
  category?: string[];
  event_id: string;
  booths: Booth[];
}

export interface Book {
  id: string;
  publisher_id: string;
  title: string;
  price: number | null;
  is_purchased: boolean;
  event_id: string;
}
