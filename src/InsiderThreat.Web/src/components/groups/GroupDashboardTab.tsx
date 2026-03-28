import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { App, Modal, DatePicker, Form, Input, Button, Progress, Tag, Space, Avatar, Tooltip, Drawer, Divider, List, Upload, Badge, Card, Row, Col, Empty, Select, Typography } from 'antd';
import { 
    EditOutlined, TeamOutlined, CalendarOutlined, CheckCircleOutlined, 
    ClockCircleOutlined, HeartOutlined, MessageOutlined, FileTextOutlined, 
    PlusOutlined, FileZipOutlined, FileExcelOutlined, FilePdfOutlined, 
    FileWordOutlined, RocketOutlined, SafetyCertificateOutlined, SendOutlined,
    PaperClipOutlined, DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { api } from '../../services/api';
import './GroupDashboardTab.css';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip as ChartTooltip, PieChart, Pie, Cell 
} from 'recharts';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ─── TYPES ───────────────────────────────────────────────────────────────────

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
    status: 'Todo' | 'InProgress' | 'InReview' | 'Done';
    priority: 'Low' | 'Medium' | 'High';
    assignedTo?: string;
    dueDate?: string;
    createdAt?: string;
    completedAt?: string;
    attachments?: any[];
    comments?: any[];
}

interface GroupInfo {
    id: string;
    name: string;
    description: string;
    projectStartDate?: string;
    projectEndDate?: string;
}

interface ProjectFile {
    id: string;
    fileId: string;
    fileName: string;
    contentType: string;
    size: number;
    uploadedAt: string;
}

// ─── HELPER COMPONENTS ──────────────────────────────────────────────────────

const FileIcon = ({ type }: { type: string }) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('pdf')) return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
    if (t.includes('word') || t.includes('officedocument.wordprocessingml')) return <FileWordOutlined style={{ color: '#1890ff' }} />;
    if (t.includes('excel') || t.includes('sheet')) return <FileExcelOutlined style={{ color: '#52c41a' }} />;
    if (t.includes('zip') || t.includes('rar') || t.includes('compressed')) return <FileZipOutlined style={{ color: '#722ed1' }} />;
    if (t.includes('exe') || t.includes('x-msdownload')) return <SafetyCertificateOutlined style={{ color: '#faad14' }} />;
    return <FileTextOutlined style={{ color: '#8c8c8c' }} />;
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function GroupDashboardTab() {
    const { id: groupId } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { message } = App.useApp();
    
    // UI States
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
    const [availableUsers, setAvailableUsers] = useState<Member[]>([]);
    
    const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
    const [taskDrawerVisible, setTaskDrawerVisible] = useState(false);
    const [isMemberModalVisible, setIsMemberModalVisible] = useState(false);
    const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    
    const [commentText, setCommentText] = useState('');
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    
    const [taskForm] = Form.useForm();
    const [memberForm] = Form.useForm();

    const fetchData = async () => {
        if (!groupId) return;
        try {
            setLoading(true);
            const [gRes, mRes, tRes, fRes] = await Promise.all([
                api.get<GroupInfo>(`/api/groups/${groupId}`),
                api.get<Member[]>(`/api/groups/${groupId}/members-details`),
                api.get<ProjectTask[]>(`/api/groups/${groupId}/tasks`),
                api.get<ProjectFile[]>(`/api/groups/${groupId}/files`).catch(() => [])
            ]);
            setGroup(gRes);
            setMembers(mRes || []);
            setTasks(tRes || []);
            setProjectFiles(fRes || []);
        } catch (err) {
            console.error('Data sync failed', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        
        // Theme Observer
        const observer = new MutationObserver(() => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        };
    }, [groupId]);

    // Theme-based colors for charts
    const chartTheme = useMemo(() => ({
        text: isDarkMode ? '#94a3b8' : '#64748b',
        grid: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        tooltipBg: isDarkMode ? '#1e1e1e' : '#ffffff',
        tooltipBorder: isDarkMode ? '#333' : '#e2e8f0'
    }), [isDarkMode]);

    // ─── CHART CALCULATIONS ──────────────────────────────────────────────────
    const performanceData = useMemo(() => {
        const days = 7;
        const data = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = dayjs().subtract(i, 'day');
            const completedOnDay = tasks.filter(t => 
                t.status === 'Done' && 
                t.completedAt && 
                dayjs(t.completedAt).isSame(date, 'day')
            ).length;
            data.push({
                name: date.format('DD/MM'),
                completed: completedOnDay
            });
        }
        return data;
    }, [tasks]);

    const statusPieData = useMemo(() => {
        const todo = tasks.filter(t => t.status === 'Todo').length;
        const inProgress = tasks.filter(t => t.status === 'InProgress').length;
        const inReview = tasks.filter(t => t.status === 'InReview').length;
        const done = tasks.filter(t => t.status === 'Done').length;
        return [
            { name: 'Chờ làm', value: todo, color: '#8b949e' },
            { name: 'Đang làm', value: inProgress, color: '#1890ff' },
            { name: 'Đang xem xét', value: inReview, color: '#faad14' },
            { name: 'Hoàn thành', value: done, color: '#52c41a' },
        ];
    }, [tasks]);

    // ─── ACTION HANDLERS ─────────────────────────────────────────────────────

    const fetchAvailableUsers = async () => {
        try {
            const users = await api.get<Member[]>('/api/SocialFeed/users');
            const existingIds = (members || []).map(m => m.id);
            setAvailableUsers((users || []).filter(u => !existingIds.includes(u.id)));
        } catch (err) { message.error('Không thể tải danh sách người dùng'); }
    };

    const handleAddMember = async (values: any) => {
        try {
            await api.post(`/api/groups/${groupId}/members`, { userId: values.userId });
            message.success('Đã thêm thành viên');
            setIsMemberModalVisible(false);
            fetchData();
        } catch (err) { message.error('Lỗi khi thêm thành viên'); }
    };

    const handleCreateTask = async (values: any) => {
        try {
            await api.post(`/api/groups/${groupId}/tasks`, {
                ...values,
                status: 'Todo',
                dueDate: values.dueDate?.toISOString()
            });
            message.success('Đã tạo nhiệm vụ');
            setIsTaskModalVisible(false);
            taskForm.resetFields();
            fetchData();
        } catch (err) { message.error('Lỗi khi tạo nhiệm vụ'); }
    };

    const handleFileUpload = async (options: any) => {
        const { file, onSuccess, onError } = options;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post<any>('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            await api.post(`/api/groups/${groupId}/files`, {
                fileId: res.fileId,
                fileName: res.fileName,
                contentType: res.contentType,
                size: res.size
            });

            message.success(`Đã lưu tài liệu: ${file.name}`);
            fetchData();
            onSuccess("Ok");
        } catch (err) {
            message.error('Tải lên thất bại');
            onError(err);
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = (fileId: string) => {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5038';
        window.open(`${baseUrl}/api/upload/${fileId}`, '_blank');
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const projectProgress = useMemo(() => {
        if (!tasks || tasks.length === 0) return 0;
        const done = tasks.filter(t => t.status === 'Done').length;
        return Math.round((done / tasks.length) * 100);
    }, [tasks]);

    if (!group) return (
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#1890ff' }}>
            <RocketOutlined spin style={{ fontSize: 24, marginRight: 12 }} />
            <span>Đang đồng bộ dữ liệu...</span>
        </div>
    );

    return (
        <div className="futuristic-dashboard animate-in">
            <Row gutter={[20, 20]}>
                
                {/* 🛰️ LEFT: TEAM PANEL */}
                <Col xs={24} lg={6}>
                    <Card 
                        className="glass-panel team-panel" 
                        title={<Space><TeamOutlined /> {t('groups.team_title', 'Đội ngũ dự án')}</Space>} 
                        extra={<PlusOutlined className="icon-btn" onClick={() => { fetchAvailableUsers(); setIsMemberModalVisible(true); }} />}
                    >
                        <List
                            dataSource={members}
                            renderItem={m => (
                                <List.Item className="member-item">
                                    <List.Item.Meta
                                        avatar={<Avatar src={m.avatarUrl} className="glowing-avatar" />}
                                        title={<span className="text-bright">{m.fullName}</span>}
                                        description={<Tag color="blue" style={{ fontSize: 10 }}>{m.role || 'Contributor'}</Tag>}
                                    />
                                    <Badge status="processing" color="#52c41a" />
                                </List.Item>
                            )}
                        />
                        <Divider style={{ margin: '12px 0' }} />
                        <Button block icon={<MessageOutlined />} className="glass-btn">Mở Chat Nhóm</Button>
                        
                        <div style={{ marginTop: 24 }}>
                            <Title level={5} className="text-bright">Thống kê trạng thái</Title>
                            <div style={{ height: 200 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statusPieData}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {statusPieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <ChartTooltip 
                                            contentStyle={{ 
                                                background: chartTheme.tooltipBg, 
                                                border: `1px solid ${chartTheme.tooltipBorder}`, 
                                                borderRadius: 8 
                                            }}
                                            itemStyle={{ color: isDarkMode ? '#58a6ff' : '#2563eb' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {statusPieData.map(item => (
                                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                                        <Text type="secondary">{item.name}: {item.value}</Text>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                </Col>

                {/* 🚀 CENTER: MISSION CONTROL */}
                <Col xs={24} lg={12}>
                    <Card className="glass-panel status-card-hero">
                        <div className="phase-header">
                            <div>
                                <Title level={4} className="text-bright">Hiệu suất nhiệm vụ</Title>
                                <Text type="secondary">Nhiệm vụ hoàn thành trong 7 ngày qua</Text>
                            </div>
                            <RocketOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                        </div>
                        
                        <div style={{ height: 200, width: '100%', marginTop: 20 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={performanceData}>
                                    <defs>
                                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#1890ff" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTheme.text, fontSize: 12 }} />
                                    <YAxis hide />
                                    <ChartTooltip 
                                        contentStyle={{ 
                                            background: chartTheme.tooltipBg, 
                                            border: `1px solid ${chartTheme.tooltipBorder}`, 
                                            borderRadius: 8 
                                        }}
                                        itemStyle={{ color: isDarkMode ? '#58a6ff' : '#2563eb' }}
                                    />
                                    <Area type="monotone" dataKey="completed" stroke="#1890ff" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <div className="task-canvas-header">
                        <Title level={4} className="text-bright">Nhiệm vụ chiến lược</Title>
                        <Button type="primary" shape="round" icon={<PlusOutlined />} onClick={() => setIsTaskModalVisible(true)}>Thêm Task</Button>
                    </div>

                    <div className="task-grid">
                        {(!tasks || tasks.length === 0) ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có nhiệm vụ nào" /> : (
                            tasks.slice(0, 6).map(task => (
                                <Card key={task.id} className={`task-card ${task.status?.toLowerCase()}`} onClick={() => { setSelectedTask(task); setTaskDrawerVisible(true); }}>
                                    <div className="task-card-header">
                                        <Tag color={task.priority === 'High' ? 'red' : task.priority === 'Medium' ? 'orange' : 'blue'}>{task.priority}</Tag>
                                        <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(task.dueDate).format('DD MMM')}</Text>
                                    </div>
                                    <Text strong className="task-title text-bright">{task.title}</Text>
                                    <p className="task-desc">{task.description}</p>
                                    <div className="task-card-footer">
                                        <Avatar size="small" src={`https://ui-avatars.com/api/?name=${task.assignedTo || 'U'}`} />
                                        <Space>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: task.status === 'Done' ? '#52c41a' : '#1890ff' }} />
                                                <Text type="secondary" style={{ fontSize: 10 }}>{task.status}</Text>
                                            </div>
                                        </Space>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </Col>

                {/* 🔒 RIGHT: DIGITAL VAULT & PROGRESS */}
                <Col xs={24} lg={6}>
                    <Card className="glass-panel" style={{ marginBottom: 20 }}>
                        <Title level={5} className="text-bright">Tiến độ tổng thể</Title>
                        <div style={{ textAlign: 'center', margin: '20px 0' }}>
                            <Progress 
                                type="dashboard" 
                                percent={projectProgress} 
                                strokeColor={{ '0%': '#10b981', '100%': '#3b82f6' }}
                                trailColor="rgba(255,255,255,0.05)"
                            />
                        </div>
                        <div className="milestones-row" style={{ marginTop: 0 }}>
                            <div className={`milestone ${projectProgress >= 0 ? 'active' : ''}`}><span>Bắt đầu</span></div>
                            <div className={`milestone ${projectProgress > 50 ? 'active' : ''}`}><span>Giữ kỳ</span></div>
                            <div className={`milestone ${projectProgress === 100 ? 'active' : ''}`}><span>Về đích</span></div>
                        </div>
                    </Card>

                    <Card className="glass-panel vault-panel" title={<Space><SafetyCertificateOutlined /> Kho tài liệu mật</Space>}>
                        <div className="upload-zone-mini">
                            <Upload.Dragger customRequest={handleFileUpload} showUploadList={false} disabled={uploading}>
                                {uploading ? <RocketOutlined spin style={{ color: '#1890ff' }} /> : <PlusOutlined />}
                                <p style={{ fontSize: 12, margin: 0 }}>{uploading ? 'Đang mã hoá...' : 'Thả file bảo mật'}</p>
                            </Upload.Dragger>
                        </div>
                        
                        <div className="vault-list" style={{ marginTop: 20 }}>
                            {(!projectFiles || projectFiles.length === 0) ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                                projectFiles.slice(0, 5).map(file => (
                                    <div className="vault-item" key={file.id}>
                                        <FileIcon type={file.contentType} />
                                        <div className="file-info">
                                            <Text strong className="text-bright" style={{ fontSize: 11 }} ellipsis>{file.fileName}</Text>
                                            <Text type="secondary" style={{ fontSize: 9 }}>{formatSize(file.size)} • {dayjs(file.uploadedAt).fromNow()}</Text>
                                        </div>
                                        <DownloadOutlined className="icon-btn" onClick={(e) => { e.stopPropagation(); handleDownload(file.fileId); }} />
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* 🛰️ TASK SIDE DRAWER */}
            <Drawer
                title={<Space><RocketOutlined /> Chi tiết nhiệm vụ</Space>}
                width={isMobile ? '100%' : 500}
                onClose={() => setTaskDrawerVisible(false)}
                open={taskDrawerVisible}
                className="futuristic-drawer"
            >
                {selectedTask && (
                    <div className="drawer-content">
                        <Title level={3} className="text-bright">{selectedTask.title}</Title>
                        <Tag color="processing">{selectedTask.status}</Tag>
                        <Divider />
                        <Title level={5} className="text-bright">Mô tả</Title>
                        <p className="text-soft">{selectedTask.description}</p>
                        
                        <Divider />
                        <Title level={5} className="text-bright"><MessageOutlined /> Thảo luận nhiệm vụ</Title>
                        <div className="task-chat-box">
                            <Empty description="Chưa có thảo luận" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        </div>
                        <Input 
                            placeholder="Nhập phản hồi..." 
                            suffix={<SendOutlined onClick={() => message.success('Đã gửi phản hồi')} />}
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                        />
                    </div>
                )}
            </Drawer>

            {/* MODALS */}
            <Modal title="Thêm thành viên" open={isMemberModalVisible} onCancel={() => setIsMemberModalVisible(false)} footer={null}>
                <Form form={memberForm} layout="vertical" onFinish={handleAddMember}>
                    <Form.Item name="userId" label="Chọn người dùng" rules={[{ required: true }]}>
                        <Select showSearch placeholder="Nhập tên">
                            {availableUsers.map(u => (
                                <Select.Option key={u.id} value={u.id}>{u.fullName}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Button type="primary" block htmlType="submit">Xác nhận</Button>
                </Form>
            </Modal>

            <Modal title="Tạo nhiệm vụ" open={isTaskModalVisible} onCancel={() => setIsTaskModalVisible(false)} footer={null}>
                <Form form={taskForm} layout="vertical" onFinish={handleCreateTask} initialValues={{ priority: 'Medium' }}>
                    <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="description" label="Mô tả"><Input.TextArea /></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="priority" label="Ưu tiên">
                                <Select>
                                    <Select.Option value="High">Cao</Select.Option>
                                    <Select.Option value="Medium">Trung bình</Select.Option>
                                    <Select.Option value="Low">Thấp</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}><Form.Item name="dueDate" label="Hạn chót"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                    </Row>
                    <Form.Item name="assignedTo" label="Người thực hiện">
                        <Select placeholder="Chọn thành viên">
                            {members.map(m => <Select.Option key={m.id} value={m.fullName}>{m.fullName}</Select.Option>)}
                        </Select>
                    </Form.Item>
                    <Button type="primary" block htmlType="submit">Khởi tạo</Button>
                </Form>
            </Modal>
        </div>
    );
}
