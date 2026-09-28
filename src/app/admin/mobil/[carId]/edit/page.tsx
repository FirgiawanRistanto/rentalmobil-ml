import AdminCarForm from '@/components/admin/AdminCarForm';

interface EditMobilPageProps {
  params: Promise<{ carId: string }>;
}

export default async function EditMobilPage({ params }: EditMobilPageProps) {
  const { carId } = await params;
  return <AdminCarForm carId={carId} mode="edit" />;
}
