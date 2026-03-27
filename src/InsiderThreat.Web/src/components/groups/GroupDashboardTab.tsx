import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './GroupDashboardTab.css';

const MEMBERS = [
    { id: 1, name: 'Sarah Jenkins', role: 'Lead Designer', avatar: 'https://i.pravatar.cc/150?u=sarah', status: 'online' },
    { id: 2, name: 'Marcus Thorne', role: 'Senior Dev', avatar: 'https://i.pravatar.cc/150?u=marcus', status: 'online' },
    { id: 3, name: 'Elena Rodriguez', role: 'Product Manager', avatar: 'https://i.pravatar.cc/150?u=elena', status: 'offline' },
    { id: 4, name: 'James Wu', role: 'Architect', avatar: 'https://i.pravatar.cc/150?u=james', status: 'online' },
];

const STATS = [
    { label: 'project_detail.stats.health', value: '94%', sub: 'project_detail.stats.sub_health', color: '#10b981', icon: 'favorite' },
    { label: 'project_detail.stats.total', value: '108', sub: 'project_detail.stats.sub_total', color: '#3b82f6', icon: 'task_alt' },
    { label: 'project_detail.stats.progress', value: '12', sub: 'project_detail.stats.sub_progress', color: '#f59e0b', icon: 'pending_actions' },
    { label: 'project_detail.stats.completed', value: '76', sub: 'project_detail.stats.sub_completed', color: '#8b5cf6', icon: 'check_circle' },
];

const GANTT_TASKS = [
    { name: 'Conceptual Design', items: [
        { label: 'Core Strategy', start: 0, width: 30, status: 'done', color: '#10b981' },
        { label: 'Asset Library', start: 35, width: 38, status: 'progress', color: '#3b82f6' },
        { label: 'Review Phase', start: 78, width: 20, status: 'todo', color: '#e2e8f0' },
    ]},
    { name: 'Frontend Arch.', items: [
        { label: 'Tailwind Config', start: 35, width: 42, status: 'active', color: '#1d4ed8' },
        { label: 'Base Components', start: 60, width: 25, status: 'todo', color: '#e2e8f0' },
    ]},
];

// Simple SVG Pie Chart component
const TaskPieChart = () => {
    const { t } = useTranslation();
    return (
        <div className="pie-chart-container">
            <svg viewBox="0 0 36 36" className="circular-chart">
                <path className="circle-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path className="circle circle-done"
                    strokeDasharray="70, 100"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path className="circle circle-progress"
                    strokeDasharray="15, 100"
                    strokeDashoffset="-70"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path className="circle circle-todo"
                    strokeDasharray="15, 100"
                    strokeDashoffset="-85"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" className="percentage">70%</text>
            </svg>
            <div className="pie-legend">
                <div className="legend-item"><span className="dot dot-done"></span> {t('project_detail.charts.done')}</div>
                <div className="legend-item"><span className="dot dot-progress"></span> {t('project_detail.charts.in_progress')}</div>
                <div className="legend-item"><span className="dot dot-todo"></span> {t('project_detail.charts.remaining')}</div>
            </div>
        </div>
    );
};

export default function GroupDashboardTab() {
    const { t } = useTranslation();
    const [ganttPeriod, setGanttPeriod] = useState('Weekly');

    return (
        <div className="dashboardTab animate-in">
            {/* Top Action Bar */}
            <div className="dash-toprow">
                <div className="dash-project-meta">
                    <span className="dash-stage-badge">{t('project_detail.header.subtitle')}</span>
                    <p className="dash-breadcrumb">Q3 Roadmap • {t('project_detail.tabs.dashboard')}</p>
                </div>
                <div className="dash-toprow-actions">
                    <div className="memberPile">
                        {MEMBERS.slice(0, 3).map(m => (
                            <img key={m.id} src={m.avatar} alt={m.name} className="avatar-overlap" title={m.name} />
                        ))}
                        <span className="avatar-more">+{MEMBERS.length - 3}</span>
                    </div>
                    <button className="inviteBtn">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
                        {t('project_detail.team.invite')}
                    </button>
                    <button className="iconBtn-dash" title="Filter">
                        <span className="material-symbols-outlined">filter_list</span> Filter
                    </button>
                    <button className="iconBtn-dash" title="Share">
                        <span className="material-symbols-outlined">share</span> Share
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="statCards-grid">
                {STATS.map((s, i) => (
                    <div className="statCard" key={i} style={{ borderTop: `3px solid ${s.color}` }}>
                        <div className="statCard-top">
                            <p className="statLabel">{t(s.label)}</p>
                            <span className="material-symbols-outlined statIcon" style={{ color: s.color }}>{s.icon}</span>
                        </div>
                        <div className="statValueWrap">
                            <span className="statValue" style={{ color: s.color }}>{s.value}</span>
                        </div>
                        <span className="statSubvalue">{t(s.sub)}</span>
                    </div>
                ))}
            </div>

            {/* Main Grid */}
            <div className="dashboard-mainGrid">
                <div className="mainGrid-left">
                    {/* Gantt Chart Panel */}
                    <div className="panelCard">
                        <div className="panelHeader">
                            <div>
                                <h3>{t('project_detail.timeline.title')}</h3>
                                <p className="panelSubtitle">{t('project_detail.timeline.subtitle')}</p>
                            </div>
                            <div className="panelTabs">
                                {['daily', 'weekly', 'monthly'].map(p => (
                                    <span key={p} className={ganttPeriod === p ? 'active' : ''} onClick={() => setGanttPeriod(p)}>{t(`project_detail.timeline.${p}`)}</span>
                                ))}
                            </div>
                        </div>

                        {/* Gantt Chart */}
                        <div className="ganttChart">
                            <div className="ganttDateHeader">
                                {['MAY 15', 'MAY 22', 'MAY 29', 'JUN 5'].map(d => (
                                    <span key={d}>{d}</span>
                                ))}
                            </div>
                            <div className="ganttBody">
                                {GANTT_TASKS.map((group, gi) => (
                                    <div key={gi} className="ganttGroup">
                                        <div className="ganttGroupLabel">
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>expand_more</span>
                                            {group.name}
                                        </div>
                                        {group.items.map((item, ii) => (
                                            <div key={ii} className="ganttRow">
                                                <span className="ganttLabel">{item.label}</span>
                                                <div className="ganttTrack">
                                                    <div
                                                        className={`ganttBar ganttBar--${item.status}`}
                                                        style={{
                                                            left: `${item.start}%`,
                                                            width: `${item.width}%`,
                                                            background: item.status === 'todo' ? '#e2e8f0' : item.color,
                                                            color: item.status === 'todo' ? '#94a3b8' : '#fff',
                                                        }}
                                                    >
                                                        {item.status === 'done' && '● 100% DONE'}
                                                        {item.status === 'progress' && '● 90% PROGRESS'}
                                                        {item.status === 'active' && '● ACTIVE DEVELOP'}
                                                        {item.status === 'todo' && 'TODO'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Task Breakdown Panel */}
                    <div className="panelCard breakdown-panel">
                        <div className="panelHeader">
                            <h3>{t('project_detail.charts.distribution')}</h3>
                        </div>
                        <div className="breakdown-content">
                            <TaskPieChart />
                            <div className="breakdown-stats">
                                <div className="b-stat">
                                    <span className="b-val">76</span>
                                    <span className="b-label">{t('project_detail.stats.completed')}</span>
                                </div>
                                <div className="b-stat">
                                    <span className="b-val">12</span>
                                    <span className="b-label">{t('project_detail.stats.progress')}</span>
                                </div>
                                <div className="b-stat">
                                    <span className="b-val">20</span>
                                    <span className="b-label">{t('project_detail.charts.remaining')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className="mainGrid-right">
                    {/* Team Panel */}
                    <div className="panelCard">
                        <div className="panelHeader">
                            <h3>{t('project_detail.team.title')}</h3>
                            <span className="material-symbols-outlined" style={{ cursor: 'pointer', fontSize: 20, color: 'var(--color-text-muted)' }}>person_add</span>
                        </div>
                        <div className="teamList">
                            {MEMBERS.map(m => (
                                <div className="teamMember" key={m.id}>
                                    <div className="memberAvatarWrap">
                                        <img src={m.avatar} alt={m.name} className="memberAvatar" />
                                        <span className={`statusDot statusDot--${m.status}`}></span>
                                    </div>
                                    <div className="memberInfo">
                                        <p className="memberName">{m.name}</p>
                                        <p className="memberRole">{m.role}</p>
                                    </div>
                                    {m.status === 'offline' && <span className="offlineBadge">OFFLINE</span>}
                                </div>
                            ))}
                        </div>
                        <button className="inviteFullBtn">
                            <span className="material-symbols-outlined">add</span>
                            {t('project_detail.team.manage')}
                        </button>
                    </div>

                    {/* Health Score Panel */}
                    <div className="panelCard healthPanel">
                        <p className="healthLabel">{t('project_detail.stats.health')}</p>
                        <div className="healthScore">94%</div>
                        <div className="healthBar"><div className="healthBarFill" style={{ width: '94%' }}></div></div>
                        <div className="healthMeta">
                            <div>
                                <p className="healthMetaLabel">{t('project_detail.charts.velocity')}</p>
                                <p className="healthMetaVal">4.2 pts/d</p>
                            </div>
                            <div>
                                <p className="healthMetaLabel">RESOURCES</p>
                                <p className="healthMetaVal">12/14</p>
                            </div>
                        </div>
                    </div>

                    {/* Focus Mode Panel */}
                    <div className="panelCard">
                        <div className="panelHeader">
                            <h3>{t('project_detail.focus.title')}</h3>
                        </div>
                        <div className="focusOptions">
                            {[
                                { label: 'project_detail.focus.critical', checked: true },
                                { label: 'project_detail.focus.overdue', checked: false },
                                { label: 'project_detail.focus.milestones', checked: true },
                            ].map(opt => (
                                <label className="focusOption" key={opt.label}>
                                    <input type="checkbox" defaultChecked={opt.checked} />
                                    <span>{t(opt.label)}</span>
                                </label>
                            ))}
                        </div>
                        <div className="velocityRow">
                            <div className="velocityCard">
                                <p className="velocityLabel">{t('project_detail.charts.velocity')}</p>
                                <p className="velocityVal">84%</p>
                            </div>
                            <div className="velocityCard">
                                <p className="velocityLabel">{t('project_detail.charts.mood')}</p>
                                <p className="velocityVal" style={{ color: '#10b981' }}>{t('project_detail.charts.optimal')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
