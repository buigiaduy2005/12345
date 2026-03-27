import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './FilesTab.css';

interface FileItem {
    id: number;
    name: string;
    type: 'image' | 'pdf' | 'doc' | 'spreadsheet' | 'other';
    size: string;
    preview?: string;
}

const MOCK_FILES: FileItem[] = [
    { id: 1, name: 'Building_Facade_Final.jpg', type: 'image', size: '14.2 MB', preview: 'https://picsum.photos/300/200?random=10' },
    { id: 2, name: 'Q4_Editorial_Strategy.pdf', type: 'pdf', size: '2.4 MB' },
    { id: 3, name: 'Interview_Transcripts.docx', type: 'doc', size: '45 KB' },
    { id: 4, name: 'Project_Timeline_v2.xlsx', type: 'spreadsheet', size: '1.1 MB' },
    { id: 5, name: 'Cover_Art_Draft.png', type: 'image', size: '8.9 MB', preview: 'https://picsum.photos/300/200?random=20' },
    { id: 6, name: 'PRD_Document_v3.pdf', type: 'pdf', size: '3.7 MB' },
];

const FILE_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
    pdf: { icon: 'picture_as_pdf', color: '#ef4444', bg: '#fef2f2' },
    doc: { icon: 'description', color: '#3b82f6', bg: '#eff6ff' },
    spreadsheet: { icon: 'table_chart', color: '#10b981', bg: '#f0fdf4' },
    other: { icon: 'insert_drive_file', color: '#94a3b8', bg: '#f8fafc' },
    image: { icon: 'image', color: '#8b5cf6', bg: '#f5f3ff' },
};

const TEAM = [
    { name: 'Sarah Jenkins', role: 'Lead Editor', avatar: 'https://i.pravatar.cc/150?u=sarah', status: 'online' },
    { name: 'Marcus Thorne', role: 'UX Designer', avatar: 'https://i.pravatar.cc/150?u=marcus', status: 'online' },
    { name: 'Elena Rodriguez', role: 'Project Lead', avatar: 'https://i.pravatar.cc/150?u=elena', status: 'offline' },
    { name: 'James Wu', role: 'Architect', avatar: 'https://i.pravatar.cc/150?u=james', status: 'online' },
];

export default function FilesTab() {
    const { t } = useTranslation();
    const [files, setFiles] = useState<FileItem[]>(MOCK_FILES);
    const [searchQuery, setSearchQuery] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        // Simulate adding dropped file
        const droppedFiles = Array.from(e.dataTransfer.files);
        const newFiles = droppedFiles.map((f, i) => ({
            id: Date.now() + i,
            name: f.name,
            type: f.type.startsWith('image/') ? 'image' as const : 'other' as const,
            size: `${(f.size / 1024).toFixed(0)} KB`,
        }));
        setFiles(prev => [...newFiles, ...prev]);
    };

    return (
        <div className="filesTab">
            {/* Header */}
            <div className="files-header">
                <div>
                    <p className="files-section-label">{t('project_detail.files.resource_library')}</p>
                    <h2 className="files-title">{t('project_detail.files.project_assets')}</h2>
                </div>
                <div className="files-header-actions">
                    <div className="files-search">
                        <span className="material-symbols-outlined">search</span>
                        <input
                            type="text"
                            placeholder={t('project_detail.files.search')}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className="upload-btn" onClick={() => inputRef.current?.click()}>
                        <span className="material-symbols-outlined">cloud_upload</span>
                        {t('project_detail.files.upload')}
                    </button>
                    <input ref={inputRef} type="file" multiple hidden onChange={(e) => {
                        const newFiles = Array.from(e.target.files || []).map((f, i) => ({
                            id: Date.now() + i,
                            name: f.name,
                            type: f.type.startsWith('image/') ? 'image' as const : 'other' as const,
                            size: `${(f.size / 1024).toFixed(0)} KB`,
                        }));
                        setFiles(prev => [...newFiles, ...prev]);
                    }} />
                </div>
            </div>

            <div className="files-main-layout">
                {/* Files Grid */}
                <div className="files-grid-area">
                    {/* Drop Zone */}
                    <div
                        className={`drop-zone ${dragOver ? 'active' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleFileDrop}
                    >
                        <span className="material-symbols-outlined">cloud_upload</span>
                        <p>{t('project_detail.files.drop_zone')}</p>
                    </div>

                    {/* Files Grid */}
                    <div className="files-grid">
                        {filtered.map(file => (
                            <div key={file.id} className="file-card">
                                {file.preview ? (
                                    <div className="file-card-preview">
                                        <img src={file.preview} alt={file.name} />
                                    </div>
                                ) : (
                                    <div className="file-card-icon" style={{ background: FILE_ICONS[file.type]?.bg }}>
                                        <span className="material-symbols-outlined" style={{ color: FILE_ICONS[file.type]?.color, fontSize: 36 }}>
                                            {FILE_ICONS[file.type]?.icon}
                                        </span>
                                    </div>
                                )}
                                <div className="file-card-info">
                                    <p className="file-name">{file.name}</p>
                                    <div className="file-meta">
                                        <span className="file-type-label">{file.type.toUpperCase()}</span>
                                        <span className="file-size">• {file.size}</span>
                                        <button className="file-download-btn" title="Download">
                                            <span className="material-symbols-outlined">download</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filtered.length === 0 && (
                        <div className="no-files">
                            <span className="material-symbols-outlined">folder_open</span>
                            <p>{t('library.no_docs')}</p>
                        </div>
                    )}
                </div>

                {/* Right Panel */}
                <div className="files-sidebar">
                    {/* Team */}
                    <div className="files-panel">
                        <div className="files-panel-header">
                            <h3>{t('project_detail.team.title')}</h3>
                            <span className="material-symbols-outlined" style={{ fontSize: 20, cursor: 'pointer', color: 'var(--color-primary)' }}>person_add</span>
                        </div>
                        <div className="files-team-list">
                            {TEAM.map(m => (
                                <div key={m.name} className="files-team-member">
                                    <div className="files-avatar-wrap">
                                        <img src={m.avatar} alt={m.name} />
                                        <span className={`files-status-dot files-status--${m.status}`}></span>
                                    </div>
                                    <div>
                                        <p className="files-member-name">{m.name}</p>
                                        <p className="files-member-role">{m.role}</p>
                                    </div>
                                    {m.status === 'offline' && <span className="files-offline-tag">OFFLINE</span>}
                                </div>
                            ))}
                        </div>
                        <button className="files-invite-btn">
                            <span className="material-symbols-outlined">add</span>
                            {t('project_detail.team.invite')}
                        </button>
                        <p className="files-license-note">{t('project_detail.files.license')}</p>
                    </div>

                    {/* Storage Usage */}
                    <div className="files-panel">
                        <h3 className="storage-title">{t('project_detail.files.storage_usage')}</h3>
                        <div className="storage-bar">
                            <div className="storage-fill" style={{ width: '65%' }}></div>
                        </div>
                        <div className="storage-meta">
                            <span>32.5 GB {t('project_detail.files.used')}</span>
                            <span>50 GB {t('project_detail.files.total')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
