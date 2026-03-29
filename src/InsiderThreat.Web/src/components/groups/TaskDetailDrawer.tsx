import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'Description' | 'Comment' | 'Setting'>('Comment');
    const [comments, setComments] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [sending, setSending] = useState(false);
    
    // Attachment state
    const [attachment, setAttachment] = useState<{ url: string, name: string, size: number } | null>(null);
    const [uploading, setUploading] = useState(false);
    
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
        if (!newComment.trim() && !attachment) return;
        
        try {
            setSending(true);
            const payload = { 
                content: newComment,
                attachmentUrl: attachment?.url,
                attachmentName: attachment?.name,
                attachmentSize: attachment?.size
            };
            const res = await api.post<Comment>(`/api/groups/${groupId}/tasks/${task.id}/comments`, payload);
            setComments(prev => [...prev, res]);
            setNewComment('');
            setAttachment(null);
        } catch (error) {
            console.error('Failed to send comment', error);
            message.error('Lỗi khi gửi bình luận');
        } finally {
            setSending(false);
        }
    };

    const handleUpload = async (options: any) => {
        const { file, onSuccess, onError } = options;
        const formData = new FormData();
        formData.append('file', file);

        try {
            setUploading(true);
            const res = await (api as any).postForm(`/api/groups/${groupId}/tasks/${task.id}/comments/upload`, formData);
            setAttachment({
                url: res.url,
                name: res.name,
                size: res.size
            });
            onSuccess(res);
            message.success(`Đã tải lên: ${res.name}`);
        } catch (err) {
            console.error('Upload failed', err);
            onError(err);
            message.error('Lỗi tải lên tệp tin');
        } finally {
            setUploading(false);
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
            message.success(t('library.update_success'));
            onTaskUpdate();
            onClose();
        } catch (err) {
            message.error(t('library.update_fail'));
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
                        <div className="attr-label"><UserOutlined /> {t('project_detail.task_drawer.assignee')}</div>
                        {renderAssignees()}
                    </div>
                    
                    <div className="attr-row">
                        <div className="attr-label"><TagOutlined /> {t('project_detail.task_drawer.tags')}</div>
                        <div className="task-field-value">
                            <Select defaultValue="Mobile App" bordered={false} className="transparent-select">
                                <Option value="Mobile App">Mobile App</Option>
                                <Option value="Web App">Web App</Option>
                                <Option value="Marketing">Marketing</Option>
                            </Select>
                        </div>
                    </div>

                    <div className="attr-row">
                        <div className="attr-label"><CheckCircleOutlined /> {t('project_detail.task_drawer.status')}</div>
                        <div className="task-field-value">
                            <Select 
                                value={editedStatus} 
                                onChange={setEditedStatus} 
                                bordered={false} 
                                className="transparent-select status-select"
                                suffixIcon={null}
                            >
                                <Option value="Todo"><span className="status-dot todo"></span> {t('project_detail.task_drawer.status_todo')}</Option>
                                <Option value="InProgress"><span className="status-dot in-progress"></span> {t('project_detail.task_drawer.status_in_progress')}</Option>
                                <Option value="InReview"><span className="status-dot review"></span> {t('project_detail.task_drawer.status_review')}</Option>
                                <Option value="WaitingApproval"><span className="status-dot waiting"></span> {t('project_detail.task_drawer.status_waiting')}</Option>
                                <Option value="Done" disabled={!currentUserIsAdmin}><span className="status-dot done"></span> {t('project_detail.task_drawer.status_done')}</Option>
                            </Select>
                        </div>
                    </div>

                    <div className="attr-row">
                        <div className="attr-label"><ClockCircleOutlined /> {t('project_detail.task_drawer.due_date')}</div>
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
                        <div className="attr-label"><FireOutlined /> {t('project_detail.task_drawer.priority')}</div>
                        <div className="task-field-value">
                            <span className={`priority-badge ${editedPriority.toLowerCase()}`}>
                                {editedPriority === 'High' ? 'Urgent' : editedPriority}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Internal Tabs */}
                <div className="task-internal-tabs">
                    <button className={activeTab === 'Description' ? 'active' : ''} onClick={() => setActiveTab('Description')}>{t('project_detail.task_drawer.description_tab')}</button>
                    <button className={activeTab === 'Comment' ? 'active' : ''} onClick={() => setActiveTab('Comment')}>{t('project_detail.task_drawer.comment_tab')}</button>
                    <button className={activeTab === 'Setting' ? 'active' : ''} onClick={() => setActiveTab('Setting')}>{t('project_detail.task_drawer.setting_tab')}</button>
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
                                                {/* Real attachment rendering */}
                                                {c.attachmentUrl && (
                                                    <div className="file-attachment-preview">
                                                        <div className={`file-icon ${c.attachmentName?.split('.').pop()?.toLowerCase() || 'default'}`}>
                                                            {c.attachmentName?.split('.').pop()?.toUpperCase().substring(0, 1) || 'F'}
                                                        </div>
                                                        <div className="file-details">
                                                            <a href={c.attachmentUrl} target="_blank" rel="noreferrer">
                                                                <Text strong>{c.attachmentName}</Text>
                                                            </a>
                                                            <Text type="secondary">
                                                                {c.attachmentSize ? (c.attachmentSize / (1024 * 1024)).toFixed(2) + ' MB' : ''}
                                                            </Text>
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Legacy mock behavior (for old comments with mock strings) */}
                                                {!c.attachmentUrl && c.content.includes('style') && (
                                                    <div className="file-attachment-preview">
                                                        <div className="file-icon figma">F</div>
                                                        <div className="file-details">
                                                            <Text strong>ABC Dashboard Style.fig</Text>
                                                            <Text type="secondary">2.5 MB</Text>
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
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Mentions
                                        className="mention-input"
                                        placeholder={t('project_detail.task_drawer.comment_placeholder')}
                                        autoSize={{ minRows: 1, maxRows: 3 }}
                                        value={newComment}
                                        onChange={setNewComment}
                                        options={members.map(m => ({ 
                                            value: m.username || m.fullName, 
                                            label: (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Avatar size="small" src={m.avatarUrl} />
                                                    <span>{m.fullName}</span>
                                                </div>
                                            )
                                        }))}
                                    />
                                    {attachment && (
                                        <div className="pending-attachment">
                                            <PaperClipOutlined style={{ marginRight: 4 }} />
                                            <span>{attachment.name}</span>
                                            <CloseOutlined style={{ marginLeft: 8, cursor: 'pointer', fontSize: 10 }} onClick={() => setAttachment(null)} />
                                        </div>
                                    )}
                                </div>
                                <Upload customRequest={handleUpload} showUploadList={false}>
                                    <Button type="text" icon={<PaperClipOutlined />} className="attach-btn" loading={uploading} />
                                </Upload>
                                <Button type="primary" className="send-btn" onClick={handleSendComment} loading={sending || uploading}>{t('chat.send_now', { defaultValue: 'Send' })}</Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="drawer-footer-actions">
                    <div className="collaborators">
                        <Text type="secondary" style={{ marginRight: 8 }}>{t('project_detail.task_drawer.collaborators')}</Text>
                        <Avatar.Group size={24} maxCount={3}>
                            {members.slice(0, 4).map(m => <Avatar key={m.id} src={m.avatarUrl} />)}
                        </Avatar.Group>
                        <Button size="small" className="add-collab-btn">+</Button>
                    </div>
                    <Space>
                        <Button onClick={onClose} className="cancel-action-btn">{t('project_detail.task_drawer.cancel')}</Button>
                        <Button type="primary" onClick={handleSaveTaskInfo} className="save-action-btn">{t('project_detail.task_drawer.save')}</Button>
                    </Space>
                </div>
            </div>
        </Drawer>
    );
}
