'use server'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { writer } from '@/lib/db'
import { dismissReports } from '@/lib/freshness'
import { approveRequest, getReviewer, rejectRequest } from '@/lib/onboarding'
import { getSession } from '@/lib/session'

async function reviewer() {
  const session = await getSession()
  const r = session && (await getReviewer(writer(), session.phone ?? session.email))
  if (!r) notFound()
  return r
}

export async function approve(fd: FormData) {
  await approveRequest(writer(), String(fd.get('id')), await reviewer())
  revalidatePath('/admin')
}

export async function reject(fd: FormData) {
  await rejectRequest(writer(), String(fd.get('id')), await reviewer())
  revalidatePath('/admin')
}

export async function dismiss(fd: FormData) {
  await dismissReports(writer(), String(fd.get('doctor_id')), await reviewer())
  revalidatePath('/admin')
}
