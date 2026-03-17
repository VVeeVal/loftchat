import { prisma } from '../db.js';

export function parseMentions(content: string): string[] {
  const mentions: string[] = [];
  const isTokenChar = (char: string) => /[A-Za-z0-9._-]/.test(char);
  const isUppercaseStart = (char: string) => /[A-Z]/.test(char);

  let index = 0;
  while (index < content.length) {
    if (content[index] !== '@') {
      index += 1;
      continue;
    }

    let cursor = index + 1;
    if (!content[cursor] || !isTokenChar(content[cursor])) {
      index += 1;
      continue;
    }

    const tokens: string[] = [];
    let shouldContinue = true;

    while (shouldContinue) {
      const tokenStart = cursor;
      while (cursor < content.length && isTokenChar(content[cursor])) {
        cursor += 1;
      }

      const rawToken = content.slice(tokenStart, cursor);
      const token = rawToken.replace(/[.,!?;:]+$/, '');
      const endedWithTerminalPunctuation = rawToken !== token;

      if (!token) {
        break;
      }

      tokens.push(token);
      if (endedWithTerminalPunctuation) {
        break;
      }

      let lookahead = cursor;
      while (content[lookahead] === ' ') {
        lookahead += 1;
      }

      if (!content[lookahead] || !isUppercaseStart(content[lookahead])) {
        break;
      }

      cursor = lookahead;
    }

    if (tokens.length > 0) {
      mentions.push(tokens.join(' '));
    }

    index = cursor;
  }

  return [...new Set(mentions)];
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
