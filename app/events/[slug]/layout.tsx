import { EventProvider } from "@/providers/event-provider";
import EventBar from "@/components/EventBar";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <EventProvider slug={slug}>
      <div className="flex flex-col h-[100dvh]">
        <EventBar />
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </EventProvider>
  );
}
