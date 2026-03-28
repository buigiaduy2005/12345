import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Spin, message, Tooltip, Empty, Tag, Button } from 'antd';
import { 
    CalendarOutlined, FilterOutlined, SendOutlined, 
    MoreOutlined, CheckCircleOutlined, RightOutlined, DownOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../services/api';
import './TimelineTab.css';

interface Task {
    id: string;
    title: string;
    status: string;
    phase?: string;
    startDate?: string;
    deadline?: string;
    progress: number;
}

interface GroupInfo {
    id: string;
    name: string;
    projectStartDate?: string;
    projectEndDate?: string;
}

export default function TimelineTab() {
    const { id: groupId } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tasksRes, groupRes] = await Promise.all([
                api.get<Task[]>(`/api/groups/${groupId}/tasks`),
                api.get<GroupInfo>(`/api/groups/${groupId}`)
            ]);
            setTasks(tasksRes);
            setGroup(groupRes);
            
            // Auto-expand all phases initially
            const phases = Array.from(new Set(tasksRes.map(t => t.phase || 'General')));
            const initialExpanded: Record<string, boolean> = {};
            phases.forEach(p => initialExpanded[p] = true);
            setExpandedPhases(initialExpanded);
        } catch (err) {
            message.error('Lỗi khi tải dữ liệu lộ trình');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (groupId) fetchData();
    }, [groupId]);

    const togglePhase = (phase: string) => {
        setExpandedPhases(prev => ({ ...prev, [phase]: !prev[phase] }));
    };

    // Calculate project duration for scaling
    const timelineScale = useMemo(() => {
        if (!group?.projectStartDate || !group?.projectEndDate) {
            // Default scale if no dates: 30 days from project creation or today
            const start = dayjs().startOf('month');
            const end = start.add(2, 'month');
            return { start, end, totalDays: end.diff(start, 'day') };
        }
        const start = dayjs(group.projectStartDate);
        const end = dayjs(group.projectEndDate);
        return { start, end, totalDays: end.diff(start, 'day') || 30 };
    }, [group]);

    const weeksLabels = useMemo(() => {
        const labels = [];
        let current = timelineScale.start;
        while (current.isBefore(timelineScale.end)) {
            labels.push(current.format('MMM DD'));
            current = current.add(1, 'week');
        }
        return labels;
    }, [timelineScale]);

    const tasksByPhase = useMemo(() => {
        const grouped: Record<string, Task[]> = {};
        tasks.forEach(task => {
            const phase = task.phase || 'General';
            if (!grouped[phase]) grouped[phase] = [];
            grouped[phase].push(task);
        });
        return grouped;
    }, [tasks]);

    const getBarStyles = (task: Task) => {
        if (!task.startDate || !task.deadline) return { left: '0%', width: '0%', display: 'none' };
        
        const taskStart = dayjs(task.startDate);
        const taskEnd = dayjs(task.deadline);
        
        const startOffset = taskStart.diff(timelineScale.start, 'day');
        const duration = taskEnd.diff(taskStart, 'day') || 1;
        
        const leftPercent = Math.max(0, (startOffset / timelineScale.totalDays) * 100);
        const widthPercent = Math.min(100 - leftPercent, (duration / timelineScale.totalDays) * 100);
        
        return {
            left: `${leftPercent}%`,
            width: `${Math.max(2, widthPercent)}%`
        };
    };

    const getStatusColor = (status: string) => {
        switch(status?.toLowerCase()) {
            case 'done': return '#10b981';
            case 'inprogress': return '#3b82f6';
            case 'inreview': return '#faad14';
            default: return '#30363d';
        }
    };

    if (loading) return <div className="loading-tasks"><Spin size="large" /></div>;

    return (
        <div className="timelineTab animate-in">
            <div className="timeline-header">
                <div className="header-info">
                    <Tag color="blue" className="glass-tag">Q3 Roadmap</Tag>
                    <h2 className="timeline-title">Lộ trình và Kế hoạch Dự án</h2>
                </div>
                <div className="timeline-actions">
                    <Button icon={<FilterOutlined />}>Bộ lọc</Button>
                    <Button icon={<SendOutlined />}>Xuất bản</Button>
                    <Button type="primary" icon={<CalendarOutlined />}>Lập lịch</Button>
                </div>
            </div>

            <div className="timeline-container">
                <div className="timeline-body-wrapper">
                    {/* Left Panel: Phases & Tasks */}
                    <div className="tl-left-panel">
                        <div className="tl-col-heading">NHIỆM VỤ DỰ ÁN</div>
                        {Object.entries(tasksByPhase).map(([phase, phaseTasks]) => (
                            <div key={phase} className="tl-phase-group">
                                <div className="tl-phase-header" onClick={() => togglePhase(phase)}>
                                    {expandedPhases[phase] ? <DownOutlined /> : <RightOutlined />}
                                    <span className="phase-name">{phase}</span>
                                </div>
                                {expandedPhases[phase] && phaseTasks.map(t => (
                                    <div key={t.id} className="tl-task-item">
                                        <span className="task-dot" style={{ background: getStatusColor(t.status) }} />
                                        <span className="task-name">{t.title}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Right Panel: Gantt View */}
                    <div className="tl-gantt-panel">
                        <div className="tl-time-header">
                            {weeksLabels.map(label => (
                                <div key={label} className="tl-time-col">{label}</div>
                            ))}
                        </div>

                        <div className="tl-gantt-content">
                            {Object.entries(tasksByPhase).map(([phase, phaseTasks]) => (
                                <div key={phase + '-gantt'} className="tl-phase-track">
                                    <div className="tl-phase-empty-row" />
                                    {expandedPhases[phase] && phaseTasks.map(t => (
                                        <div key={t.id + '-bar'} className="tl-bar-row">
                                            <div className="tl-bar-container">
                                                <Tooltip title={`${t.title}: ${t.progress}% | ${dayjs(t.startDate).format('DD/MM')} - ${dayjs(t.deadline).format('DD/MM')}`}>
                                                    <div className="tl-task-bar" style={{
                                                        ...getBarStyles(t),
                                                        background: getStatusColor(t.status),
                                                        borderColor: getStatusColor(t.status)
                                                    }}>
                                                        {t.progress > 0 && <div className="tl-bar-progress" style={{ width: `${t.progress}%` }} />}
                                                        <span className="tl-bar-label">{t.progress}%</span>
                                                    </div>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Milestones */}
            <div className="tl-milestones-footer">
                <h3 className="footer-title">Cột mốc quan trọng</h3>
                <div className="milestone-grid">
                    {[
                        { name: 'Khởi động dự án', date: timelineScale.start.format('DD MMM'), done: true },
                        { name: 'Thiết kế hệ thống', date: timelineScale.start.add(2, 'week').format('DD MMM'), done: tasks.some(t => t.status === 'Done') },
                        { name: 'Triển khai Beta', date: timelineScale.end.subtract(2, 'week').format('DD MMM'), done: false },
                        { name: 'Hoàn thành', date: timelineScale.end.format('DD MMM'), done: false },
                    ].map((m, i) => (
                        <div key={i} className={`milestone-card ${m.done ? 'is-done' : ''}`}>
                            <CheckCircleOutlined className="m-icon" />
                            <div className="m-info">
                                <div className="m-name">{m.name}</div>
                                <div className="m-date">{m.date}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
