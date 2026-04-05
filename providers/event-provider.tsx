"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Event } from "@/types/events";

interface EventContextValue {
  event: Event | null;
  eventId: string | null;
  eventSlug: string;
  isLoading: boolean;
  error: string | null;
}

const EventContext = createContext<EventContextValue>({
  event: null,
  eventId: null,
  eventSlug: "",
  isLoading: true,
  error: null,
});

export function useEvent() {
  return useContext(EventContext);
}

export function EventProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvent() {
      try {
        const res = await fetch(`/api/events`);
        const events: Event[] = await res.json();
        const found = events.find((e) => e.slug === slug);
        if (!found) {
          setError("Event not found");
          return;
        }
        setEvent(found);
      } catch {
        setError("Failed to load event");
      } finally {
        setIsLoading(false);
      }
    }
    loadEvent();
  }, [slug]);

  return (
    <EventContext.Provider
      value={{
        event,
        eventId: event?.id ?? null,
        eventSlug: slug,
        isLoading,
        error,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}
