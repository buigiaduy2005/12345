import React, { useState, useEffect, useRef } from 'react';
import { Drawer, Button, Input, Space, Typography, Spin, Select, DatePicker, Mentions, Upload, message, Tooltip, Avatar } from 'antd';
import { 
    StarOutlined, LinkOutlined, CloseOutlined, 
    UserOutlined, TagOutlined, ClockCircleOutlined,
    FireOutlined, CheckCircleOutlined, PaperClipOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { api } from '../../services/api';
import './TaskDetailDrawer.css';

dayjs.extend(relativeTime);
const { Title, Text } = Typography;
const { Option } = Select;

interface Task {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    progress: number;
    assignedTo?: string;
    startDate?: string;
    deadline?: string;
}

interface Member {
    id: string;
    fullName: string;
    avatarUrl?: string;
    username: string;
}

interface Comment {
    id: string;
    content: string;
    createdAt: string;
    user: {
        id: string;
        fullName: string;
        avatarUrl?: string;
    };
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentSize?: number;
}

interface TaskDetailDrawerProps {
    open: boolean;
    onClose: () => void;
    task: Task;
    groupId: string;
    members: Member[];
    onTaskUpdate: () => void;
    currentUserIsAdmin?: boolean; // new prop to enforce wait approval
}

export default function TaskDetailDrawer({ open, onClose, task, groupId, members, onTaskUpdate, currentUserIsAdmin = false }: TaskDetailDrawerProps) {
    const [activeTab, setActiveTab] = useState<'Description' | 'Comment' | 'Setting'>('Comment');
    const [comments, setComments] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [sending, setSending] = useState(false);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    // Editing states for immediate UX
    const [editedStatus, setEditedStatus] = useState<string>('');
    const [editedPriority, setEditedPriority] = useState<string>('');
    const [editedDeadline, setEditedDeadline] = useState<dayjs.Dayjs | null>(null);

    useEffect(() => {
        if (open && task) {
            fetchComments();
            setEditedStatus(task.status);
            setEditedPriority(task.priority);
            setEditedDeadline(task.deadline ? dayjs(task.deadline) : null);
        }
    }, [open, task]);

    useEffect(() => {
        scrollToBottom();
    }, [comments, activeTab]);

    const scrollToBottom = () => {
        if (activeTab === 'Comment') {
            commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const fetchComments = async () => {
        try {
            setLoadingComments(true);
            const res = await api.get<Comment[]>(`/api/groups/${groupId}/tasks/${task.id}/comments`);
            setComments(res || []);
        } catch (error) {
            console.error('Lỗi khi tải bình luận:', error);
        } finally {
            setLoadingComments(false);
        }
    };

    const handleSendComment = async () => {
        if (!newComment.trim()) return;
        
        try {
            setSending(true);
            const res = await api.post<Comment>(`/api/groups/${groupId}/tasks/${task.id}/comments`, { content: newComment });
            setComments(prev => [...prev, res]);
            setNewComment('');
        } catch (error) {
            console.error('Failed to send comment', error);
        } finally {
            setSending(false);
        }
    };

    const handleSaveTaskInfo = async () => {
        try {
            // For mock logic right now, assume immediate save to API
            await api.patch(`/api/groups/${groupId}/tasks/${task.id}`, { 
                status: editedStatus,
                priority: editedPriority,
                deadline: editedDeadline ? editedDeadline.toISOString() : null
            });
            message.success('Đã lưu thay đổi');
            onTaskUpdate();
            onClose();
        } catch (err) {
            message.error('Lỗi lưu thay đổi');
        }
    };

    // --- RENDER HELPERS ---
    const renderAssignees = () => {
        // Just mock multiselect visual for assignee based on the image
        const assigneeMatch = members.find(m => m.id === task?.assignedTo);
        return (
            <div className="task-field-value assignees-list">
                {assigneeMatch ? (
                    <div className="assignee-tag blue">
                        {assigneeMatch.fullName} <CloseOutlined className="remove-icon" />
                    </div>
                ) : (
                    <div className="assignee-tag placeholder">Chưa phân công</div>
                )}
                {/* Visual mock tags to closely resemble image 5 */}
                <div className="assignee-tag green">
                    Joe Tesla <CloseOutlined className="remove-icon" />
                </div>
                <div className="assignee-tag yellow">
                    Tania <CloseOutlined className="remove-icon" />
                </div>
                <Button size="small" className="add-assignee-btn" icon={<span style={{fontSize: 14}}>+</span>} />
            </div>
        );
    };

    return (
        <Drawer
            placement="right"
            closable={false}
            onClose={onClose}
            open={open}
            width="550px"
            className="synchro-task-drawer"
            maskStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
        >
            <div className="task-drawer-container">
                {/* Header */}
                <div className="drawer-header">
                    <Title level={4} className="task-main-title">{task?.title || 'Loading...'}</Title>
                    <Space className="header-actions" size={8}>
                        <Button className="icon-btn" icon={<StarOutlined />} />
                        <Button className="icon-btn" icon={<LinkOutlined />} />
                        <Button className="icon-btn close" icon={<CloseOutlined />} onClick={onClose} />
                    </Space>
                </div>

                {/* Attributes Grid */}
                <div className="task-attributes-grid">
                    <div className="attr-row">
                        <div className="attr-label"><UserOutlined /> Assignee</div>
                        {renderAssignees()}
                    </div>
                    
                    <div className="attr-row">
                        <div className="attr-label"><TagOutlined /> Tags</div>
                        <div className="task-field-value">
                            <Select defaultValue="Mobile App" bordered={false} className="transparent-select">
                                <Option value="Mobile App">Mobile App</Option>
                                <Option value="Web App">Web App</Option>
                                <Option value="Marketing">Marketing</Option>
                            </Select>
                        </div>
                    </div>

                    <div className="attr-row">
                        <div className="attr-label"><CheckCircleOutlined /> Status</div>
                        <div className="task-field-value">
                            <Select 
                                value={editedStatus} 
                                onChange={setEditedStatus} 
                                bordered={false} 
                                className="transparent-select status-select"
                                suffixIcon={null}
                            >
                                <Option value="Todo"><span className="status-dot todo"></span> Cần làm</Option>
                                <Option value="InProgress"><span className="status-dot in-progress"></span> On Progress</Option>
                                <Option value="InReview"><span className="status-dot review"></span> Xem xét</Option>
                                <Option value="WaitingApproval"><span className="status-dot waiting"></span> Chờ duyệt</Option>
                                <Option value="Done" disabled={!currentUserIsAdmin}><span className="status-dot done"></span> Hoàn thành</Option>
                            </Select>
                        </div>
                    </div>

                    <div className="attr-row">
                        <div className="attr-label"><ClockCircleOutlined /> Due date</div>
                        <div className="task-field-value">
                            <DatePicker 
                                bordered={false} 
                                value={editedDeadline} 
                                onChange={setEditedDeadline}
                                format="MMM DD, YYYY"
                                className="transparent-datepicker"
                                suffixIcon={null}
                            />
                        </div>
                    </div>

                    <div className="attr-row">
                        <div className="attr-label"><FireOutlined /> Priority</div>
                        <div className="task-field-value">
                            <span className={`priority-badge ${editedPriority.toLowerCase()}`}>
                                {editedPriority === 'High' ? 'Urgent' : editedPriority}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Internal Tabs */}
                <div className="task-internal-tabs">
                    <button className={activeTab === 'Description' ? 'active' : ''} onClick={() => setActiveTab('Description')}>Description</button>
                    <button className={activeTab === 'Comment' ? 'active' : ''} onClick={() => setActiveTab('Comment')}>Comment</button>
                    <button className={activeTab === 'Setting' ? 'active' : ''} onClick={() => setActiveTab('Setting')}>Setting</button>
                </div>

                {/* Tab Content */}
                <div className="tab-content-area">
                    {activeTab === 'Description' && (
                        <div className="description-view">
                            {task?.description || "No description provided. Please update."}
                        </div>
                    )}

                    {activeTab === 'Comment' && (
                        <div className="comments-view">
                            <div className="comments-list">
                                {loadingComments ? <Spin /> : comments.map(c => (
                                    <div className="comment-block" key={c.id}>
                                        <Avatar src={c.user?.avatarUrl} size={32} />
                                        <div className="comment-body">
                                            <div className="comment-meta">
                                                <Text strong>{c.user?.fullName}</Text>
                                                <Text type="secondary" className="time">{dayjs(c.createdAt).fromNow()}</Text>
                                            </div>
                                            <div className="comment-box">
                                                <p>{c.content}</p>
                                                {/* Mocking file attachment for visual closeness to Image 5 */}
                                                {c.content.includes('style') && (
                                                    <div className="file-attachment-preview">
                                                        <div className="file-icon figma">F</div>
                                                        <div className="file-details">
                                                            <Text strong>ABC Dashboard Style.fig</Text>
                                                            <Text type="secondary">2.5 MB</Text>
                                                        </div>
                                                    </div>
                                                )}
                                                {c.content.includes('guideline') && (
                                                    <div className="file-attachment-preview">
                                                        <div className="file-icon word">W</div>
                                                        <div className="file-details">
                                                            <Text strong>Design System Guidelines.doc</Text>
                                                            <Text type="secondary">1.5 MB</Text>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="comment-actions">
                                                <span>Reply</span> • <span>Like</span> • <span>Delete</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={commentsEndRef} />
                            </div>
                            
                            {/* Input box */}
                            <div className="comment-input-area">
                                <Avatar src={members[0]?.avatarUrl} size={32} />
                                <Mentions
                                    className="mention-input"
                                    placeholder="Add a comment... (Type @ to mention)"
                                    autoSize={{ minRows: 1, maxRows: 3 }}
                                    value={newComment}
                                    onChange={setNewComment}
                                    options={members.map(m => ({ value: m.username || m.fullName, label: m.fullName }))}
                                />
                                <Upload showUploadList={false}>
                                    <Button type="text" icon={<PaperClipOutlined />} className="attach-btn" />
                                </Upload>
                                <Button type="primary" className="send-btn" onClick={handleSendComment} loading={sending}>Send</Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="drawer-footer-actions">
                    <div className="collaborators">
                        <Text type="secondary" style={{ marginRight: 8 }}>Collaborators</Text>
                        <Avatar.Group size={24} maxCount={3}>
                            {members.slice(0, 4).map(m => <Avatar key={m.id} src={m.avatarUrl} />)}
                        </Avatar.Group>
                        <Button size="small" className="add-collab-btn">+</Button>
                    </div>
                    <Space>
                        <Button onClick={onClose} className="cancel-action-btn">Cancel</Button>
                        <Button type="primary" onClick={handleSaveTaskInfo} className="save-action-btn">Save</Button>
                    </Space>
                </div>
            </div>
        </Drawer>
    );
}
