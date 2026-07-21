import CommunityDetailPage from '../communities/CommunityDetailPage';
import { useParams } from 'react-router-dom';

export default function CitizenCommunityDetail() {
  const { id = '' } = useParams();
  return (
    <CommunityDetailPage
      backPath="/citizen/communities"
      citizenMode
      editPath={`/citizen/communities/${id}/edit`}
    />
  );
}
