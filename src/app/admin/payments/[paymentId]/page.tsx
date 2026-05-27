import AdminPaymentDetailClient from '@/components/admin/AdminPaymentDetailClient';

interface AdminPaymentDetailPageProps {
  params: Promise<{
    paymentId: string;
  }>;
}

export default async function AdminPaymentDetailPage({ params }: AdminPaymentDetailPageProps) {
  const { paymentId } = await params;

  return <AdminPaymentDetailClient paymentId={paymentId} />;
}
