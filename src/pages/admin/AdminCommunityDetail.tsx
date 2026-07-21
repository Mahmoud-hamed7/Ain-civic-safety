import { useParams } from 'react-router-dom';
import CommunityDetailPage from '../communities/CommunityDetailPage';

export default function AdminCommunityDetail() {
  const { id = '' } = useParams();
  return (
    <CommunityDetailPage
      readOnly={false}
      backPath="/admin/communities"
      editPath={`/admin/communities/${id}/edit`}
    />
  );
}
