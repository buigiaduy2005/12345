import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { App, Modal, DatePicker, Form, Input, Button, Progress, Tag, Space, Avatar, Tooltip, Drawer, Divider, List, Upload, Badge, Card, Row, Col, Empty, Select, Typography } from 'antd';
import { 
    EditOutlined, TeamOutlined, CalendarOutlined, CheckCircleOutlined, 
    ClockCircleOutlined, HeartOutlined, MessageOutlined, FileTextOutlined, 
    PlusOutlined, FileZipOutlined, FileExcelOutlined, FilePdfOutlined, 
    FileWordOutlined, RocketOutlined, SafetyCertificateOutlined, SendOutlined,
    PaperClipOutlined, DownloadOutlined, DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { api } from '../../services/api';
import './GroupDashboardTab.css';
import ProjectAnalyticsModal from './ProjectAnalyticsModal';

// Kích hoạt tính năng fromNow cho dayjs
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
    startDate?: string;
    deadline?: string;
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
    const [isAnalyticsVisible, setIsAnalyticsVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
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
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [groupId]);

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
            const taskData = {
                ...values,
                status: values.status || (isEditing ? selectedTask?.status : 'Todo'),
                startDate: values.startDate?.toISOString(),
                deadline: values.deadline?.toISOString()
            };

            if (isEditing && selectedTask) {
                await api.patch(`/api/groups/${groupId}/tasks/${selectedTask.id}`, taskData);
                message.success('Đã cập nhật nhiệm vụ');
            } else {
                await api.post(`/api/groups/${groupId}/tasks`, taskData);
                message.success('Đã tạo nhiệm vụ thành công');
            }

            setIsTaskModalVisible(false);
            setIsEditing(false);
            taskForm.resetFields();
            fetchData();
            
            // Nếu đang sửa thì đóng drawer và mở lại hoặc cập nhật selectedTask
            if (isEditing) {
                setTaskDrawerVisible(false);
                setSelectedTask(null);
            }
        } catch (err: any) { 
            console.error('Task action failed:', err.response?.data);
            message.error('Lỗi: ' + (err.response?.data?.message || 'Yêu cầu không hợp lệ')); 
        }
    };

    const handleOpenEdit = () => {
        if (!selectedTask) return;
        setIsEditing(true);
        taskForm.setFieldsValue({
            title: selectedTask.title,
            description: selectedTask.description,
            priority: selectedTask.priority,
            assignedTo: selectedTask.assignedTo,
            startDate: selectedTask.startDate ? dayjs(selectedTask.startDate) : null,
            deadline: selectedTask.deadline ? dayjs(selectedTask.deadline) : null,
        });
        setIsTaskModalVisible(true);
    };

    const handleDeleteTask = (taskId: string) => {
        Modal.confirm({
            title: 'Xác nhận xóa nhiệm vụ?',
            icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
            content: 'Nhiệm vụ này sẽ bị xóa vĩnh viễn và không thể khôi phục.',
            okText: 'Xác nhận xóa',
            okType: 'danger',
            cancelText: 'Hủy bỏ',
            onOk: async () => {
                try {
                    await api.delete(`/api/groups/${groupId}/tasks/${taskId}`);
                    message.success('Đã xóa nhiệm vụ');
                    setTaskDrawerVisible(false);
                    fetchData();
                } catch (err) {
                    message.error('Lỗi khi xóa nhiệm vụ');
                }
            }
        });
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
                        {/* FIX: Thay List bằng .map để tránh cảnh báo Deprecated */}
                        <div className="custom-member-list">
                            {members.map(m => (
                                <div className="member-item-new" key={m.id}>
                                    <Avatar src={m.avatarUrl} className="glowing-avatar" />
                                    <div className="member-info-new">
                                        <div className="text-bright">{m.fullName}</div>
                                        <Tag color="blue" style={{ fontSize: 9 }}>{m.role || 'Contributor'}</Tag>
                                    </div>
                                    <Badge status="processing" color="#52c41a" />
                                </div>
                            ))}
                        </div>
                        <Divider style={{ margin: '12px 0' }} />
                        <Button block icon={<MessageOutlined />} className="glass-btn">Mở Chat Nhóm</Button>
                    </Card>
                </Col>

                {/* 🚀 CENTER: MISSION CONTROL */}
                <Col xs={24} lg={12}>
                    <Card className="glass-panel phase-panel">
                        <div className="phase-header">
                            <div>
                                <Title level={4} className="text-bright">Giai đoạn thực thi</Title>
                                <Text type="secondary">Tiến độ tổng thể: {projectProgress}%</Text>
                            </div>
                            <RocketOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                        </div>
                        <Progress percent={projectProgress} status="active" strokeColor={{ '0%': '#10b981', '100%': '#3b82f6' }} />
                        
                        <div className="milestones-row">
                            <div className={`milestone ${projectProgress >= 0 ? 'active' : ''}`}><span>Khởi tạo</span></div>
                            <div className={`milestone ${projectProgress > 25 ? 'active' : ''}`}><span>Thực thi</span></div>
                            <div className={`milestone ${projectProgress > 75 ? 'active' : ''}`}><span>Kiểm thử</span></div>
                            <div className={`milestone ${projectProgress === 100 ? 'active' : ''}`}><span>Bàn giao</span></div>
                        </div>
                    </Card>

                    <div className="task-canvas-header">
                        <Title level={4} className="text-bright">Nhiệm vụ chiến lược</Title>
                        <Space>
                            <Button 
                                icon={<RocketOutlined />} 
                                className="glass-btn"
                                onClick={() => setIsAnalyticsVisible(true)}
                            >
                                Phân tích Trí tuệ
                            </Button>
                            <Button 
                                type="primary" 
                                shape="round" 
                                icon={<PlusOutlined />} 
                                onClick={() => { 
                                    setIsEditing(false); 
                                    taskForm.resetFields(); 
                                    setIsTaskModalVisible(true); 
                                }}
                            >
                                Thêm Task
                            </Button>
                        </Space>
                    </div>

                    <div className="task-grid">
                        {(!tasks || tasks.length === 0) ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có nhiệm vụ nào" /> : (
                            tasks.map(task => (
                                <Card key={task.id} className={`task-card ${task.status?.toLowerCase()}`} onClick={() => { setSelectedTask(task); setTaskDrawerVisible(true); }}>
                                    <div className="task-card-header">
                                        <Tag color={task.priority === 'High' ? 'red' : task.priority === 'Medium' ? 'orange' : 'blue'}>{task.priority}</Tag>
                                        <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(task.deadline).format('DD MMM')}</Text>
                                    </div>
                                    <Text strong className="task-title text-bright">{task.title}</Text>
                                    <p className="task-desc">{task.description}</p>
                                    <div className="task-card-footer">
                                        <Avatar size="small" src={`https://ui-avatars.com/api/?name=${task.assignedTo || 'U'}`} />
                                        <Space>
                                            <PaperClipOutlined style={{ fontSize: 12 }} />
                                            <MessageOutlined style={{ fontSize: 12 }} />
                                        </Space>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </Col>

                {/* 🔒 RIGHT: DIGITAL VAULT */}
                <Col xs={24} lg={6}>
                    <Card className="glass-panel vault-panel" title={<Space><SafetyCertificateOutlined /> Kho tài liệu mật</Space>}>
                        <div className="upload-zone-mini">
                            <Upload.Dragger customRequest={handleFileUpload} showUploadList={false} disabled={uploading}>
                                {uploading ? <RocketOutlined spin style={{ color: '#1890ff' }} /> : <PlusOutlined />}
                                <p style={{ fontSize: 12, margin: 0 }}>{uploading ? 'Đang mã hóa...' : 'Thả file bảo mật'}</p>
                            </Upload.Dragger>
                        </div>
                        
                        <div className="vault-list" style={{ marginTop: 20 }}>
                            {(!projectFiles || projectFiles.length === 0) ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                                projectFiles.map(file => (
                                    <div className="vault-item" key={file.id}>
                                        <FileIcon type={file.contentType} />
                                        <div className="file-info">
                                            <Text strong className="text-bright" style={{ fontSize: 12 }} ellipsis>{file.fileName}</Text>
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
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 20 }}>
                        <Space><RocketOutlined /> Chi tiết nhiệm vụ</Space>
                        <Button 
                            type="text" 
                            icon={<EditOutlined style={{ color: '#1890ff' }} />} 
                            onClick={handleOpenEdit}
                        >
                            Sửa
                        </Button>
                    </div>
                }
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
                        <Divider />
                        <Button 
                            danger 
                            block 
                            icon={<DeleteOutlined />} 
                            onClick={() => handleDeleteTask(selectedTask.id)}
                            className="delete-task-btn"
                            style={{ marginTop: 20 }}
                        >
                            Xóa nhiệm vụ này
                        </Button>
                    </div>
                )}
            </Drawer>

            {/* 📊 ANALYTICS MODAL */}
            <ProjectAnalyticsModal
                visible={isAnalyticsVisible}
                onClose={() => setIsAnalyticsVisible(false)}
                groupName={group?.name || ''}
                tasks={tasks}
                members={members}
                files={projectFiles}
            />

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

             <Modal title={isEditing ? "Chỉnh sửa nhiệm vụ" : "Tạo nhiệm vụ"} open={isTaskModalVisible} onCancel={() => setIsTaskModalVisible(false)} footer={null}>
                <Form form={taskForm} layout="vertical" onFinish={handleCreateTask} initialValues={{ priority: 'Medium' }}>
                    <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="description" label="Mô tả"><Input.TextArea /></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="status" label="Trạng thái" initialValue="Todo">
                                <Select>
                                    <Select.Option value="Todo">Cần làm</Select.Option>
                                    <Select.Option value="InProgress">Đang làm</Select.Option>
                                    <Select.Option value="InReview">Xem xét</Select.Option>
                                    <Select.Option value="Done">Hoàn thành</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="priority" label="Ưu tiên">
                                <Select>
                                    <Select.Option value="High">Cao</Select.Option>
                                    <Select.Option value="Medium">Trung bình</Select.Option>
                                    <Select.Option value="Low">Thấp</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="startDate" label="Bắt đầu">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="deadline" label="Hạn chót">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="assignedTo" label="Người thực hiện">
                        <Select placeholder="Chọn thành viên">
                            {members.map(m => <Select.Option key={m.id} value={m.fullName}>{m.fullName}</Select.Option>)}
                        </Select>
                    </Form.Item>
                    <Button type="primary" block htmlType="submit">{isEditing ? "Cập nhật" : "Khởi tạo"}</Button>
                </Form>
            </Modal>
        </div>
    );
}
