export interface Event {
  id: string;
  name_th: string;
  name_en: string;
  slug: string;
  description_th: string | null;
  description_en: string | null;
  start_date: string;
  end_date: string;
  location_th: string | null;
  location_en: string | null;
  location_url: string | null;
  map_image_url: string | null;
  status: "draft" | "active" | "archived";
  created_at: string;
}

export interface UserEvent {
  id: string;
  user_id: string;
  event_id: string;
  is_active: boolean;
  joined_at: string;
}
