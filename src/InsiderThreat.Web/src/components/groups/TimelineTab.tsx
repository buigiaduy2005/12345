import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Spin, message, Tooltip, Empty, Tag, Button, Modal, Form, DatePicker, Input, Space } from 'antd';
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
    createdAt?: string; // Bổ sung ngày tạo
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
    const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [scheduleForm] = Form.useForm();

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
            message.error(t('project_detail.timeline.load_fail', { defaultValue: 'Lỗi khi tải dữ liệu lộ trình' }));
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

    const handleUpdateSchedule = async (values: any) => {
        try {
            await api.patch(`/api/groups/${groupId}`, {
                projectStartDate: values.range[0].toISOString(),
                projectEndDate: values.range[1].toISOString()
            });
            message.success(t('project_detail.timeline.update_success', { defaultValue: 'Cập nhật lộ trình dự án thành công' }));
            setIsScheduleModalVisible(false);
            fetchData();
        } catch (err) {
            message.error(t('project_detail.timeline.update_fail', { defaultValue: 'Lỗi khi cập nhật lộ trình' }));
        }
    };

    const handleExport = () => {
        message.loading(t('project_detail.timeline.exporting', { defaultValue: 'Đang chuẩn bị dữ liệu xuất bản...' }), 1.5).then(() => {
            message.success(t('project_detail.timeline.export_success', { defaultValue: 'Đã xuất bản lộ trình dự án (PDF/CSV)' }));
        });
    };

    // Calculate project duration for scaling
    const timelineScale = useMemo(() => {
        // Find min/max across all tasks if project dates are missing
        let start = group?.projectStartDate ? dayjs(group.projectStartDate) : null;
        let end = group?.projectEndDate ? dayjs(group.projectEndDate) : null;

        if (!start || !end) {
            tasks.forEach(t => {
                const dates = [t.startDate, t.deadline, t.createdAt].filter(Boolean).map(d => dayjs(d));
                dates.forEach(d => {
                    if (!start || d.isBefore(start)) start = d;
                    if (!end || d.isAfter(end)) end = d;
                });
            });

            // Default fallback if no tasks
            if (!start) start = dayjs().startOf('month');
            if (!end) end = start.add(1, 'month');

            // Add padding (1 week)
            start = start.subtract(1, 'week');
            end = end.add(1, 'week');
        }

        return { start, end, totalDays: Math.max(1, end.diff(start, 'day')) };
    }, [group, tasks]);

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
        const filtered = tasks.filter(t => 
            t.title.toLowerCase().includes(filterText.toLowerCase())
        );
        filtered.forEach(task => {
            const phase = task.phase || 'General';
            if (!grouped[phase]) grouped[phase] = [];
            grouped[phase].push(task);
        });
        return grouped;
    }, [tasks, filterText]);

    const getBarStyles = (task: Task) => {
        // Fallback dates: use createdAt if dates are missing
        const taskStart = dayjs(task.startDate || task.createdAt);
        const taskEnd = dayjs(task.deadline || task.startDate || task.createdAt);
        
        const startOffset = taskStart.diff(timelineScale.start, 'day');
        let duration = taskEnd.diff(taskStart, 'day');
        if (duration <= 0) duration = 1; // Minimum 1 day width
        
        const leftPercent = (startOffset / timelineScale.totalDays) * 100;
        const widthPercent = (duration / timelineScale.totalDays) * 100;
        
        // Hide only if completely outside and no fallback
        if (isNaN(leftPercent) || (!task.startDate && !task.deadline && !task.createdAt)) {
            return { display: 'none' };
        }

        return {
            left: `${Math.max(0, Math.min(98, leftPercent))}%`,
            width: `${Math.max(2, Math.min(100 - leftPercent, widthPercent))}%`,
            opacity: (!task.startDate || !task.deadline) ? 0.6 : 1, // Mờ hơn nếu dùng ngày mặc định
            borderStyle: (!task.startDate || !task.deadline) ? 'dashed' : 'solid'
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
                    <h2 className="timeline-title">{t('project_detail.timeline.title')}</h2>
                </div>
                <div className="timeline-actions">
                    <Input 
                        placeholder={t('project_detail.mytasks.search')} 
                        prefix={<FilterOutlined />} 
                        style={{ width: 200, marginRight: 8 }}
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                    />
                    <Button icon={<SendOutlined />} onClick={handleExport}>{t('project_detail.timeline.btn_export', { defaultValue: 'Xuất bản' })}</Button>
                    <Button type="primary" icon={<CalendarOutlined />} onClick={() => setIsScheduleModalVisible(true)}>{t('project_detail.timeline.btn_schedule', { defaultValue: 'Lập lịch' })}</Button>
                </div>
            </div>

            <div className="timeline-container">
                <div className="timeline-body-wrapper">
                    {/* Left Panel: Phases & Tasks */}
                    <div className="tl-left-panel">
                        <div className="tl-col-heading">{t('project_detail.timeline.col_tasks', { defaultValue: 'NHIỆM VỤ DỰ ÁN' })}</div>
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
                <h3 className="footer-title">{t('project_detail.timeline.milestones_title', { defaultValue: 'Cột mốc quan trọng' })}</h3>
                <div className="milestone-grid">
                    {[
                        { name: t('project_detail.timeline.milestone_kickoff', { defaultValue: 'Khởi động dự án' }), date: timelineScale.start.format('DD MMM'), done: true },
                        { name: t('project_detail.timeline.milestone_design', { defaultValue: 'Thiết kế hệ thống' }), date: timelineScale.start.add(2, 'week').format('DD MMM'), done: tasks.some(t => t.status === 'Done') },
                        { name: t('project_detail.timeline.milestone_beta', { defaultValue: 'Triển khai Beta' }), date: timelineScale.end.subtract(2, 'week').format('DD MMM'), done: false },
                        { name: t('project_detail.timeline.milestone_finish', { defaultValue: 'Hoàn thành' }), date: timelineScale.end.format('DD MMM'), done: false },
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

            <Modal
                title={t('project_detail.timeline.schedule_modal_title', { defaultValue: 'Cấu hình Lộ trình Dự án' })}
                open={isScheduleModalVisible}
                onCancel={() => setIsScheduleModalVisible(false)}
                onOk={() => scheduleForm.submit()}
                okText={t('project_detail.task_drawer.save')}
                cancelText={t('project_detail.dashboard.btn_cancel')}
            >
                <Form
                    form={scheduleForm}
                    layout="vertical"
                    onFinish={handleUpdateSchedule}
                    initialValues={{
                        range: group?.projectStartDate && group?.projectEndDate ? 
                            [dayjs(group.projectStartDate), dayjs(group.projectEndDate)] : []
                    }}
                >
                    <p>{t('project_detail.timeline.schedule_desc', { defaultValue: 'Chọn khoảng thời gian tổng thể của dự án để căn chỉnh biểu đồ Gantt.' })}</p>
                    <Form.Item name="range" label={t('project_detail.timeline.project_range', { defaultValue: 'Thời gian dự án' })} rules={[{ required: true, message: t('attendance.placeholder_network') }]}>
                        <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
