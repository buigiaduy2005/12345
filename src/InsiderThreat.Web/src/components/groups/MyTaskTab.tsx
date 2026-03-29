import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { message, Spin, Empty, Avatar, Tooltip, Tag, Button, Input, Dropdown, Space, Modal } from 'antd';
import { 
    SearchOutlined, AppstoreOutlined, UnorderedListOutlined, 
    PlusOutlined, MoreOutlined, ClockCircleOutlined, 
    CheckCircleOutlined, SwapOutlined, DeleteOutlined, EditOutlined
} from '@ant-design/icons';
import type { DropResult } from '@hello-pangea/dnd';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../../services/api';
import CreateTaskModal from './CreateTaskModal';
import TaskDetailDrawer from './TaskDetailDrawer';
import './MyTaskTab.css';

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

interface Column {
    id: string;
    label: string;
    color: string;
    dotColor: string;
}

const COLUMNS: Column[] = [
    { id: 'Todo', label: 'To-do', color: '#8b949e', dotColor: '#8b949e' },
    { id: 'InProgress', label: 'In Progress', color: '#1890ff', dotColor: '#4338ca' },
    { id: 'InReview', label: 'In Review', color: '#faad14', dotColor: '#b45309' },
    { id: 'WaitingApproval', label: 'Chờ duyệt', color: '#f97316', dotColor: '#c2410c' },
    { id: 'Done', label: 'Completed', color: '#52c41a', dotColor: '#047857' }
];

interface Member {
    id: string;
    fullName: string;
    username: string;
    avatarUrl?: string;
}

export default function MyTaskTab() {
    const { id: groupId } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [showDrawer, setShowDrawer] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | undefined>(undefined);
    const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
    const [initialStatus, setInitialStatus] = useState<string | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tasksRes, membersRes] = await Promise.all([
                api.get<Task[]>(`/api/groups/${groupId}/tasks`),
                api.get<Member[]>(`/api/groups/${groupId}/members-details`)
            ]);
            setTasks(tasksRes);
            setMembers(membersRes);
        } catch (err) {
            message.error('Không thể tải danh sách công việc');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (groupId) fetchData();
    }, [groupId]);

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const targetStatus = destination.droppableId;
        const task = tasks.find(t => t.id === draggableId);
        if (!task) return;

        // Optimistic UI Update
        const originalTasks = [...tasks];
        const updatedTasks = tasks.map(t => t.id === draggableId ? { ...t, status: targetStatus } : t);
        setTasks(updatedTasks);

        try {
            await api.patch(`/api/groups/${groupId}/tasks/${draggableId}`, { status: targetStatus });
            message.success(`Đã chuyển sang ${targetStatus}`);
        } catch (err) {
            setTasks(originalTasks);
            message.error('Không thể cập nhật trạng thái');
        }
    };

    const getAssignee = (userId?: string) => {
        return members.find(m => m.id === userId);
    };

    const handleDeleteTask = (taskId: string) => {
        Modal.confirm({
            title: 'Xóa nhiệm vụ?',
            content: 'Hành động này không thể hoàn tác.',
            okText: 'Xóa',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    await api.delete(`/api/groups/${groupId}/tasks/${taskId}`);
                    message.success('Đã xóa task');
                    fetchData();
                } catch (err) {
                    message.error('Lỗi khi xóa task');
                }
            }
        });
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => 
            !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [tasks, searchQuery]);

    if (loading) return <div className="loading-tasks"><Spin size="large" /></div>;

    return (
        <div className="myTaskTab">
            {/* Design Header */}
            <div className="myTask-topBar">
                <div className="topBar-left">
                    <span className="task-project-label">PROJECT WORKFLOW</span>
                    <h2 className="task-project-title">Bảng công việc</h2>
                </div>
                <div className="topBar-right">
                    <Input 
                        prefix={<SearchOutlined />} 
                        placeholder="Tìm kiếm công việc..." 
                        style={{ width: 240, borderRadius: 8 }}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    
                    <div className="view-switcher">
                        <Button 
                            type={viewMode === 'kanban' ? 'primary' : 'text'} 
                            icon={<AppstoreOutlined />} 
                            onClick={() => setViewMode('kanban')}
                        >
                            Bảng
                        </Button>
                        <Button 
                            type={viewMode === 'list' ? 'primary' : 'text'} 
                            icon={<UnorderedListOutlined />} 
                            onClick={() => setViewMode('list')}
                        >
                            Danh sách
                        </Button>
                    </div>

                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => { 
                            setTaskToEdit(undefined); 
                            setInitialStatus(undefined);
                            setShowCreateTask(true); 
                        }}
                    >
                        Thêm Task
                    </Button>
                </div>
            </div>

            {/* Task Calendar (Timeline Bubble) */}
            <div className="task-timeline-wrapper animate-in">
                <div className="timeline-header">
                    <h3>Task Calendar</h3>
                    <Button type="text" icon={<MoreOutlined />} />
                </div>
                <div className="timeline-container">
                    <div className="timeline-row days">
                        <span>11 Feb</span>
                        <span>12 Feb</span>
                        <span>13 Feb</span>
                        <span>14 Feb</span>
                        <span>15 Feb</span>
                        <span>16 Feb</span>
                    </div>
                    
                    <div className="timeline-row grid-lines">
                        <div className="grid-col" />
                        <div className="grid-col active-col" />
                        <div className="grid-col" />
                        <div className="grid-col" />
                        <div className="grid-col" />
                    </div>

                    <div className="timeline-bubbles">
                        <div className="t-bubble gray" style={{ left: '5%', width: '15%', top: 10 }}>
                            <span className="t-date">11 Feb</span> Submit Final Screens
                        </div>
                        <div className="t-bubble gray" style={{ left: '5%', width: '15%', top: 40 }}>
                            <span className="t-date">11 Feb</span> Client Feedback
                        </div>
                        <div className="t-bubble black" style={{ left: '20%', width: '18%', top: 70 }}>
                            <span className="t-date">12 Feb</span> Client Feedback Meeting
                        </div>
                        <div className="t-bubble gray disabled" style={{ left: '60%', width: '18%', top: 50 }}>
                            <span className="t-date">15 Feb</span> Finalize UI Screens
                        </div>
                    </div>
                </div>
            </div>

            <h3 className="all-tasks-header">All Task</h3>

            {/* Kanban Board with DND */}
            {viewMode === 'kanban' && (
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="kanbanBoard">
                        {COLUMNS.map(col => (
                            <Droppable key={col.id} droppableId={col.id}>
                                {(provided, snapshot) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={`kanbanColumn ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                                    >
                                        <div className="colHeader">
                                            <div className="colTitle">
                                                <div className="colDot" style={{ background: col.dotColor }} />
                                                <span>{col.label}</span>
                                                <span className="colCount">
                                                    {filteredTasks.filter(t => t.status === col.id).length}
                                                </span>
                                            </div>
                                            <Button 
                                                type="text" 
                                                size="small" 
                                                icon={<PlusOutlined />} 
                                                onClick={() => {
                                                    setTaskToEdit(undefined);
                                                    setInitialStatus(col.id);
                                                    setShowCreateTask(true);
                                                }} 
                                            />
                                        </div>

                                        <div className="kanbanCardsList">
                                            {filteredTasks.filter(t => t.status === col.id).map((task, index) => {
                                                const assignee = getAssignee(task.assignedTo);
                                                return (
                                                    <Draggable key={task.id} draggableId={task.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                className={`modern-kCard ${snapshot.isDragging ? 'is-dragging' : ''}`}
                                                                onClick={() => {
                                                                    setSelectedTask(task);
                                                                    setShowDrawer(true);
                                                                }}
                                                            >
                                                                 <div className="kCard-tagRow">
                                                                    <Space>
                                                                        <Tag color={task.priority === 'High' ? 'red' : task.priority === 'Medium' ? 'orange' : 'blue'}>
                                                                            {task.priority}
                                                                        </Tag>
                                                                        {task.deadline && (
                                                                            <span className="kCard-date">
                                                                                <ClockCircleOutlined /> {new Date(task.deadline).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                                                            </span>
                                                                        )}
                                                                    </Space>
                                                                    <Space>
                                                                        <Button 
                                                                            type="text" 
                                                                            size="small" 
                                                                            icon={<EditOutlined style={{ fontSize: 12, color: '#1890ff' }} />} 
                                                                            onClick={(e) => { 
                                                                                e.stopPropagation(); 
                                                                                setTaskToEdit(task); 
                                                                                setShowCreateTask(true); 
                                                                            }}
                                                                        />
                                                                        <Button 
                                                                            type="text" 
                                                                            size="small" 
                                                                            danger 
                                                                            icon={<DeleteOutlined style={{ fontSize: 12 }} />} 
                                                                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                                                            className="kCard-delete-btn"
                                                                        />
                                                                    </Space>
                                                                </div>
                                                                <h4 className="kCard-title">{task.title}</h4>
                                                                {task.description && <p className="kCard-description">{task.description}</p>}
                                                                
                                                                <div className="kCard-footer">
                                                                    <div className="kCard-assignee">
                                                                        {assignee ? (
                                                                            <Tooltip title={assignee.fullName}>
                                                                                <Avatar size="small" src={assignee.avatarUrl || `https://ui-avatars.com/api/?name=${assignee.fullName}`} />
                                                                            </Tooltip>
                                                                        ) : (
                                                                            <Avatar size="small" icon={<SwapOutlined />} />
                                                                        )}
                                                                    </div>
                                                                    <div className="kCard-actions">
                                                                        <Tooltip title="Tiến độ">
                                                                           <Tag color="cyan">{task.progress}%</Tag>
                                                                        </Tooltip>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                );
                                            })}
                                            {provided.placeholder}
                                        </div>
                                    </div>
                                )}
                            </Droppable>
                        ))}
                    </div>
                </DragDropContext>
            )}

            {viewMode === 'list' && (
                <div className="listView modern-list animate-in">
                    <div className="list-header">
                        <div className="list-col">Công việc</div>
                        <div className="list-col">Trạng thái</div>
                        <div className="list-col">Người làm</div>
                        <div className="list-col">Hạn chót</div>
                        <div className="list-col">Độ ưu tiên</div>
                        <div className="list-col" style={{ width: 80 }}>Thao tác</div>
                    </div>
                    {filteredTasks.map(t => (
                        <div key={t.id} className="list-row" onClick={() => { setSelectedTask(t); setShowDrawer(true); }}>
                            <div className="list-col title">{t.title}</div>
                            <div className="list-col">
                                <Tag color={COLUMNS.find(c => c.id === t.status)?.dotColor}>{t.status}</Tag>
                            </div>
                            <div className="list-col">
                                <Space>
                                    <Avatar size="small" src={`https://ui-avatars.com/api/?name=${getAssignee(t.assignedTo)?.fullName || 'U'}`} />
                                    <span>{getAssignee(t.assignedTo)?.fullName || '---'}</span>
                                </Space>
                            </div>
                            <div className="list-col date">{t.deadline ? new Date(t.deadline).toLocaleDateString('vi-VN') : '---'}</div>
                            <div className="list-col">
                                <Tag color={t.priority === 'High' ? 'red' : 'default'}>{t.priority}</Tag>
                            </div>
                            <div className="list-col">
                                <Space>
                                    <Button 
                                        type="text" 
                                        icon={<EditOutlined style={{ color: '#1890ff' }} />} 
                                        onClick={() => { 
                                            setTaskToEdit(t); 
                                            setShowCreateTask(true); 
                                        }} 
                                    />
                                    <Button 
                                        type="text" 
                                        danger 
                                        icon={<DeleteOutlined />} 
                                        onClick={() => handleDeleteTask(t.id)} 
                                    />
                                </Space>
                            </div>
                        </div>
                    ))}
                    {filteredTasks.length === 0 && <Empty description="Không tìm thấy công việc" />}
                </div>
            )}

            {showCreateTask && (
                <CreateTaskModal
                    task={taskToEdit}
                    initialStatus={initialStatus}
                    onClose={() => {
                        setShowCreateTask(false);
                        setTaskToEdit(undefined);
                        setInitialStatus(undefined);
                    }}
                    onSubmit={() => {
                        setShowCreateTask(false);
                        setTaskToEdit(undefined);
                        setInitialStatus(undefined);
                        fetchData();
                    }}
                />
            )}

            {showDrawer && selectedTask && (
                <TaskDetailDrawer
                    open={showDrawer}
                    onClose={() => {
                        setShowDrawer(false);
                        setSelectedTask(undefined);
                    }}
                    task={selectedTask}
                    groupId={groupId || ''}
                    members={members}
                    onTaskUpdate={() => {
                        fetchData();
                        // Refetch specifically selectedTask if needed, but array update might be enough
                    }}
                />
            )}
        </div>
    );
}
