import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveRiderChatAccess } from '@/lib/rider-chat';

export type CallKind = 'CONVERSATION' | 'RIDER_CHAT';

export async function resolveCallPeer(kind: unknown, targetId: unknown) {
  const session = await getSession();
  if (!session || typeof targetId !== 'string' || targetId.length < 1 || targetId.length > 100) return { error: NextResponse.json({ error: 'Please log in to call.' }, { status: 401 }) } as const;
  if (kind !== 'CONVERSATION' && kind !== 'RIDER_CHAT') return { error: NextResponse.json({ error: 'Invalid call type.' }, { status: 400 }) } as const;

  if (kind === 'CONVERSATION') {
    if (session.role !== 'CUSTOMER' && session.role !== 'SELLER') return { error: NextResponse.json({ error: 'Only the buyer or seller can call in this chat.' }, { status: 403 }) } as const;
    const conversation = await prisma.conversation.findUnique({ where: { id: targetId }, select: { customerId: true, sellerId: true, customer: { select: { user: { select: { id: true, name: true } } } }, seller: { select: { businessName: true, user: { select: { id: true, name: true } } } } } });
    if (!conversation) return { error: NextResponse.json({ error: 'Conversation not found.' }, { status: 404 }) } as const;
    const caller = session.role === 'CUSTOMER' ? conversation.customer.user : conversation.seller.user;
    const receiver = session.role === 'CUSTOMER' ? conversation.seller.user : conversation.customer.user;
    if (caller.id !== session.userId) return { error: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) } as const;
    return { session, kind, targetId, callerName: session.role === 'SELLER' ? conversation.seller.businessName : caller.name, receiverUserId: receiver.id, receiverName: session.role === 'CUSTOMER' ? conversation.seller.businessName : conversation.customer.user.name };
  }

  if (session.role !== 'CUSTOMER' && session.role !== 'RIDER') return { error: NextResponse.json({ error: 'Only the customer or assigned rider can call in this order chat.' }, { status: 403 }) } as const;
  const access = await resolveRiderChatAccess(targetId);
  if ('error' in access) return { error: access.error } as const;
  if (access.chat.status !== 'ACTIVE' || !access.chat.riderId) return { error: NextResponse.json({ error: 'Calls are available after a rider accepts this order.' }, { status: 409 }) } as const;
  const chat = await prisma.riderChat.findUnique({ where: { id: targetId }, select: { customer: { select: { user: { select: { id: true, name: true } } } }, rider: { select: { user: { select: { id: true, name: true } } } } } });
  if (!chat?.rider) return { error: NextResponse.json({ error: 'Assigned rider not found.' }, { status: 404 }) } as const;
  const caller = session.role === 'CUSTOMER' ? chat.customer.user : chat.rider.user;
  const receiver = session.role === 'CUSTOMER' ? chat.rider.user : chat.customer.user;
  if (caller.id !== session.userId) return { error: NextResponse.json({ error: 'Only the customer and assigned rider can call.' }, { status: 403 }) } as const;
  return { session, kind, targetId, callerName: caller.name, receiverUserId: receiver.id, receiverName: receiver.name };
}

export async function resolveCallParticipant(callId: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Please log in.' }, { status: 401 }) } as const;
  const call = await prisma.inAppCall.findUnique({ where: { id: callId } });
  if (!call) return { error: NextResponse.json({ error: 'Call not found.' }, { status: 404 }) } as const;
  if (session.userId !== call.callerUserId && session.userId !== call.receiverUserId) return { error: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) } as const;
  return { session, call } as const;
}
