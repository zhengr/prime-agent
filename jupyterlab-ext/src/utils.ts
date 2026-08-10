import { IUser } from './types';

const MENTION_CLASS = 'jp-chat-mention';

export function replaceMentionToSpan(content: string, user: IUser): string {
  if (!user.mention_name) return content;
  const regex = new RegExp('@' + user.mention_name, 'g');
  return content.replace(regex, `<span class="${MENTION_CLASS}"> @${user.mention_name} </span>`);
}

export function replaceSpanToMention(content: string, user: IUser): string {
  if (!user.mention_name) return content;
  const mentionEl = `<span class="${MENTION_CLASS}"> @${user.mention_name} </span>`;
  return content.replace(new RegExp(mentionEl, 'g'), '@' + user.mention_name);
}

export function getUserColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

export function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleString([], { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
