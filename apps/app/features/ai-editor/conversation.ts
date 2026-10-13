import type { Proposal, StudioMessage } from "./contracts";

/** Keep linked proposals beside their assistant message, without hiding orphaned proposals. */
export function conversationItems(
  messages: StudioMessage[],
  proposals: Proposal[],
) {
  const remaining = new Map(proposals.map((p) => [p._id, p]));
  const items: { key: string; message?: StudioMessage; proposal?: Proposal }[] =
    [];
  for (const message of messages) {
    const proposal =
      message.role === "assistant" && message.proposalId
        ? remaining.get(message.proposalId)
        : undefined;
    if (proposal) remaining.delete(proposal._id);
    items.push({ key: message._id, message, proposal });
  }
  for (const proposal of remaining.values())
    items.push({ key: `proposal:${proposal._id}`, proposal });
  return items;
}

export function followsConversation(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
) {
  return scrollHeight - scrollTop - clientHeight < 96;
}
