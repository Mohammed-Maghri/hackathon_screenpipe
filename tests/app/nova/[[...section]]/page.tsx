import { notFound } from 'next/navigation'
import { NovaStore } from '../../../components/nova/NovaStore'
import '../nova.css'
export const metadata = { title: 'NOVA — Store operations', description: 'Local ecommerce dashboard for Ghost browser recording.' }
export default async function Page({ params }: { params: Promise<{ section?: string[] }> }) {
 const { section } = await params
 const page = section?.join('/') || 'home'
 if (!['home','login','orders','products','customers','analytics','marketing','discounts','content','settings','store','pos','reviews','subscriptions'].includes(page)) notFound()
 return <NovaStore page={page} />
}
