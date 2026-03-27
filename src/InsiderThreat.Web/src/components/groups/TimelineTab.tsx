import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './TimelineTab.css';

const GANTT_DATA = [
    {
        group: 'Conceptual Design',
        tasks: [
            { name: 'Core Strategy', start: 0, duration: 32, status: 'done', percent: 100 },
            { name: 'Asset Library', start: 35, duration: 40, status: 'progress', percent: 90 },
            { name: 'Review Phase', start: 78, duration: 20, status: 'todo', percent: 0 },
        ]
    },
    {
        group: 'Frontend Architecture',
        tasks: [
            { name: 'Tailwind Config', start: 38, duration: 40, status: 'active', percent: 60 },
            { name: 'Base Components', start: 55, duration: 30, status: 'todo', percent: 0 },
            { name: 'Grid System', start: 70, duration: 25, status: 'todo', percent: 0 },
        ]
    },
    {
        group: 'Backend Integration',
        tasks: [
            { name: 'API Setup', start: 10, duration: 38, status: 'done', percent: 100 },
            { name: 'Auth Module', start: 50, duration: 35, status: 'progress', percent: 70 },
        ]
    },
];

const WEEKS = ['MAY 8', 'MAY 15', 'MAY 22', 'MAY 29', 'JUN 5', 'JUN 12'];

const STATUS_CONFIG: Record<string, { color: string; textColor: string; label: string }> = {
    done: { color: '#10b981', textColor: '#fff', label: 'DONE' },
    progress: { color: '#3b82f6', textColor: '#fff', label: 'IN PROGRESS' },
    active: { color: '#1d4ed8', textColor: '#fff', label: 'ACTIVE' },
    todo: { color: '#e2e8f0', textColor: '#94a3b8', label: 'TODO' },
};

export default function TimelineTab() {
    const { t } = useTranslation();
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        'Conceptual Design': true,
        'Frontend Architecture': true,
        'Backend Integration': true,
    });

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    return (
        <div className="timelineTab">
            <div className="timeline-header">
                <div>
                    <span className="timeline-badge">{t('project_detail.header.subtitle')}</span>
                    <p className="timeline-breadcrumb">Q3 Roadmap • {t('project_detail.timeline.title')}</p>
                </div>
                <div className="timeline-actions">
                    <button className="tl-btn-outline">
                        <span className="material-symbols-outlined">filter_list</span> {t('feed.filter')}
                    </button>
                    <button className="tl-btn-outline">
                        <span className="material-symbols-outlined">share</span> {t('feed.btn_post_anyway')} {/* Reuse share or add new */}
                    </button>
                    <button className="tl-btn-primary">+ {t('project_detail.mytasks.add_task')}</button>
                </div>
            </div>

            <div className="timeline-body">
                {/* Left: Task Names */}
                <div className="tl-left">
                    <div className="tl-col-header">{t('project_detail.mytasks.narrative')}</div>
                    {GANTT_DATA.map((group) => (
                        <div key={group.group}>
                            <div className="tl-group-row" onClick={() => toggleGroup(group.group)}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16, transition: 'transform 0.2s', transform: expandedGroups[group.group] ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                                    expand_more
                                </span>
                                <span className="tl-group-name">{group.group}</span>
                            </div>
                            {expandedGroups[group.group] && group.tasks.map(task => (
                                <div key={task.name} className="tl-task-row">
                                    <span>{task.name}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Right: Gantt Bars */}
                <div className="tl-right">
                    {/* Week Headers */}
                    <div className="tl-date-header">
                        {WEEKS.map(w => <span key={w}>{w}</span>)}
                    </div>

                    {GANTT_DATA.map(group => (
                        <div key={group.group}>
                            {/* Group row (empty) */}
                            <div className="tl-gantt-group-row"></div>

                            {expandedGroups[group.group] && group.tasks.map(task => {
                                const cfg = STATUS_CONFIG[task.status];
                                return (
                                    <div key={task.name} className="tl-gantt-bar-row">
                                        <div className="tl-bar-track">
                                            <div
                                                className="tl-bar"
                                                style={{
                                                    left: `${task.start}%`,
                                                    width: `${task.duration}%`,
                                                    background: cfg.color,
                                                    color: cfg.textColor,
                                                }}
                                            >
                                                {task.percent > 0 && <span>● {task.percent}% {cfg.label}</span>}
                                                {task.percent === 0 && <span>{cfg.label}</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Progress Overview */}
            <div className="tl-milestones">
                <h3>{t('project_detail.focus.milestones')}</h3>
                <div className="milestone-list">
                    {[
                        { name: 'Design System v1.0', date: 'May 22', done: true },
                        { name: 'Frontend Alpha', date: 'May 29', done: false },
                        { name: 'Backend Integration', date: 'Jun 5', done: false },
                        { name: 'Beta Launch', date: 'Jun 12', done: false },
                    ].map(m => (
                        <div key={m.name} className={`milestone-item ${m.done ? 'done' : ''}`}>
                            <span className="material-symbols-outlined">
                                {m.done ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            <div>
                                <p className="milestone-name">{m.name}</p>
                                <p className="milestone-date">{m.date}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
