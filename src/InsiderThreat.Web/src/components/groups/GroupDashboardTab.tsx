import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { App, Modal, Form, Input, Select, DatePicker, Button, Avatar, Progress, Typography, Row, Col, Space } from 'antd';
import { EditOutlined, TeamOutlined, PlusOutlined, DeleteOutlined, EllipsisOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { api } from '../../services/api';
import { authService } from '../../services/auth';
import TaskDetailDrawer from './TaskDetailDrawer';
import './GroupDashboardTab.css';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Option } = Select;

// --- Interfaces ---
interface Member {
    id: string;
    fullName: string;
    username: string;
    avatarUrl?: string;
    role?: string;
}

interface ProjectTask {
    id: string;
    title: string;
    description: string;
    status: 'Todo' | 'InProgress' | 'InReview' | 'WaitingApproval' | 'Done';
    priority: 'Low' | 'Medium' | 'High';
    assignedTo?: string;
    progress: number;
    startDate?: string;
    deadline?: string;
}

interface GroupInfo {
    id: string;
    name: string;
    description: string;
    adminIds?: string[];
}

interface GroupDashboardTabProps {
    onInviteClick?: () => void;
}

export default function GroupDashboardTab({ onInviteClick }: GroupDashboardTabProps = {}) {
    const { id: groupId } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { message } = App.useApp();
    const currentUser = authService.getCurrentUser();

    // Data States
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [loading, setLoading] = useState(true);

    // UI States
    const [taskDrawerVisible, setTaskDrawerVisible] = useState(false);
    const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
    const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
    const [taskForm] = Form.useForm();

    const currentUserIsAdmin = group?.adminIds?.includes(currentUser?.id || '') || false;

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    const fetchData = async () => {
        if (!groupId) return;
        try {
            setLoading(true);
            const [gRes, mRes, tRes] = await Promise.all([
                api.get<GroupInfo>(`/api/groups/${groupId}`),
                api.get<Member[]>(`/api/groups/${groupId}/members-details`),
                api.get<ProjectTask[]>(`/api/groups/${groupId}/tasks`)
            ]);
            setGroup(gRes);
            setMembers(mRes || []);
            setTasks(tRes || []);
        } catch (err) {
            console.error('Data sync failed', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTask = async (values: any) => {
        try {
            const taskData = {
                ...values,
                startDate: values.startDate?.toISOString(),
                deadline: values.deadline?.toISOString()
            };
            await api.post(`/api/groups/${groupId}/tasks`, taskData);
            message.success(t('project_detail.mytasks.add_success', { defaultValue: 'Đã tạo nhiệm vụ' }));
            setIsTaskModalVisible(false);
            taskForm.resetFields();
            fetchData();
        } catch (error) {
            message.error('Lỗi khi tạo nhiệm vụ');
        }
    };

    const openTaskDrawer = (task: ProjectTask) => {
        setSelectedTask(task);
        setTaskDrawerVisible(true);
    };

    // Derived Statistics
    const stats = useMemo(() => {
        let inProgress = 0;
        let done = 0;
        let assignedToMe = 0;
        
        tasks.forEach(t => {
            if (t.status === 'Done') done++;
            else if (t.status === 'InProgress') inProgress++;
            if (t.assignedTo === currentUser?.id) assignedToMe++;
        });

        return {
            totalTasks: tasks.length,
            inProgress,
            done,
            assignedToMe
        };
    }, [tasks, currentUser]);

    // Roadmap Mock Data (Could calculate dynamically from tasks)
    const roadmapData = [
        { label: 'Mon', value: 12 },
        { label: 'Tue', value: 18 },
        { label: 'Wed', value: 25 },
        { label: 'Thu', value: 10 },
        { label: 'Fri', value: 30 },
        { label: 'Sat', value: 5 },
        { label: 'Sun', value: 2 }
    ];

    if (loading) return <div className="loading-state">{t('library.loading')}</div>;

    return (
        <div className="synchro-dashboard-wrapper">
            
            <div className="dashboard-header-block">
                <div>
                    <Title level={4} style={{ margin: 0 }}>{t('project_detail.dashboard.overview')}</Title>
                    <Text type="secondary">{t('project_detail.dashboard.overview_subtitle')}</Text>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button icon={<TeamOutlined />} onClick={onInviteClick}>{t('project_detail.team.invite')}</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsTaskModalVisible(true)}>
                        {t('project_detail.dashboard.create_task')}
                    </Button>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <Text type="secondary">{t('project_detail.dashboard.total_projects')}</Text>
                    <Title level={2} style={{ margin: "4px 0" }}>1 (Current)</Title>
                    <Text type="success">+0%</Text>
                </div>
                <div className="stat-card">
                    <Text type="secondary">{t('project_detail.dashboard.active_tasks')}</Text>
                    <Title level={2} style={{ margin: "4px 0" }}>{stats.totalTasks}</Title>
                    <Text type="success">+12%</Text>
                </div>
                <div className="stat-card">
                    <Text type="secondary">{t('project_detail.dashboard.assigned_to_me')}</Text>
                    <Title level={2} style={{ margin: "4px 0" }}>{stats.assignedToMe}</Title>
                    <Text type="warning">Requires attention</Text>
                </div>
                <div className="stat-card">
                    <Text type="secondary">{t('project_detail.dashboard.completed')}</Text>
                    <Title level={2} style={{ margin: "4px 0" }}>{stats.done}</Title>
                    <Text type="success">Good pacing</Text>
                </div>
            </div>

            {/* Main Content Split: Left (Charts) / Right (Widgets) */}
            <div className="dashboard-main-split">
                
                <div className="dashboard-left-col">
                    <div className="chart-panel">
                        <div className="panel-header">
                            <Title level={5} style={{ margin: 0 }}>{t('project_detail.dashboard.roadmap')}</Title>
                            <Button type="text" icon={<EllipsisOutlined />} />
                        </div>
                        <div className="chart-container" style={{ height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={roadmapData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                    <Tooltip cursor={{ fill: '#f9fafb' }} />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {roadmapData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 2 ? '#111827' : '#e5e7eb'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="recent-activity-panel">
                        <div className="panel-header">
                            <Title level={5} style={{ margin: 0 }}>{t('project_detail.dashboard.recent_activity')}</Title>
                        </div>
                        <div className="recent-tasks-list">
                            {tasks.slice(0, 3).map(task => {
                                const assignee = members.find(m => m.id === task.assignedTo);
                                return (
                                    <div key={task.id} className="recent-task-row" onClick={() => openTaskDrawer(task)}>
                                        <div className="task-title-cell">
                                            <div className="task-indicator" style={{ background: task.status === 'Done' ? '#10b981' : task.status === 'WaitingApproval' ? '#f97316' : '#3b82f6'}} />
                                            <Text strong>{task.title}</Text>
                                        </div>
                                        <div className="task-assignee-cell">
                                            <Avatar src={assignee?.avatarUrl} size="small">{assignee?.fullName?.charAt(0)}</Avatar>
                                            <Text type="secondary" style={{ marginLeft: 8 }}>{assignee?.fullName || 'Unassigned'}</Text>
                                        </div>
                                        <div className="task-date-cell">
                                            <Text type="secondary">{task.deadline ? dayjs(task.deadline).format('MMM DD') : 'No deadline'}</Text>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="dashboard-right-col">
                    <div className="widget-panel">
                        <div className="panel-header">
                            <Title level={5} style={{ margin: 0 }}>{t('project_detail.dashboard.today_tasks')}</Title>
                            <a href="#">{t('project_detail.dashboard.see_all')}</a>
                        </div>
                        <div className="today-tasks-list">
                            {tasks.filter(t => t.status !== 'Done').slice(0, 5).map(task => {
                                const assignee = members.find(m => m.id === task.assignedTo);
                                return (
                                    <div key={task.id} className="today-task-card" onClick={() => openTaskDrawer(task)}>
                                        <div className="tt-header">
                                            <Text strong className="tt-title">{task.title}</Text>
                                            <Button type="text" icon={<EllipsisOutlined />} size="small" />
                                        </div>
                                        <div className="tt-meta">
                                            <Avatar.Group size={24}>
                                                <Avatar src={assignee?.avatarUrl} />
                                            </Avatar.Group>
                                            <span className={`status-pill ${task.status.toLowerCase()}`}>
                                                {task.status.replace(/([A-Z])/g, ' $1').trim()}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            {tasks.filter(t => t.status !== 'Done').length === 0 && (
                                <Text type="secondary">No active tasks today!</Text>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Task Drawer */}
            {selectedTask && (
                <TaskDetailDrawer
                    open={taskDrawerVisible}
                    onClose={() => setTaskDrawerVisible(false)}
                    task={selectedTask}
                    groupId={groupId || ''}
                    members={members}
                    onTaskUpdate={() => {
                        fetchData();
                    }}
                    currentUserIsAdmin={currentUserIsAdmin}
                />
            )}

            {/* Create Task Modal */}
            <Modal
                title={t('project_detail.dashboard.new_task_modal')}
                open={isTaskModalVisible}
                onCancel={() => setIsTaskModalVisible(false)}
                footer={null}
                destroyOnHidden
            >
                <Form form={taskForm} layout="vertical" onFinish={handleCreateTask}>
                    <Form.Item name="title" label={t('project_detail.dashboard.task_title')} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label={t('project_detail.dashboard.description')}>
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="assignedTo" label={t('project_detail.dashboard.assign_to')}>
                                <Select placeholder={t('staff.search_placeholder')} allowClear>
                                    {members.map(m => (
                                        <Option key={m.id} value={m.id}>{m.fullName}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="priority" label={t('project_detail.dashboard.priority')} initialValue="Medium">
                                <Select>
                                    <Option value="Low">Low</Option>
                                    <Option value="Medium">Medium</Option>
                                    <Option value="High">Urgent</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="startDate" label={t('project_detail.dashboard.start_date')}>
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="deadline" label={t('project_detail.dashboard.due_date')}>
                                <DatePicker style={{ width: '100%' }} showTime />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item className="m-0 text-right">
                        <Space>
                            <Button onClick={() => setIsTaskModalVisible(false)}>{t('project_detail.dashboard.btn_cancel')}</Button>
                            <Button type="primary" htmlType="submit">{t('project_detail.dashboard.create_task')}</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
