import { Routes, Route, Navigate } from 'react-router-dom';
import { PageLayout } from './components/layout/PageLayout';
import { SummaryPage } from './pages/SummaryPage';
import { ResourceGroupsPage } from './pages/ResourceGroupsPage';
import { ServicesPage } from './pages/ServicesPage';
import { EntriesPage } from './pages/EntriesPage';
import { PersonnelPage } from './pages/PersonnelPage';

export default function App() {
  return (
    <PageLayout>
      <Routes>
        <Route path="/" element={<SummaryPage />} />
        <Route path="/resource-groups" element={<ResourceGroupsPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/personnel" element={<PersonnelPage />} />
        <Route path="/entries" element={<EntriesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageLayout>
  );
}
