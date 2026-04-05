import { EventProvider } from "@/providers/event-provider";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <EventProvider slug={slug}>{children}</EventProvider>;
}
