import { QuestPageClient } from "./quest-page-client";

type QuestPageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuestPage({ params }: QuestPageProps) {
  const { id } = await params;

  return <QuestPageClient questId={id} />;
}
