import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LeftSidebar from '../components/LeftSidebar';
import BottomNavigation from '../components/BottomNavigation';
import GroupDashboardTab from '../components/groups/GroupDashboardTab';
import MyTaskTab from '../components/groups/MyTaskTab';
import TimelineTab from '../components/groups/TimelineTab';
import FilesTab from '../components/groups/FilesTab';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import './GroupDetailPage.css';

const TABS = [
    { key: 'dashboard', label: 'project_detail.tabs.dashboard', icon: 'dashboard' },
    { key: 'mytask', label: 'project_detail.tabs.mytasks', icon: 'task_alt' },
    { key: 'timeline', label: 'project_detail.tabs.timeline', icon: 'timeline' },
    { key: 'files', label: 'project_detail.tabs.files', icon: 'folder' },
];

export default function GroupDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getGroupName = (id?: string) => {
        switch (id) {
            case '1': return 'Phòng Phát Triển Sản Phẩm';
            case '2': return 'Hội Những Người Thích Cà Phê';
            case '3': return 'Kỹ thuật & Công nghệ';
            case '4': return 'HR & Văn hóa doanh nghiệp';
            default: return `Dự án ${id}`;
        }
    };
    
    const groupName = getGroupName(id);

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <GroupDashboardTab />;
            case 'mytask': return <MyTaskTab />;
            case 'timeline': return <TimelineTab />;
            case 'files': return <FilesTab />;
            default: return null;
        }
    };

    const handleDeleteProject = async () => {
        const confirmDelete = window.confirm(t('groups.confirm_delete_msg', { name: groupName }));
        if (!confirmDelete) return;

        try {
            await api.delete(`/api/groups/${id}`);
            navigate('/groups');
        } catch (err) {
            console.error('Failed to delete project', err);
            alert(t('groups.delete_fail', 'Xóa dự án thất bại.'));
        }
    };

    return (
        <div className="groupDetail-container">
            {!isMobile && <LeftSidebar />}
            
            <div className="groupDetail-main-wrapper">
                <main className="groupDetail">
                    {/* Header Section */}
                    <div className="groupDetail-top-section">
                        <div className="groupDetail-header">
                            <button className="backBtn" onClick={() => navigate('/groups')} title={t('common.btn_back', 'Quay lại')}>
                                <span className="material-symbols-outlined">arrow_back</span>
                            </button>
                            <div className="groupInfo">
                                <div className="project-breadcrumb">
                                    <span>{t('project_detail.breadcrumbs.workspace')}</span>
                                    <span className="bc-sep">/</span>
                                    <span>{t('project_detail.breadcrumbs.projects')}</span>
                                    <span className="bc-sep">/</span>
                                    <span className="bc-active">{groupName}</span>
                                </div>
                                <h1 className="groupTitle">{groupName}</h1>
                                <p className="groupSubtitle">{t('project_detail.header.subtitle')} • {t('project_detail.header.sprint')}</p>
                            </div>
                        </div>

                        {/* Sub-Header / Tab Navigation */}
                        <div className="groupDetail-tabs-wrapper">
                            <div className="groupDetail-tabs">
                                {TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        className={`tabItem ${activeTab === tab.key ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab.key)}
                                    >
                                        <span className="material-symbols-outlined">{tab.icon}</span>
                                        {t(tab.label)}
                                    </button>
                                ))}
                            </div>
                            <div className="project-actions">
                                <button className="proj-action-btn">
                                    <span className="material-symbols-outlined">settings</span>
                                </button>
                                {!['1', '2', '3', '4'].includes(id || '') && (
                                    <button 
                                        className="proj-action-btn delete" 
                                        onClick={handleDeleteProject}
                                        title={t('project_detail.header.btn_delete')}
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                )}
                                <button className="proj-action-btn">
                                    <span className="material-symbols-outlined">more_horiz</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="groupDetail-body">
                        {renderContent()}
                    </div>
                </main>
            </div>
            
            {isMobile && <BottomNavigation />}
        </div>
    );
}
