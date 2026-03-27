import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CreateTaskModal from './CreateTaskModal';
import './MyTaskTab.css';

interface Task {
    id: number;
    tag: string;
    tagColor: string;
    title: string;
    description?: string;
    progress: number;
    members: string[];
    comments: number;
    attachments?: number;
    deadline?: string;
    priority?: 'urgent' | 'normal';
    actionIcon?: string;
    isActive?: boolean;
}

interface Column {
    id: string;
    label: string;
    color: string;
    dotColor: string;
    tasks: Task[];
}

const INITIAL_COLUMNS: Column[] = [
    {
        id: 'todo', label: 'project_detail.charts.remaining', color: '#64748b', dotColor: '#64748b',
        tasks: [
            {
                id: 1, tag: 'DESIGN', tagColor: '#10b981', title: 'Develop design language for the mobile interface overhaul',
                progress: 35, members: ['https://i.pravatar.cc/150?u=sarah', 'https://i.pravatar.cc/150?u=marcus'],
                comments: 0, deadline: '2d', actionIcon: 'attach_file',
            },
            {
                id: 2, tag: 'URGENT', tagColor: '#ef4444', title: 'API Documentation for v2.0 endpoint architecture',
                progress: 0, members: ['https://i.pravatar.cc/150?u=james'],
                comments: 4, priority: 'urgent',
            }
        ]
    },
    {
        id: 'inprogress', label: 'project_detail.charts.in_progress', color: '#3b82f6', dotColor: '#3b82f6',
        tasks: [
            {
                id: 3, tag: 'EDITORIAL', tagColor: '#6366f1', title: 'Final copy review for brand manifesto',
                progress: 65, members: ['https://i.pravatar.cc/150?u=elena'],
                comments: 0, deadline: 'Today', isActive: true, actionIcon: 'bolt',
            },
            {
                id: 4, tag: 'FRONTEND', tagColor: '#f59e0b', title: 'Implement Dark Mode using Design System tokens',
                progress: 40, members: ['https://i.pravatar.cc/150?u=sarah'],
                comments: 0,
            }
        ]
    },
    {
        id: 'inreview', label: 'project_detail.focus.critical', color: '#f59e0b', dotColor: '#f59e0b',
        tasks: [
            {
                id: 5, tag: 'MARKETING', tagColor: '#8b5cf6', title: 'Social Media assets for Q3 product launch',
                progress: 80, members: ['https://i.pravatar.cc/150?u=sarah', 'https://i.pravatar.cc/150?u=james'],
                comments: 0, actionIcon: 'visibility',
            }
        ]
    },
    {
        id: 'done', label: 'project_detail.charts.done', color: '#10b981', dotColor: '#10b981',
        tasks: [
            {
                id: 6, tag: 'STRATEGY', tagColor: '#64748b', title: 'Quarterly strategy presentation to stakeholders',
                progress: 100, members: ['https://i.pravatar.cc/150?u=elena'],
                comments: 0,
            }
        ]
    }
];

export default function MyTaskTab() {
    const { t } = useTranslation();
    const [columns, setColumns] = useState<Column[]>(INITIAL_COLUMNS);
    const [viewMode, setViewMode] = useState<'kanban' | 'timeline' | 'list'>('kanban');
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dragging, setDragging] = useState<{ colId: string; taskId: number } | null>(null);

    const handleDragStart = (colId: string, taskId: number) => {
        setDragging({ colId, taskId });
    };

    const handleDropToColumn = (targetColId: string) => {
        if (!dragging || dragging.colId === targetColId) return;
        const srcCol = columns.find(c => c.id === dragging.colId)!;
        const task = srcCol.tasks.find(t => t.id === dragging.taskId)!;
        setColumns(prev => prev.map(col => {
            if (col.id === dragging.colId) return { ...col, tasks: col.tasks.filter(t => t.id !== dragging.taskId) };
            if (col.id === targetColId) return { ...col, tasks: [...col.tasks, task] };
            return col;
        }));
        setDragging(null);
    };

    return (
        <div className="myTaskTab">
            {/* Topbar */}
            <div className="myTask-topBar">
                <div className="topBar-left">
                    <div className="task-project-label">PROJECT NARRATIVE</div>
                    <h2 className="task-project-title">{t('project_detail.header.sprint')}</h2>
                </div>
                <div className="topBar-right">
                    <div className="searchTask">
                        <span className="material-symbols-outlined">search</span>
                        <input type="text" placeholder={t('project_detail.mytasks.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="viewToggles">
                        <button className={viewMode === 'kanban' ? 'active' : ''} onClick={() => setViewMode('kanban')}>
                            <span className="material-symbols-outlined">view_column</span> {t('project_detail.mytasks.board')}
                        </button>
                        <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
                            <span className="material-symbols-outlined">menu</span> {t('project_detail.mytasks.list')}
                        </button>
                        <button className={viewMode === 'timeline' ? 'active' : ''} onClick={() => setViewMode('timeline')}>
                            <span className="material-symbols-outlined">tune</span> {t('project_detail.mytasks.filters')}
                        </button>
                    </div>
                    <button className="addNewBtn" onClick={() => setShowCreateTask(true)}>
                        <span className="material-symbols-outlined">add</span> {t('project_detail.mytasks.add_new')}
                    </button>
                    <div className="memberPile">
                        <img src="https://i.pravatar.cc/150?u=12" alt="User" className="avatar-overlap" />
                        <img src="https://i.pravatar.cc/150?u=24" alt="User" className="avatar-overlap" />
                        <span className="avatar-more">+2</span>
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            {viewMode === 'kanban' && (
                <div className="kanbanBoard">
                    {columns.map(col => {
                        const filteredTasks = col.tasks.filter(t =>
                            !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                        return (
                            <div
                                key={col.id}
                                className="kanbanColumn"
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => handleDropToColumn(col.id)}
                            >
                                <div className="colHeader">
                                    <div className="colTitle">
                                        <span className="colDot" style={{ background: col.dotColor }}></span>
                                        <span>{t(col.label)}</span>
                                        <span className="colCount">{filteredTasks.length}</span>
                                    </div>
                                    <div className="colActions">
                                        <button className="iconBtn">
                                            <span className="material-symbols-outlined">add</span>
                                        </button>
                                        <button className="iconBtn">
                                            <span className="material-symbols-outlined">more_horiz</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="kanbanCards">
                                    {filteredTasks.map(task => (
                                        <div
                                            key={task.id}
                                            className={`kCard ${task.isActive ? 'kCard--active' : ''}`}
                                            draggable
                                            onDragStart={() => handleDragStart(col.id, task.id)}
                                        >
                                            <div className="kCardTop">
                                                <span className="kCardTag" style={{ background: task.tagColor + '22', color: task.tagColor }}>
                                                    {task.tag}
                                                </span>
                                                {task.deadline && (
                                                    <span className={`kCardDeadline ${task.deadline === 'Today' ? 'kCardDeadline--today' : ''}`}>
                                                        {task.deadline === 'Today'
                                                            ? <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span> {t('feed.period_today')}</>
                                                            : <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span> {task.deadline}</>
                                                        }
                                                    </span>
                                                )}
                                            </div>

                                            <h4 className="kCardTitle">{task.title}</h4>

                                            <div className="kCardProgress">
                                                <div className="kProgressBar">
                                                    <div className="kProgressFill" style={{
                                                        width: `${task.progress}%`,
                                                        background: task.progress === 100 ? '#10b981' : col.color
                                                    }}></div>
                                                </div>
                                            </div>

                                            <div className="kCardFooter">
                                                <div className="kCardMembers">
                                                    {task.members.map((url, i) => (
                                                        <img key={i} src={url} alt="member" className="kMemberAvatar" />
                                                    ))}
                                                </div>
                                                <div className="kCardActions">
                                                    {task.comments > 0 && (
                                                        <span className="kCardMeta">
                                                            <span className="material-symbols-outlined">chat_bubble_outline</span>
                                                            {task.comments}
                                                        </span>
                                                    )}
                                                    {task.actionIcon && (
                                                        <span className="kCardMeta">
                                                            <span className="material-symbols-outlined">{task.actionIcon}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add task placeholder */}
                                    <button className="addTaskBtn" onClick={() => setShowCreateTask(true)}>
                                        <span className="material-symbols-outlined">add</span>
                                        {t('project_detail.mytasks.add_task')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Bottom Stats Bar */}
            <div className="taskStatsBar">
                <div className="taskStatItem">
                    <span className="taskStatLabel">{t('project_detail.charts.velocity')}</span>
                    <span className="taskStatValue">84%</span>
                </div>
                <div className="taskStatDivider"></div>
                <div className="taskStatItem">
                    <span className="taskStatLabel">{t('project_detail.charts.mood')}</span>
                    <span className="taskStatValue" style={{ color: '#10b981' }}>{t('project_detail.charts.optimal')}</span>
                </div>
                <button className="taskStatAction">
                    <span className="material-symbols-outlined">trending_up</span>
                </button>
            </div>

            {showCreateTask && (
                <CreateTaskModal
                    onClose={() => setShowCreateTask(false)}
                    onSubmit={() => setShowCreateTask(false)}
                />
            )}
        </div>
    );
}
