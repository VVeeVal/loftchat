import { prisma } from '../db.js';

export function parseMentions(content: string): string[] {
  const mentionRegex = /@([A-Za-z0-9._-]+(?:\s+[A-Za-z0-9._-]+)*)/g;
  const matches = content.match(mentionRegex);
  if (!matches) return [];
  return [...new Set(matches.map((match) => match.slice(1).trim()))];
}

export async function findUsersByNames(names: string[], organizationId: string) {
  if (names.length === 0) return [];

  return prisma.user.findMany({
    where: {
      name: { in: names, mode: 'insensitive' },
      organizationMemberships: {
        some: { organizationId }
      }
    },
    select: { id: true, name: true }
  });
}

export function aggregateReactions(reactions: Array<{ emoji: string; user: { id: string; name: string | null } }>) {
  const grouped = new Map<string, { emoji: string; count: number; users: { id: string; name: string | null }[] }>();

  for (const reaction of reactions) {
    if (!grouped.has(reaction.emoji)) {
      grouped.set(reaction.emoji, { emoji: reaction.emoji, count: 0, users: [] });
    }
    const group = grouped.get(reaction.emoji)!;
    group.count += 1;
    group.users.push({ id: reaction.user.id, name: reaction.user.name });
  }

  return Array.from(grouped.values());
}
