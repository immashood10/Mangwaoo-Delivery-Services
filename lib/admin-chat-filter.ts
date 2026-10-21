// Which order chats the admin list shows. The same sets the dashboard cards count (waiting, with a rider, started today).

export type ChatFilter = 'all' | 'waiting' | 'with-rider' | 'today';

export const CHAT_FILTERS: { key: ChatFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting for rider' },
  { key: 'with-rider', label: 'With a rider' },
  { key: 'today', label: 'Started today' },
];

export function parseChatFilter(value: string | undefined): ChatFilter {
  return CHAT_FILTERS.find((filter) => filter.key === value)?.key ?? 'all';
}
